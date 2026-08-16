import { chmod, mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { resolve } from 'node:path';

if (process.platform !== 'win32') {
  console.log('Este instalador automático está preparado para Windows. Em macOS/Linux, instale cloudflared pelo gerenciador do sistema.');
  process.exit(0);
}

const architecture = process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? '386' : 'amd64';
const downloadUrl = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-${architecture}.exe`;
const toolsDir = resolve('.tools');
const target = resolve(toolsDir, 'cloudflared.exe');

console.log(`Baixando cloudflared oficial (${architecture})...`);
const response = await fetch(downloadUrl, { redirect: 'follow' });
if (!response.ok) {
  throw new Error(`Falha ao baixar cloudflared: HTTP ${response.status}`);
}

const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length < 1_000_000) {
  throw new Error('O arquivo baixado parece inválido ou incompleto.');
}

await mkdir(toolsDir, { recursive: true });
await writeFile(target, bytes);
await chmod(target, 0o755).catch(() => {});

console.log(`✓ cloudflared instalado localmente em: ${target}`);
console.log('Agora rode: npm.cmd run start:event');
