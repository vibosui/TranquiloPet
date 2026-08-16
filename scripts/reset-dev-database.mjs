import { existsSync } from 'node:fs';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_PROJECT_REF = 'inenqyqkfpczotnlimkf';
const RESET_CONFIRMATION = 'LIMPAR HOSPEDA PATAS';
const ENV_FILE = '.env.reset.local';
const BUCKETS = ['avatars', 'pet-media', 'event-media', 'event-evidence', 'event-updates'];
const TABLES_TO_VERIFY = [
  'profiles',
  'tutor_profiles',
  'caregiver_profiles',
  'caregiver_service_profiles',
  'caregiver_plan_options',
  'caregiver_availability_windows',
  'pets',
  'pet_photos',
  'connections',
  'hosting_events',
  'hosting_event_pets',
  'event_plan_periods',
  'event_plan_media',
  'event_tasks',
  'task_evidence',
  'chat_messages',
  'contact_chat_preferences',
  'device_push_tokens',
  'notifications',
];

function loadLocalEnvironment() {
  if (!existsSync(ENV_FILE)) return;
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (error) {
    throw new Error(`Não foi possível carregar ${ENV_FILE}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requireConfiguration() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const adminKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const resetAllowed = process.env.HOSPEDA_PATAS_ALLOW_DB_RESET === 'YES';

  if (!supabaseUrl) {
    throw new Error(`SUPABASE_URL não configurada. Copie .env.reset.example para ${ENV_FILE}.`);
  }
  if (!adminKey) {
    throw new Error('Configure SUPABASE_SECRET_KEY (recomendado) ou SUPABASE_SERVICE_ROLE_KEY somente no arquivo local de reset.');
  }
  if (!resetAllowed) {
    throw new Error(`HOSPEDA_PATAS_ALLOW_DB_RESET precisa ser exatamente YES em ${ENV_FILE}.`);
  }

  const parsedUrl = new URL(supabaseUrl);
  const projectRef = parsedUrl.hostname.split('.')[0];
  if (projectRef !== EXPECTED_PROJECT_REF) {
    throw new Error(`Reset recusado: o projeto configurado é ${projectRef}, mas este script aceita apenas ${EXPECTED_PROJECT_REF}.`);
  }

  return { supabaseUrl, adminKey };
}

async function confirmReset() {
  if (process.argv.includes('--yes')) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\n⚠️  RESET DE DESENVOLVIMENTO — HOSPEDA PATAS');
    console.log(`Projeto permitido: ${EXPECTED_PROJECT_REF}`);
    console.log('Serão removidos usuários, perfis, pets, contatos, hospedagens, chats, checklist, notificações e arquivos dos buckets do MVP.');
    console.log('Schema, migrations, catálogos, funções, RLS e buckets serão preservados.\n');
    const answer = await rl.question(`Digite exatamente "${RESET_CONFIRMATION}" para continuar: `);
    if (answer.trim() !== RESET_CONFIRMATION) {
      throw new Error('Reset cancelado: confirmação não confere.');
    }
  } finally {
    rl.close();
  }
}

async function emptyStorage(supabase) {
  for (const bucket of BUCKETS) {
    const { error } = await supabase.storage.emptyBucket(bucket);
    if (error) throw new Error(`Falha ao limpar bucket ${bucket}: ${error.message}`);
    console.log(`✓ Storage limpo: ${bucket}`);
  }
}

async function deleteAllUsers(supabase) {
  let removed = 0;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(`Falha ao listar usuários: ${error.message}`);

    const users = data.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(`Falha ao apagar usuário ${user.id}: ${deleteError.message}`);
      removed += 1;
    }
  }

  console.log(`✓ Usuários removidos: ${removed}`);
}

async function verifyReset(supabase) {
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (usersError) throw new Error(`Falha ao verificar Auth: ${usersError.message}`);
  if ((usersData.users ?? []).length > 0) throw new Error('A verificação encontrou usuários restantes no Auth.');

  for (const table of TABLES_TO_VERIFY) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Falha ao verificar ${table}: ${error.message}`);
    if ((count ?? 0) !== 0) throw new Error(`A tabela ${table} ainda contém ${count} registro(s).`);
  }

  console.log('✓ Verificação concluída: dados funcionais zerados. Catálogos de planos/mensagens permanecem disponíveis.');
}

async function main() {
  loadLocalEnvironment();
  const { supabaseUrl, adminKey } = requireConfiguration();
  await confirmReset();

  const supabase = createClient(supabaseUrl, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  console.log('\nLimpando Storage...');
  await emptyStorage(supabase);

  console.log('Limpando usuários e dados relacionados...');
  await deleteAllUsers(supabase);

  console.log('Verificando resultado...');
  await verifyReset(supabase);

  console.log('\n✅ Hospeda Patas voltou ao estado de dados vazio.\n');
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
