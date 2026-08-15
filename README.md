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

Copie `apps/mobile/.env.example` para `apps/mobile/.env.local` e troque `IP_DO_COMPUTADOR` pelo IPv4 da rede Wi-Fi. Nesta máquina, o endereço usado no teste é `192.168.1.6`.

## Abrir em celulares

O app funciona sem monitor:

```powershell
npm.cmd run start
```

O QR Code aparece nesse terminal; ele não é salvo como arquivo. Leia-o pelo Expo Go. No login, selecione qualquer conta de `demo01@tranquilopet.local` a `demo10@tranquilopet.local`.

Os dados são independentes em cada aparelho e permanecem no armazenamento local do Expo Go. No Android e iOS, fotos escolhidas são copiadas para o diretório persistente do app; ainda não há upload ou sincronização entre aparelhos.

## Acompanhar interações no computador

No primeiro terminal, inicie o monitor. As interações recebidas serão impressas neste CMD sem nome, e-mail ou telefone:

```powershell
npm.cmd run monitor
```

Abra o painel somente no computador em `http://127.0.0.1:8000`.

No segundo terminal, inicie o Expo caso ainda não esteja aberto:

```powershell
npm.cmd run start
```

Computador e celulares devem estar na mesma rede. Antes de abrir o app, você pode confirmar no navegador do celular:

```text
http://192.168.1.6:8000/api/health
```

O CMD e o painel mostram login, consultas e salvamentos sem receber nome, e-mail, telefone, CPF, observações ou fotos.

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
