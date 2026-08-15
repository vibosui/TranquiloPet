# Tranquilo Pet

MVP mobile para conectar tutores de pets a cuidadores. O fluxo atual é um laboratório offline com login de demonstração, perfis e pets, preparado para Expo Go SDK 54 e para acompanhamento opcional no computador.

## O que já funciona

- aplicativo Expo SDK 54 com a identidade **Tranquilo Pet**;
- acesso local por conta de demonstração, sem armazenar senha ou token;
- uma identidade de usuário que pode ativar os papéis de tutor e cuidador;
- cadastro, consulta e edição dos perfis de tutor e cuidador;
- área **Meus pets**, cadastro/edição, cuidados especiais e análise comportamental;
- foto principal e até cinco fotos adicionais, escolhidas somente da galeria e copiadas para o armazenamento persistente do app no Android/iOS;
- autocomplete offline de 27 UFs e 5.571 municípios do IBGE;
- 10 usuários, 5 tutores, 5 cuidadores e 20 pets fictícios semeados localmente;
- monitor Python local com FastAPI e SQLite;
- eventos sanitizados no CMD e painel web atualizado ao vivo;
- suporte a Expo Tunnel para testar o app fora da rede local;
- suporte a URL HTTPS do ngrok para enviar telemetria ao monitor fora da LAN;
- testes automatizados mobile e Python.

O login e o banco do aplicativo são implementações locais de desenvolvimento em AsyncStorage. O monitor continua sendo apenas uma ferramenta opcional de telemetria. O backend real será Supabase; não use dados reais, nem trate esta autenticação local como segurança de produção.

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

## Preparar o projeto

Requer Node.js 24+, Python 3.12+ e Expo Go com suporte ao SDK 54.

```powershell
npm.cmd install
```

O Python é necessário somente para acompanhar eventos no painel. Para prepará-lo uma vez:

```powershell
cd tools\dev-monitor
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..\..
```

Para usar somente a rede local com o monitor, copie `apps/mobile/.env.example` para `apps/mobile/.env.local` e troque `IP_DO_COMPUTADOR` pelo IPv4 da rede Wi-Fi.

## Abrir em celulares pela rede local

```powershell
npm.cmd run start
```

O QR Code aparece nesse terminal; ele não é salvo como arquivo. Leia-o pelo Expo Go. No login, selecione qualquer conta de `demo01@tranquilopet.local` a `demo10@tranquilopet.local`.

Os dados são independentes em cada aparelho e permanecem no armazenamento local do Expo Go. No Android e iOS, fotos escolhidas são copiadas para o diretório persistente do app; ainda não há upload ou sincronização entre aparelhos.

## Abrir em celulares pela internet com Expo Tunnel

Use este modo quando o celular não estiver na mesma rede do computador ou quando a rede bloquear conexões LAN. O Expo possui suporte nativo a tunnel via ngrok.

Instale uma vez o adaptador recomendado pelo Expo:

```powershell
npm.cmd install -g @expo/ngrok
```

Depois, na raiz do projeto:

```powershell
npm.cmd run start:tunnel
```

O Expo inicia com `expo start --tunnel` e mostra um QR Code acessível pelo Expo Go através da internet. Nesse modo o celular não precisa estar conectado ao mesmo Wi-Fi do computador.

O app continua funcionando porque os dados atuais são locais em AsyncStorage. O tunnel do Expo publica somente o Metro; ele não publica automaticamente o monitor FastAPI da porta 8000.

## Acompanhar interações no computador pela LAN

No primeiro terminal, inicie o monitor:

```powershell
npm.cmd run monitor
```

Abra o painel no computador em `http://127.0.0.1:8000`.

No segundo terminal, inicie o Expo:

```powershell
npm.cmd run start
```

Computador e celulares devem estar na mesma rede. Antes de abrir o app, confirme no navegador do celular usando `http://IP_DO_COMPUTADOR:8000/api/health`.

## Acompanhar interações usando ngrok

Este modo publica a API do monitor separadamente do tunnel do Expo. Ele é útil quando o celular está fora da LAN ou quando a rede bloqueia acesso direto à porta 8000.

1. Inicie o monitor FastAPI:

```powershell
npm.cmd run monitor
```

2. Em outro terminal, usando o ngrok CLI oficial já autenticado, publique a porta 8000:

```powershell
ngrok http 8000
```

3. Copie a URL HTTPS exibida pelo ngrok, por exemplo `https://exemplo.ngrok.app`, e coloque em `apps/mobile/.env.local`:

```text
EXPO_PUBLIC_MONITOR_API_URL=https://exemplo.ngrok.app
```

4. Reinicie o Expo para que a variável seja recarregada:

```powershell
npm.cmd run start:tunnel
```

5. O painel continua local no computador em `http://127.0.0.1:8000`; o endpoint público serve apenas para o aplicativo enviar eventos ao FastAPI.

As requisições do monitor enviam o header `ngrok-skip-browser-warning`, permitindo o uso do endpoint de desenvolvimento do ngrok sem receber a página intermediária no lugar da resposta JSON.

O CMD e o painel mostram login, consultas e salvamentos sem receber nome, e-mail, telefone, CPF, observações ou fotos.

Não use ngrok ou o monitor como backend de produção. Quando o Supabase entrar no projeto, ele será o endpoint remoto compartilhado entre os aparelhos.

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
