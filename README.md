# Tranquilo Pet

MVP mobile para conectar tutores de pets a cuidadores. O fluxo atual é um laboratório funcional de cadastro de tutor, preparado para ser aberto em vários celulares com Expo Go e acompanhado no computador.

## O que já funciona

- aplicativo Expo SDK 54 com a identidade **Tranquilo Pet**;
- tela inicial com contador de interações;
- cadastro de tutor com validação, loading, erro e sucesso;
- monitor Python local com FastAPI e SQLite;
- eventos sanitizados no CMD e painel web atualizado ao vivo;
- testes automatizados mobile e Python.

O monitor é apenas uma ferramenta de desenvolvimento. O backend real do MVP continuará sendo implementado no Supabase; não use o monitor com dados reais, na internet ou em produção.

## Estrutura

```text
.
├── apps/mobile/              # Aplicativo Expo/React Native
├── tools/dev-monitor/        # API e painel local de testes
├── docs/                     # Arquitetura, banco e preparação local
├── scripts/                  # Comandos auxiliares do Windows
├── supabase/                 # Futuras migrations e funções do backend
└── package.json              # Workspace npm
```

## Preparar o monitor uma vez

Requer Node.js 24+, Python 3.12+ e Expo Go com suporte ao SDK 54.

```powershell
cd tools\dev-monitor
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..\..
```

Copie `apps/mobile/.env.example` para `apps/mobile/.env.local` e troque `IP_DO_COMPUTADOR` pelo IPv4 da rede Wi-Fi. Nesta máquina, o endereço usado no teste é `192.168.1.6`.

## Abrir em celulares e acompanhar

No primeiro terminal, inicie o monitor. As interações recebidas serão impressas neste CMD sem nome, e-mail ou telefone:

```powershell
npm.cmd run monitor
```

Abra o painel somente no computador em `http://127.0.0.1:8000`.

No segundo terminal, inicie o Expo:

```powershell
npm.cmd run start
```

O QR Code aparece nesse terminal; ele não é salvo como arquivo. Leia-o pelo Expo Go. Computador e celulares devem estar na mesma rede. Antes de abrir o app, você pode confirmar no navegador do celular:

```text
http://192.168.1.6:8000/api/health
```

O contador da tela mede os toques da sessão atual do aparelho. O painel mantém a contagem persistida de eventos, sessões ativas e perfis cadastrados.

## Verificações

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
cd tools\dev-monitor
.\.venv\Scripts\python.exe -m pytest
```

Consulte [docs/local-setup.md](docs/local-setup.md) para a preparação completa e o roteiro de teste em dois aparelhos.

