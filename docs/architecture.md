# Arquitetura inicial

## Decisão do MVP

O produto será mantido em um monorepositório simples com:

- aplicativo React Native com Expo e TypeScript;
- backend real futuro no Supabase (PostgreSQL, Auth, Storage e Edge Functions);
- integração com Mercado Pago isolada no backend;
- monitor Python local descartável para observar os primeiros testes em celulares.

Não haverá microsserviços nem um backend Python de produção. `tools/dev-monitor` existe somente para o laboratório local e será substituído pelo adaptador do Supabase nos fluxos reais.

## Fluxos do laboratório atual

```text
Expo Go ──AsyncStorage──> banco local versionado por aparelho
   │
   └──telemetria opcional na LAN──> FastAPI ──> SQLite do monitor
                                          ├──> log sanitizado no CMD
                                          └──> SSE ──> painel no navegador
```

Cadastros e sessão não dependem do monitor. Eventos não carregam valores digitados. O dashboard, a documentação da API e os dados de leitura aceitam somente loopback; os celulares podem acessar apenas saúde e ingestão.

O banco local é deliberadamente limitado ao desenvolvimento: não possui autenticação real, compartilhamento entre aparelhos nem upload de fotos. No Android e iOS, o adaptador de mídia copia as imagens escolhidas para o diretório persistente do app antes de salvar suas URIs. Interfaces de repositório preservam a futura troca por Supabase.

## Organização atual do app

```text
apps/mobile/src/
├── app/                         # Rotas do Expo Router
│   ├── _layout.tsx
│   ├── (auth)/                  # Login e criação de conta local
│   └── (app)/                   # Rotas protegidas, tabs, perfis e pets
├── components/                  # Controles de UI reutilizáveis
├── core/
│   ├── domain/                  # User, papéis, pets e contratos
│   ├── data/                    # AsyncStorage e dados-semente
│   └── state/                   # Sessão e autorização local
├── config/                      # Configuração pública de desenvolvimento
├── features/
│   ├── analytics/               # Telemetria local best-effort
│   ├── caregivers/              # Formulário e opções do cuidador
│   ├── locations/               # Snapshot oficial IBGE e autocomplete
│   ├── media/                   # Persistência local de fotos escolhidas
│   ├── pets/                    # Cadastro e análise comportamental
│   └── tutors/                  # Perfil de tutor
└── theme/                       # Tokens visuais
```

Testes ficam fora de `src/app`, pois qualquer arquivo nessa pasta pode ser interpretado como rota pelo Expo Router.

## Limites de responsabilidade

### Aplicativo mobile

- telas, navegação, feedback e acessibilidade;
- validação imediata para a experiência do usuário;
- chamadas aos adaptadores de infraestrutura;
- telemetria que nunca bloqueia o fluxo principal.

O mesmo `User` referencia `TutorProfile`, `CaregiverProfile` e pets. A existência dos perfis determina os papéis; não há contas duplicadas por papel.

Recursos mantidos desligados nesta fase: câmera, upload remoto, GPS preciso, notificações, tarefas em segundo plano, pagamento e autenticação de produção.

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
