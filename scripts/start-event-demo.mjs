import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import QRCode from 'qrcode';

const port = Number(process.env.HOSPEDA_PATAS_EVENT_PORT || 8081);
const forcedHost = process.env.HOSPEDA_PATAS_EVENT_HOST?.trim();
const qrOnly = process.env.HOSPEDA_PATAS_EVENT_QR_ONLY === '1';
const quickTunnelTimeoutMs = Number(process.env.HOSPEDA_PATAS_TUNNEL_TIMEOUT_MS || 90000);
const expoReadyTimeoutMs = Number(process.env.HOSPEDA_PATAS_EXPO_READY_TIMEOUT_MS || 60000);

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('HOSPEDA_PATAS_EVENT_PORT precisa ser uma porta válida entre 1024 e 65535.');
}

if (!Number.isInteger(quickTunnelTimeoutMs) || quickTunnelTimeoutMs < 15000) {
  throw new Error('HOSPEDA_PATAS_TUNNEL_TIMEOUT_MS precisa ser de pelo menos 15000 ms.');
}

if (!Number.isInteger(expoReadyTimeoutMs) || expoReadyTimeoutMs < 10000) {
  throw new Error('HOSPEDA_PATAS_EXPO_READY_TIMEOUT_MS precisa ser de pelo menos 10000 ms.');
}

function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function adapterPenalty(name) {
  const normalized = name.toLowerCase();
  const virtualTerms = ['wsl', 'vethernet', 'hyper-v', 'virtualbox', 'vmware', 'vpn', 'tailscale', 'zerotier', 'bluetooth'];
  return virtualTerms.some((term) => normalized.includes(term)) ? 100 : 0;
}

function adapterBonus(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes('wi-fi') || normalized.includes('wifi') || normalized.includes('wlan')) return -20;
  if (normalized.includes('ethernet')) return -10;
  return 0;
}

function chooseLanAddress() {
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal || !isPrivateIPv4(address.address)) continue;
      candidates.push({
        name,
        address: address.address,
        score: adapterPenalty(name) + adapterBonus(name),
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  if (!candidates.length) {
    throw new Error(
      'Nenhum IPv4 privado foi encontrado. Conecte o notebook à rede do evento ou defina HOSPEDA_PATAS_EVENT_HOST manualmente.',
    );
  }

  if (candidates.length > 1) {
    console.log('\nInterfaces LAN detectadas:');
    candidates.forEach((candidate, index) => {
      const selected = index === 0 ? '  ← selecionada' : '';
      console.log(`  ${candidate.name}: ${candidate.address}${selected}`);
    });
    console.log('Se a interface escolhida estiver errada, defina HOSPEDA_PATAS_EVENT_HOST antes de iniciar.');
  }

  return candidates[0].address;
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function spawnCrossPlatform(command, args, options = {}) {
  if (process.platform === 'win32') {
    const commandProcessor = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
    const quoted = [command, ...args]
      .map((part) => (/\s/.test(part) ? `"${part.replaceAll('"', '\\"')}"` : part))
      .join(' ');
    return spawn(commandProcessor, ['/d', '/s', '/c', quoted], options);
  }
  return spawn(command, args, options);
}

function startCloudflareQuickTunnel() {
  const localUrl = `http://127.0.0.1:${port}`;
  return spawnCrossPlatform(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--yes', 'wrangler@latest', 'tunnel', 'quick-start', localUrl],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    },
  );
}

function waitForPublicTunnel(child) {
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let buffer = '';

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      rejectPromise(
        new Error(
          `Cloudflare Quick Tunnel não publicou uma URL em ${Math.round(quickTunnelTimeoutMs / 1000)} s.`,
        ),
      );
    }, quickTunnelTimeoutMs);

    const inspect = (chunk, target) => {
      const text = chunk.toString();
      target.write(text);
      buffer = `${buffer}${stripAnsi(text)}`.slice(-12000);
      const match = buffer.match(/https:\/\/[a-z0-9-]+\.(?:trycloudflare\.com|trycloudflare\.app)/i);
      if (!match || settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(match[0]);
    };

    child.stdout?.on('data', (chunk) => inspect(chunk, process.stdout));
    child.stderr?.on('data', (chunk) => inspect(chunk, process.stderr));

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(error);
    });

    child.once('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(new Error(`Cloudflare Quick Tunnel encerrou antes de publicar a URL (código ${code ?? 'desconhecido'}).`));
    });
  });
}

