# Hospeda Patas

Aplicativo mobile para organizar hospedagens de pets com transparência entre tutor e cuidador. O produto centraliza o dossiê do pet, a preparação da entrega, checklist do cuidado, evidências fotográficas e conversa de cada hospedagem.

> **Cuidado que acolhe. Confiança que fica.**

## Fundação atual

A branch `agent/hospeda-patas-foundation` substitui o antigo laboratório offline por uma arquitetura compartilhada entre aparelhos:

- Expo / React Native com Expo Router;
- identidade visual caramelo do **Hospeda Patas**;
- Supabase Auth para contas reais;
- PostgreSQL + Row Level Security como fonte de verdade;
- código permanente por usuário no formato `HP-XXXXXX`;
- conexão entre usuários por código, com estrutura pronta para solicitação/aceite e aceite automático no MVP;
- usuário podendo atuar como tutor, cuidador ou ambos;
- dossiê persistente **Conheça meu Pet**;
- hospedagens separadas por evento;
- snapshot do dossiê no momento da criação da hospedagem;
- registro de entrega específico de cada evento;
- checklist com tarefas únicas, horários específicos ou intervalos recorrentes;
- tarefas que podem exigir foto antes da conclusão;
- fotos de entrega e evidências em buckets privados do Supabase Storage;
- chat e registros automáticos vinculados a cada hospedagem;
- máquina de estados da hospedagem validada no banco;
- tabelas de Realtime e notificações preparadas para sincronização entre aparelhos;
- GitHub Actions executando TypeScript, ESLint e Jest.

Os dados funcionais **não usam mais AsyncStorage como banco do produto**. O armazenamento local é utilizado apenas para persistir a sessão de autenticação do Supabase.

## Identidade visual

A cor principal é o caramelo `#9E3F0A`. O laranja é apenas acento.

```text
#3A1500  espresso / títulos e contraste profundo
#6A2600  cocoa / apoio
#7E2D00  caramelo escuro / estados pressionados
#9E3F0A  caramelo principal / marca e ações primárias
#FF7325  acento quente / destaques pontuais
#000000  preto
#FFFFFF  branco / superfícies
```

## Modelo de produto

### Identidade e contatos

Cada usuário recebe um código permanente `HP-XXXXXX`. Ao informar o código de outra pessoa, é criada uma conexão. A tabela já suporta `pending`, `accepted`, `rejected` e `blocked`; durante a validação inicial, a conexão é aceita automaticamente.

### Dossiê do pet

O dossiê reúne dados que tendem a permanecer válidos entre hospedagens:

1. identificação;
2. comportamento e personalidade;
3. alimentação;
4. água;
5. passeios;
6. rotina;
   - 6.1 higiene e necessidades: hábito de xixi/cocô, local habitual, acidentes, sinais e frequência;
7. brinquedos e objetos de apego;
8. saúde;
   - 8.1 vacinação e prevenção: situação vacinal, doses, vermífugo e antipulgas/carrapatos;
9. medicamentos;
10. contatos e autorização de emergência;
11. observações adicionais.

A estrutura do dossiê está atualmente na versão `2`. Quando uma hospedagem é criada, o estado atual do dossiê é copiado para um snapshot do evento. Alterações posteriores no perfil do pet não reescrevem o histórico de uma hospedagem passada.

### Preparação da hospedagem

Itens enviados, estado do pet no momento da entrega e fotos pré-hospedagem pertencem ao evento, não ao dossiê permanente. O tutor registra, por pet:

- itens e quantidades enviados;
- data/horário do registro;
- estado do pet na entrega;
- observações;
- foto do rosto;
- foto do corpo inteiro;
- laterais, característica específica e acessórios quando necessário.

Rosto e corpo inteiro são obrigatórios no fluxo atual para marcar a entrega como preparada. O cuidador não consegue iniciar a hospedagem enquanto todos os pets do evento não estiverem preparados.

### Checklist e evidências

O tutor pode criar tarefas de refeição, água, passeio, medicamento, foto, rotina ou uma tarefa personalizada. Cada tarefa pode ser gerada para:

- um único horário;
- vários horários específicos;
- um intervalo fixo entre duas datas/horários.

Quando `requires_photo=true`, o cuidador precisa registrar uma foto antes de concluir a tarefa. A conclusão também cria um registro na linha do tempo/chat da hospedagem.

### Estados

```text
draft → sent → accepted → in_progress → completed
   └────────────── cancelamento permitido conforme o participante/estado
```

As transições são validadas por funções do banco; o cliente não altera o estado diretamente.

## Backend

O MVP está conectado a um projeto Supabase em `sa-east-1`.

