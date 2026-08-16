import { readFile, writeFile } from 'node:fs/promises';

const path = 'apps/mobile/src/app/(app)/hosting/[eventId].tsx';
let source = await readFile(path, 'utf8');

function replaceOnce(oldValue, newValue, label) {
  const first = source.indexOf(oldValue);
  if (first === -1) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(oldValue, first + oldValue.length) !== -1) {
    throw new Error(`Patch target is ambiguous: ${label}`);
  }
  source = source.replace(oldValue, newValue);
}

replaceOnce(
  "import { ErrorBanner } from '@/components/error-banner';\n",
  "import { ErrorBanner } from '@/components/error-banner';\nimport { IncidentControls } from '@/components/incident-controls';\n",
  'incident controls import',
);

replaceOnce(
`    | 'preset_question'
    | 'preset_answer'
    | 'photo_request';
  body: string | null;
  task_id: string | null;
  evidence_id: string | null;
  preset_key: string | null;
  reply_to_message_id: string | null;
  created_at: string;`,
`    | 'preset_question'
    | 'preset_answer'
    | 'photo_request'
    | 'incident_reported'
    | 'incident_update';
  body: string | null;
  task_id: string | null;
  evidence_id: string | null;
  preset_key: string | null;
  reply_to_message_id: string | null;
  pet_id: string | null;
  created_at: string;`,
  'chat incident types',
);

replaceOnce(
  ".select('id, event_id, sender_id, message_type, body, task_id, evidence_id, preset_key, reply_to_message_id, created_at')",
  ".select('id, event_id, sender_id, message_type, body, task_id, evidence_id, preset_key, reply_to_message_id, pet_id, created_at')",
  'chat pet id select',
);

replaceOnce(
`        <SectionCard
          title="Comunicação e registro do evento"
          description="A comunicação é mediada pelo Hospeda Patas. Perguntas, respostas, fotos e alterações de estado ficam vinculadas a esta hospedagem.">`,
`        <SectionCard
          title="Ocorrências durante a hospedagem"
          description="Situações fora da rotina são registradas por categorias e atualizações pré-definidas, sem abrir texto livre.">
          <IncidentControls
            eventId={event.id}
            eventStatus={event.status}
            userId={user?.id ?? null}
            isTutor={isTutor}
            isCaregiver={isCaregiver}
            messages={messages}
            pets={eventPets}
            busy={busy}
            onChanged={() => loadEvent(false)}
          />
        </SectionCard>

        <SectionCard
          title="Comunicação e registro do evento"
          description="A comunicação é mediada pelo Hospeda Patas. Perguntas, respostas, fotos, ocorrências e alterações de estado ficam vinculadas a esta hospedagem.">`,
  'incident section insertion',
);

await writeFile(path, source, 'utf8');
console.log('Incident controls wired into hosting event screen.');
