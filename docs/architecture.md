# Arquitetura inicial

## Decisão do MVP

O produto será mantido em um monorepositório simples com:

- aplicativo React Native com Expo e TypeScript;
- backend real futuro no Supabase (PostgreSQL, Auth, Storage e Edge Functions);
- integração com Mercado Pago isolada no backend;
- monitor Python local descartável para observar os primeiros testes em celulares.

Não haverá microsserviços nem um backend Python de produção. `tools/dev-monitor` existe somente para o laboratório local e será substituído pelo adaptador do Supabase nos fluxos reais.

## Fluxo do laboratório atual

```text
Expo Go ──HTTP na LAN──> FastAPI ──transação──> SQLite local
                              ├──> log sanitizado no CMD
                              └──> SSE ──> painel no navegador
```

O banco só é confirmado antes de a atualização ser publicada. Eventos não carregam os valores digitados, e os contatos exibidos no painel são mascarados. O dashboard, a documentação da API e os dados de leitura aceitam somente conexões de loopback; os celulares podem acessar apenas saúde e ingestão.

## Organização atual do app

```text
apps/mobile/src/
├── app/                         # Rotas do Expo Router
│   ├── _layout.tsx
│   ├── index.tsx
│   └── tutor/register.tsx
├── components/                  # Controles de UI reutilizáveis
├── config/                      # Configuração pública de desenvolvimento
├── features/
│   ├── analytics/               # Telemetria local best-effort
│   └── tutors/
│       ├── api/                 # Adaptador HTTP substituível
│       └── domain/              # Validação e normalização puras
└── theme/                       # Tokens visuais
```

Testes ficam fora de `src/app`, pois qualquer arquivo nessa pasta pode ser interpretado como rota pelo Expo Router.

## Limites de responsabilidade

### Aplicativo mobile

- telas, navegação, feedback e acessibilidade;
- validação imediata para a experiência do usuário;
- chamadas aos adaptadores de infraestrutura;
- telemetria que nunca bloqueia o fluxo principal.

O aplicativo nunca será autoridade final para autorização, preços, comissões ou pagamentos.

### Backend real

- autenticação e autorização por recurso com RLS;
- validações de integridade e transições de estado;
- dados públicos e privados separados;
- valores financeiros, idempotência e webhooks oficiais.

### Monitor local

- recebe somente dados fictícios durante desenvolvimento;
- persiste em `%LOCALAPPDATA%\TranquiloPet\dev-monitor` fora do OneDrive;
- usa um único processo Uvicorn e SQLite;
- não possui autenticação, TLS ou garantias de produção.

## Ambientes

- `local`: Expo Go, testes automatizados e monitor descartável;
- `staging`: celulares reais, Supabase de teste e pagamentos sandbox;
- `production`: usuários, TLS, autenticação e credenciais reais.

