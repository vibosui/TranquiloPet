# Banco de dados

## Estratégia

O PostgreSQL será administrado pelo Supabase. Toda mudança de schema deve existir em uma migration versionada; alterações manuais no painel remoto devem ser evitadas.

O arquivo `supabase/config.toml` será criado pela Supabase CLI. Dados de desenvolvimento reproduzíveis ficarão em `supabase/seed.sql`.

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

