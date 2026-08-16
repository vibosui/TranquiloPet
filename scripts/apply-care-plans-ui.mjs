import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, replacements) {
  let source = await readFile(path, 'utf8');
  for (const { oldValue, newValue, label } of replacements) {
    const first = source.indexOf(oldValue);
    if (first === -1) throw new Error(`${path}: patch target not found: ${label}`);
    if (source.indexOf(oldValue, first + oldValue.length) !== -1) {
      throw new Error(`${path}: patch target is ambiguous: ${label}`);
    }
    source = source.replace(oldValue, newValue);
  }
  await writeFile(path, source, 'utf8');
}

await patchFile('apps/mobile/src/app/(app)/hosting/[eventId].tsx', [
  {
    label: 'plan controls import',
    oldValue: "import { MediatedChatControls } from '@/components/mediated-chat-controls';\n",
    newValue: "import { MediatedChatControls } from '@/components/mediated-chat-controls';\nimport { PlanCareControls } from '@/components/plan-care-controls';\n",
  },
  {
    label: 'plan name import',
    oldValue: "import { supabase } from '@/core/supabase/client';\n",
    newValue: "import { supabase } from '@/core/supabase/client';\nimport { planName } from '@/features/hosting/plans';\n",
  },
  {
    label: 'event pet plan fields',
    oldValue: `type EventPet = {\n  event_id: string;\n  pet_id: string;\n  pet_snapshot: unknown;\n  handoff_snapshot: unknown;\n};`,
    newValue: `type EventPet = {\n  event_id: string;\n  pet_id: string;\n  pet_snapshot: unknown;\n  handoff_snapshot: unknown;\n  plan_code: string;\n  plan_snapshot: unknown;\n};`,
  },
  {
    label: 'event task plan fields',
    oldValue: `  completed_at: string | null;\n  completed_by: string | null;\n};`,
    newValue: `  completed_at: string | null;\n  completed_by: string | null;\n  source: 'custom' | 'photo_request' | 'plan_activity';\n  plan_period_id: string | null;\n};`,
  },
  {
    label: 'task query plan fields',
    oldValue: ".select('id, event_id, pet_id, category, title, instructions, due_at, requires_photo, sort_order, completed_at, completed_by')",
    newValue: ".select('id, event_id, pet_id, category, title, instructions, due_at, requires_photo, sort_order, completed_at, completed_by, source, plan_period_id')",
  },
  {
    label: 'realtime plan media',
    oldValue: `      .on(\n        'postgres_changes',\n        { event: '*', schema: 'public', table: 'chat_messages', filter: \`event_id=eq.\${eventId}\` },\n        refresh,\n      )\n      .subscribe();`,
    newValue: `      .on(\n        'postgres_changes',\n        { event: '*', schema: 'public', table: 'chat_messages', filter: \`event_id=eq.\${eventId}\` },\n        refresh,\n      )\n      .on(\n        'postgres_changes',\n        { event: '*', schema: 'public', table: 'event_plan_media', filter: \`event_id=eq.\${eventId}\` },\n        refresh,\n      )\n      .subscribe();`,
  },
  {
    label: 'plan transition error',
    oldValue: `      if (normalized.includes('unfinished')) {\n        setError('Ainda existem tarefas pendentes no checklist.');\n      } else {\n        setError('Esta mudança de estado não é permitida agora.');\n      }`,
    newValue: `      if (normalized.includes('unfinished')) {\n        setError('Ainda existem tarefas pendentes no checklist.');\n      } else if (normalized.includes('plan obligations')) {\n        setError('Ainda faltam fotos, vídeos ou a atividade obrigatória previstos no plano de um dos pets.');\n      } else {\n        setError('Esta mudança de estado não é permitida agora.');\n      }`,
  },
  {
    label: 'pet plan label',
    oldValue: `<Text style={styles.snapshotHint}>Ver todas as informações do pet</Text>`,
    newValue: `<Text style={styles.snapshotHint}>${'${'}planName(eventPet.plan_code)} • Ver todas as informações do pet</Text>`,
  },
  {
    label: 'protect plan task remove UI',
    oldValue: `{isTutor && event.status === 'draft' ? (\n                  <Pressable accessibilityRole="button" onPress={() => void deleteTask(task.id)}>\n                    <Text style={styles.removeTask}>Remover tarefa</Text>\n                  </Pressable>\n                ) : null}`,
    newValue: `{isTutor && event.status === 'draft' && task.source === 'custom' ? (\n                  <Pressable accessibilityRole="button" onPress={() => void deleteTask(task.id)}>\n                    <Text style={styles.removeTask}>Remover tarefa</Text>\n                  </Pressable>\n                ) : task.source === 'plan_activity' ? (\n                  <Text style={styles.planTaskBadge}>OBRIGATÓRIO PELO PLANO</Text>\n                ) : null}`,
  },
  {
    label: 'insert plan progress section',
    oldValue: `        <SectionCard\n          title="Checklist"`,
    newValue: `        <SectionCard\n          title="Acompanhamento do plano"\n          description="Os mínimos são controlados por pet e por períodos consecutivos de até 24 horas. Fotos de tarefas e solicitações do tutor também contam para o mínimo contratado.">\n          <PlanCareControls\n            eventId={event.id}\n            eventStatus={event.status}\n            isCaregiver={isCaregiver}\n            pets={eventPets}\n            onChanged={() => loadEvent(false)}\n          />\n        </SectionCard>\n\n        <SectionCard\n          title="Checklist"`,
  },
  {
    label: 'plan task badge style',
    oldValue: `  removeTask: {\n    color: colors.error,`,
    newValue: `  planTaskBadge: {\n    alignSelf: 'flex-start',\n    color: colors.primary,\n    fontSize: 9,\n    fontWeight: '900',\n    letterSpacing: 0.6,\n  },\n  removeTask: {\n    color: colors.error,`,
  },
]);

