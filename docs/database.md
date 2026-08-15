# Banco de dados

## Estratégia

O PostgreSQL será administrado pelo Supabase. Toda mudança de schema deve existir em uma migration versionada; alterações manuais no painel remoto devem ser evitadas.

O arquivo `supabase/config.toml` será criado pela Supabase CLI. Dados de desenvolvimento reproduzíveis ficarão em `supabase/seed.sql`.

O SQLite do `tools/dev-monitor` não é o banco do produto e não terá migrations de domínio. Ele guarda somente telemetria e registros legados do laboratório em `%LOCALAPPDATA%\TranquiloPet\dev-monitor\monitor.sqlite3`.

O app usa temporariamente duas chaves locais:

- `@tranquilo-pet/dev/database/v1`: usuários, perfis e pets fictícios;
- `@tranquilo-pet/dev/session/v1`: apenas modo, ID do usuário e data de entrada.

Senha, token e credenciais não são persistidos. AsyncStorage não é criptografado nem compartilhado entre aparelhos; essa camada existe somente para testar UX offline. No Android/iOS, as imagens ficam no diretório persistente do app e o JSON guarda somente suas URIs. O adaptador futuro trocará os contratos por Supabase Auth, PostgreSQL e Storage.

Seed idempotente atual: 10 usuários, 5 perfis de tutor, 5 de cuidador e 20 pets (dois por usuário). O usuário 05 exerce ambos os papéis.

## Conjuntos iniciais de dados

- identidade: `profiles`;
- perfil de cuidador: `caregiver_profiles` e `caregiver_private_data`;
- pets: `pets`;
- serviços e disponibilidade: `service_types`, `caregiver_services` e `caregiver_availability`;
- contratação: `bookings` e `booking_status_history`;
- pagamentos: `payments` e `payment_events`;
- reputação: `reviews`.

Essas tabelas são um mapa inicial, não um schema definitivo. Colunas, constraints, índices e políticas RLS serão definidos junto com o primeiro fluxo funcional, evitando um banco grande sem código que o valide.

## Regras obrigatórias

- O mesmo usuário pode ter perfil de tutor e cuidador.
- CPF, endereço exato e dados financeiros não podem ser consultados publicamente.
- Toda tabela exposta pela API deve ter RLS habilitado e políticas testadas.
- Valores monetários usam unidades inteiras de centavos, nunca ponto flutuante.
- Comissão é configurável e o valor aplicado é congelado na contratação.
- Mudanças de estado da contratação devem ser validadas e auditadas.
- Webhooks e criação de pagamentos devem usar chaves de idempotência.
- O retorno do aplicativo não confirma um pagamento; o backend consulta/recebe o estado oficial do provedor.
