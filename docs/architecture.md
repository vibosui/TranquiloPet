# Arquitetura inicial

## Decisão

O MVP será um monorepositório simples contendo:

- um aplicativo React Native com Expo e TypeScript;
- um backend Supabase com PostgreSQL, Auth, Storage e Edge Functions;
- integração com Mercado Pago isolada em funções server-side.

Não haverá backend Node separado ou microsserviços no início. Uma camada adicional só deve ser criada quando houver uma necessidade concreta que as Edge Functions não atendam bem.

## Limites de responsabilidade

### Aplicativo mobile

- telas, navegação e feedback visual;
- estado de interface e cache de consultas;
- validação rápida para experiência do usuário;
- chamadas autenticadas ao Supabase e às Edge Functions;
- integração isolada com recursos do aparelho.

O aplicativo nunca é a autoridade final para autorização, preços, comissões ou pagamentos.

### Banco e backend

- autorização por recurso usando Row Level Security;
- validações de integridade e transições de estado;
- cálculo e registro dos valores financeiros;
- processamento idempotente de webhooks;
- separação entre dados públicos e privados;
- auditoria dos estados de solicitações e pagamentos.

## Organização planejada do app

```text
apps/mobile/
├── app/                    # Rotas do Expo Router
├── src/
│   ├── components/         # UI reutilizável
│   ├── domain/             # Regras puras e tipos do domínio
│   ├── features/           # auth, pets, busca, reservas etc.
│   ├── infrastructure/     # Supabase e APIs externas
│   ├── services/           # Casos de uso/orquestração
│   ├── hooks/
│   ├── theme/
│   ├── utils/
│   └── test/
└── assets/
```

Pastas serão adicionadas conforme forem necessárias. Não criaremos arquivos vazios para antecipar funcionalidades ainda inexistentes.

## Ambientes

- `local`: testes automatizados e banco local quando necessário;
- `staging`: celulares reais, dados fictícios e pagamentos sandbox;
- `production`: usuários e credenciais reais.

No primeiro teste visual não haverá backend. Em seguida, o app poderá apontar para um projeto Supabase de staging, o que simplifica testes em celulares na mesma etapa em que o schema local é versionado.

