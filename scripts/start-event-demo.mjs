import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import QRCode from 'qrcode';

const port = Number(process.env.HOSPEDA_PATAS_EVENT_PORT || 8081);
const forcedHost = process.env.HOSPEDA_PATAS_EVENT_HOST?.trim();
const qrOnly = process.env.HOSPEDA_PATAS_EVENT_QR_ONLY === '1';
const tunnelRetries = 2;

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('HOSPEDA_PATAS_EVENT_PORT precisa ser uma porta válida entre 1024 e 65535.');
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

function startExpo(connectionMode) {
  const npmArgs = [
    'run',
    'start',
    '--workspace=@hospeda-patas/mobile',
    '--',
    `--${connectionMode}`,
    '--port',
    String(port),
  ];

  const options = {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY || '1',
    },
  };

  if (process.platform === 'win32') {
    const commandProcessor = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
    const command = ['npm.cmd', ...npmArgs].join(' ');
    return spawn(commandProcessor, ['/d', '/s', '/c', command], options);
  }

  return spawn('npm', npmArgs, options);
}

const host = forcedHost || chooseLanAddress();
const demoUrl = `http://${host}:${port}/demo`;
const outputDirectory = resolve('artifacts', 'event');
const qrPath = resolve(outputDirectory, 'hospeda-patas-demo-qr.png');
const urlPath = resolve(outputDirectory, 'hospeda-patas-demo-url.txt');

await mkdir(outputDirectory, { recursive: true });
await QRCode.toFile(qrPath, demoUrl, {
  width: 1600,
  margin: 4,
  errorCorrectionLevel: 'H',
});
await writeFile(urlPath, `${demoUrl}\n`, 'utf8');

const terminalQr = await QRCode.toString(demoUrl, {
  type: 'terminal',
  small: true,
  errorCorrectionLevel: 'M',
});

console.log('\n============================================================');
console.log(' HOSPEDA PATAS — MODO EVENTO');
console.log('============================================================');
console.log('\nQR DO PÚBLICO — abre no navegador, sem Expo Go e sem login:');
console.log(terminalQr);
console.log(`URL: ${demoUrl}`);
console.log(`PNG para a apresentação: ${qrPath}`);
console.log(`URL salva em: ${urlPath}`);

if (qrOnly) {
  console.log('\nQR gerado em modo de validação. O servidor Expo não será iniciado.');
  process.exit(0);
}

console.log('\nO Expo exibirá abaixo o segundo QR, destinado ao Expo Go/teste técnico.');
console.log('O app técnico tentará TUNNEL primeiro e cairá para LAN automaticamente se o ngrok falhar.');
console.log('Mantenha este terminal aberto durante a apresentação.');
console.log('IMPORTANTE: o QR público /demo sempre depende da LAN.\n');

let child = null;
let stopping = false;
let tunnelAttempt = 0;

function launch(connectionMode) {
  if (connectionMode === 'tunnel') {
    tunnelAttempt += 1;
    console.log(`\nTentativa ${tunnelAttempt}/${tunnelRetries} de iniciar o Expo por TUNNEL...\n`);
  } else {
    console.log('\n⚠️  Tunnel indisponível. Iniciando o QR técnico por LAN como fallback.');
    console.log(`Os aparelhos precisam alcançar o notebook ${host} pela rede local.\n`);
  }

  child = startExpo(connectionMode);

  child.once('error', (error) => {
    console.error(`\nNão foi possível iniciar o Expo por ${connectionMode.toUpperCase()}.`);
    console.error(error);
    handleFailedLaunch(connectionMode);
  });

  child.once('exit', (code, signal) => {
    if (stopping || signal) {
      process.exit(0);
      return;
    }

    if ((code ?? 0) === 0) {
      process.exit(0);
      return;
    }

    handleFailedLaunch(connectionMode);
  });
}

function handleFailedLaunch(connectionMode) {
  if (stopping) return;

  if (connectionMode === 'tunnel' && tunnelAttempt < tunnelRetries) {
    console.warn('\nTunnel falhou. Nova tentativa em 2 segundos...');
    setTimeout(() => launch('tunnel'), 2000);
    return;
  }

  if (connectionMode === 'tunnel') {
    console.warn('\nAs tentativas de tunnel falharam. Ativando fallback LAN automaticamente.');
    setTimeout(() => launch('lan'), 1000);
    return;
  }

  console.error('\nTambém não foi possível iniciar o Expo por LAN.');
  process.exitCode = 1;
}

function stop(signal) {
  stopping = true;
  if (child && !child.killed) child.kill(signal);
  else process.exit(0);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

launch('tunnel');