function startExpo(publicTunnelUrl) {
  const npmArgs = [
    'run',
    'start',
    '--workspace=@hospeda-patas/mobile',
    '--',
    '--go',
    '--localhost',
    '--port',
    String(port),
  ];

  return spawnCrossPlatform(process.platform === 'win32' ? 'npm.cmd' : 'npm', npmArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY || '1',
      EXPO_PACKAGER_PROXY_URL: publicTunnelUrl,
    },
  });
}

async function sleep(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function waitForExpoGoUrl() {
  const deadline = Date.now() + expoReadyTimeoutMs;
  const endpoint = `http://127.0.0.1:${port}/_expo/open?platform=android&runtime=expo`;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const payload = await response.json();
        if (typeof payload?.url === 'string' && /^exps?:\/\//i.test(payload.url)) {
          return payload.url;
        }
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }

  throw new Error(
    `Expo não publicou o deep link do Expo Go em ${Math.round(expoReadyTimeoutMs / 1000)} s${
      lastError instanceof Error ? `: ${lastError.message}` : '.'
    }`,
  );
}

async function verifyExternalExpoEndpoint(publicTunnelUrl) {
  const endpoint = `${publicTunnelUrl}/_expo/open?platform=android&runtime=expo`;
  const response = await fetch(endpoint, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Tunnel respondeu HTTP ${response.status} ao endpoint do Expo.`);
  }
  const payload = await response.json();
  if (typeof payload?.url !== 'string' || !/^exps?:\/\//i.test(payload.url)) {
    throw new Error('Tunnel respondeu, mas não devolveu um deep link válido do Expo Go.');
  }
  return payload.url;
}

const host = forcedHost || chooseLanAddress();
const demoUrl = `http://${host}:${port}/demo`;
const outputDirectory = resolve('artifacts', 'event');
const demoQrPath = resolve(outputDirectory, 'hospeda-patas-demo-qr.png');
const demoUrlPath = resolve(outputDirectory, 'hospeda-patas-demo-url.txt');
const appQrPath = resolve(outputDirectory, 'hospeda-patas-app-qr.png');
const appUrlPath = resolve(outputDirectory, 'hospeda-patas-app-url.txt');
const tunnelUrlPath = resolve(outputDirectory, 'hospeda-patas-tunnel-url.txt');

await mkdir(outputDirectory, { recursive: true });
await QRCode.toFile(demoQrPath, demoUrl, {
  width: 1600,
  margin: 4,
  errorCorrectionLevel: 'H',
});
await writeFile(demoUrlPath, `${demoUrl}\n`, 'utf8');

const terminalDemoQr = await QRCode.toString(demoUrl, {
  type: 'terminal',
  small: true,
  errorCorrectionLevel: 'M',
});

console.log('\n============================================================');
console.log(' HOSPEDA PATAS — MODO EVENTO');
console.log('============================================================');
console.log('\nQR DEMO WEB — abre /demo no navegador pela rede local:');
console.log(terminalDemoQr);
console.log(`URL demo: ${demoUrl}`);
console.log(`PNG demo: ${demoQrPath}`);

if (qrOnly) {
  console.log('\nQR gerado em modo de validação. Tunnel e Expo não serão iniciados.');
  process.exit(0);
}

console.log('\n============================================================');
console.log(' APP REAL — ACESSO EXTERNO');
console.log('============================================================');
console.log('Criando Cloudflare Quick Tunnel para o Metro...');
console.log('Esse endereço funciona pela internet; o celular não precisa estar na mesma rede do notebook.\n');

let tunnelChild = null;
let expoChild = null;
let stopping = false;

try {
  tunnelChild = startCloudflareQuickTunnel();
  const publicTunnelUrl = await waitForPublicTunnel(tunnelChild);
  await writeFile(tunnelUrlPath, `${publicTunnelUrl}\n`, 'utf8');

  console.log('\n✅ Tunnel público criado.');
  console.log(`Tunnel: ${publicTunnelUrl}`);
  console.log('Iniciando o Expo Go com esse tunnel como endereço público do APP REAL...\n');

  expoChild = startExpo(publicTunnelUrl);

  expoChild.once('error', (error) => {
    console.error('\nNão foi possível iniciar o Expo.');
    console.error(error);
    stopAll('SIGTERM');
    process.exitCode = 1;
  });

  expoChild.once('exit', (code, signal) => {
    if (stopping || signal) return;
    console.error(`\nExpo encerrou (código ${code ?? 'desconhecido'}). Encerrando o tunnel.`);
    stopAll('SIGTERM');
    process.exitCode = code ?? 1;
  });

  tunnelChild.once('exit', (code, signal) => {
    if (stopping || signal) return;
    console.error(`\nCloudflare Tunnel encerrou (código ${code ?? 'desconhecido'}). Encerrando o Expo.`);
    stopAll('SIGTERM');
    process.exitCode = code ?? 1;
  });

  const localAppUrl = await waitForExpoGoUrl();
  const externalAppUrl = await verifyExternalExpoEndpoint(publicTunnelUrl);
  const tunnelHostname = new URL(publicTunnelUrl).hostname;

  if (!localAppUrl.includes(tunnelHostname) || !externalAppUrl.includes(tunnelHostname)) {
    throw new Error(
      `Expo iniciou, mas o deep link não está usando o tunnel público ${tunnelHostname}. URL local: ${localAppUrl}; URL externa: ${externalAppUrl}`,
    );
  }

  await QRCode.toFile(appQrPath, externalAppUrl, {
    width: 1600,
    margin: 4,
    errorCorrectionLevel: 'H',
  });
  await writeFile(appUrlPath, `${externalAppUrl}\n`, 'utf8');

  const terminalAppQr = await QRCode.toString(externalAppUrl, {
    type: 'terminal',
    small: true,
    errorCorrectionLevel: 'M',
  });

  console.log('\n============================================================');
  console.log(' QR APP REAL — EXPO GO / INTERNET');
  console.log('============================================================');
  console.log(terminalAppQr);
  console.log(`URL Expo Go: ${externalAppUrl}`);
  console.log(`PNG do APP REAL: ${appQrPath}`);
  console.log(`URL salva em: ${appUrlPath}`);
  console.log('✅ Verificação externa concluída pelo próprio endereço público do Cloudflare.');
  console.log('Esse QR abre o aplicativo real e usa os usuários/dados reais do Supabase.');
  console.log('Pode ser aberto em outra Wi-Fi ou no 4G/5G enquanto este terminal estiver rodando.\n');
} catch (error) {
  console.error('\n❌ Não foi possível publicar o app pela internet.');
  console.error(error instanceof Error ? error.message : error);
  console.error('\nO app NÃO será rebaixado silenciosamente para LAN: este modo precisa garantir acesso externo.');
  stopAll('SIGTERM');
  process.exitCode = 1;
}

function stopAll(signal) {
  if (stopping) return;
  stopping = true;
  if (expoChild && !expoChild.killed) expoChild.kill(signal);
  if (tunnelChild && !tunnelChild.killed) tunnelChild.kill(signal);
}

process.on('SIGINT', () => {
  stopAll('SIGINT');
  setTimeout(() => process.exit(0), 250);
});
process.on('SIGTERM', () => {
  stopAll('SIGTERM');
  setTimeout(() => process.exit(0), 250);
});
