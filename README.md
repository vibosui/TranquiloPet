# Pet Marketplace

MVP mobile para conectar tutores de pets a cuidadores disponíveis.

## Estado atual

O aplicativo de teste Expo está disponível em `apps/mobile`. O Supabase será inicializado quando começarmos o primeiro fluxo com persistência.

## Estrutura

```text
.
├── apps/mobile/          # Aplicativo Expo/React Native
├── docs/                 # Decisões técnicas e guias
├── scripts/              # Utilitários locais
├── supabase/             # Banco, funções e testes do backend
├── .env.example          # Nomes de variáveis, sem segredos
└── package.json          # Raiz privada do workspace npm
```

## Executar no celular

Instale o Expo Go, deixe computador e celular na mesma rede Wi-Fi e execute na raiz:

```powershell
npm.cmd run start
```

Escaneie o QR Code exibido no terminal usando o Expo Go.

## Verificações

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
npm.cmd run typecheck
npm.cmd run lint
```

Consulte [docs/local-setup.md](docs/local-setup.md) para preparar emuladores, builds nativos e banco local nas próximas fases.

## Princípios

- Um usuário pode atuar como tutor e cuidador.
- Regras de negócio e dados sensíveis não ficam em componentes visuais.
- Preços, comissões, autorização e estado de pagamentos são decididos no backend.
- Alterações no banco são versionadas em migrations.
- O MVP prioriza fluxos simples, testáveis e executáveis em celulares reais.