await patchFile('apps/mobile/src/app/(app)/(tabs)/profile/index.tsx', [
  {
    label: 'caregiver settings card',
    oldValue: `      <SectionCard title="Dados da conta">`,
    newValue: `      {profile.caregiver_enabled ? (\n        <SectionCard\n          title="Disponibilidade como cuidador"\n          description="Defina quais planos você oferece, em quais dias está disponível, sua janela de recebimento/entrega e se aceita estadias acima de 24 horas.">\n          <PrimaryButton label="Configurar planos e disponibilidade" onPress={() => router.push('/profile/caregiving')} />\n        </SectionCard>\n      ) : null}\n\n      <SectionCard title="Dados da conta">`,
  },
]);

await patchFile('apps/mobile/src/app/(app)/(tabs)/index.tsx', [
  {
    label: 'home mediated copy',
    oldValue: `Rotina, checklist, fotos e conversa ficam ligados ao mesmo evento para tutor e cuidador saberem exatamente o que aconteceu.`,
    newValue: `Rotina, checklist, fotos e comunicação mediada ficam ligados ao mesmo evento para tutor e cuidador saberem exatamente o que aconteceu.`,
  },
  {
    label: 'home primary plan first CTA',
    oldValue: `<PrimaryButton label="Adicionar contato" onPress={() => router.push('/contacts')} />`,
    newValue: `<PrimaryButton label="Encontrar cuidador" onPress={() => router.push('/hosting/new')} />`,
  },
  {
    label: 'home section description',
    oldValue: `description="O MVP agora parte da relação entre duas pessoas e do evento de hospedagem."`,
    newValue: `description="Para uma nova hospedagem, escolha primeiro o nível de acompanhamento e o período. Depois mostramos cuidadores compatíveis."`,
  },
]);

await patchFile('apps/mobile/src/app/(app)/contacts/index.tsx', [
  {
    label: 'contacts history copy',
    oldValue: `description="As hospedagens e chats ficarão agrupados por cada pessoa."`,
    newValue: `description="As conexões permanecem úteis para histórico e futuras hospedagens, mas uma nova busca sempre começa pelo plano."`,
  },
  {
    label: 'preferred caregiver param',
    oldValue: `params: { connectionId: connection.id },`,
    newValue: `params: { caregiverId: profile?.id },`,
  },
  {
    label: 'preferred caregiver button copy',
    oldValue: `<Text style={styles.hostingButtonText}>Criar hospedagem com este cuidador</Text>`,
    newValue: `<Text style={styles.hostingButtonText}>Ver disponibilidade deste cuidador</Text>`,
  },
]);

console.log('Care plan UI wiring applied.');