As variáveis públicas ficam em `apps/mobile/.env.example`. A chave `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` é apropriada para o cliente; a segurança dos dados depende das políticas RLS e das funções controladas no banco. Nunca coloque uma `service_role`/secret key no aplicativo.

Buckets privados atuais:

```text
avatars
pet-media
event-media       # fotos da preparação/entrega
event-evidence    # fotos exigidas pelo checklist
```

## Estrutura

```text
.
├── apps/mobile/              # aplicativo Expo / React Native
├── tools/dev-monitor/        # ferramenta local de telemetria; não é backend do produto
├── docs/
├── scripts/
├── supabase/                 # migrations/artefatos versionados do backend
└── .github/workflows/        # CI mobile
```

## Instalar

Requer Node.js 24+ e Expo Go compatível com SDK 54.

Na raiz:

```powershell
npm.cmd install
```

## Reset de dados de desenvolvimento

Existe uma rotina administrativa **somente para desenvolvimento**. Ela preserva schema, migrations, funções, RLS e buckets, mas esvazia os buckets do MVP e remove todos os usuários; as cascatas do banco removem perfis, pets, contatos, hospedagens, tarefas, chats, evidências e notificações relacionados.

Na primeira utilização, copie o template:

```powershell
Copy-Item .env.reset.example .env.reset.local
```

Edite `.env.reset.local`, informe uma `SUPABASE_SECRET_KEY` de backend e altere a trava para:

```text
HOSPEDA_PATAS_ALLOW_DB_RESET=YES
```

A secret key é obtida no painel do Supabase em **Settings > API Keys** e nunca deve ser colocada em `EXPO_PUBLIC_*`, no app mobile ou em commit. O arquivo `.env.reset.local` é ignorado pelo Git.

Comandos disponíveis:

```powershell
npm.cmd run db:reset
npm.cmd run start:clean
npm.cmd run start:tunnel:clean
```

`db:reset` apenas limpa os dados. `start:clean` limpa e inicia o Expo local; `start:tunnel:clean` limpa e inicia pelo tunnel. Antes de apagar, o script exige a frase `LIMPAR HOSPEDA PATAS` e também recusa execução caso a URL configurada não pertença ao project ref `inenqyqkfpczotnlimkf`.

## Executar pela internet

Para testar em celulares que não estão na mesma rede do computador:

```powershell
npm.cmd run start:tunnel
```

O Expo inicia o Metro com tunnel e exibe um QR Code `exp://...exp.direct`. Abra pelo Expo Go. O computador precisa permanecer ligado e com o processo do Expo em execução.

O Supabase é remoto; portanto, tutor e cuidador podem usar redes diferentes e compartilhar os mesmos dados.

## Roteiro de teste em dois aparelhos

1. Crie uma conta **A** e mantenha o papel de Tutor ativo.
2. Crie uma conta **B** e ative o papel de Cuidador em **Perfil**.
3. Na conta B, copie o código `HP-XXXXXX`.
4. Na conta A, abra **Contatos** e adicione B pelo código.
5. Em A, cadastre um pet e abra seu dossiê.
6. Em A, abra o contato B e escolha **Criar hospedagem com este cuidador**.
7. Selecione pet, período e crie o rascunho.
8. Faça o registro de entrega, incluindo rosto e corpo inteiro.
9. Volte à hospedagem e monte o checklist.
10. Envie a hospedagem ao cuidador.
11. Em B, abra **Hospedagens**, entre no evento e aceite.
12. B inicia a hospedagem após o registro de entrega estar preparado.
13. B conclui tarefas; tarefas com foto abrem a câmera e exigem evidência.
14. Use o chat do evento nos dois aparelhos.
15. Com todas as tarefas concluídas, B encerra a hospedagem.

## Notificações

A camada de banco já possui `notifications` e cria registros para mensagens, fotos, tarefas concluídas e alterações de estado. As tabelas centrais também estão na publicação do Supabase Realtime.

Próximas etapas:

- inscrição Realtime no cliente para atualizar chat/checklist sem refresh manual;
- central de chats por contato quando houver mais de uma hospedagem;
- persistência do último evento selecionado;
- registro do Expo Push Token;
- Supabase Edge Function para push remoto;
- development build do Expo para validar push remoto no Android.

## Validação automática

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

O workflow `.github/workflows/mobile-ci.yml` executa os mesmos passos em Node 24 a cada push para `main` e branches `agent/**`.

## Monitor local

`tools/dev-monitor` continua disponível apenas como ferramenta auxiliar de desenvolvimento. Ele não é necessário para o funcionamento do app, não deve ser exposto como backend do produto e pode permanecer acessível somente no computador local.