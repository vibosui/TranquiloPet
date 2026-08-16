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
  "import { ErrorBanner } from '@/components/error-banner';\nimport { MediatedChatControls } from '@/components/mediated-chat-controls';\n",
  'mediated chat import',
);

replaceOnce(
  "  message_type: 'text' | 'system' | 'task_completed' | 'photo_evidence' | 'event_status';\n  body: string | null;\n  task_id: string | null;\n  evidence_id: string | null;\n  created_at: string;\n",
  "  message_type:\n    | 'text'\n    | 'system'\n    | 'task_completed'\n    | 'photo_evidence'\n    | 'event_status'\n    | 'preset_question'\n    | 'preset_answer'\n    | 'photo_request';\n  body: string | null;\n  task_id: string | null;\n  evidence_id: string | null;\n  preset_key: string | null;\n  reply_to_message_id: string | null;\n  created_at: string;\n",
  'chat message type',
);

replaceOnce(
  "  const [taskFieldErrors, setTaskFieldErrors] = useState<TaskFieldErrors>({});\n  const [messageBody, setMessageBody] = useState('');\n  const [loading, setLoading] = useState(true);\n",
  "  const [taskFieldErrors, setTaskFieldErrors] = useState<TaskFieldErrors>({});\n  const [loading, setLoading] = useState(true);\n",
  'free chat state',
);

replaceOnce(
  ".select('id, event_id, sender_id, message_type, body, task_id, evidence_id, created_at')",
  ".select('id, event_id, sender_id, message_type, body, task_id, evidence_id, preset_key, reply_to_message_id, created_at')",
  'chat message select',
);

replaceOnce(
`  async function sendMessage() {
    if (!event || !user || busy || !messageBody.trim()) return;
    setBusy(true);
    setError(null);
    const { error: messageError } = await supabase.from('chat_messages').insert({
      event_id: event.id,
      sender_id: user.id,
      message_type: 'text',
      body: messageBody.trim(),
    });
    if (messageError) {
      setError('Não foi possível enviar a mensagem.');
    } else {
      setMessageBody('');
      await loadEvent(false);
    }
    setBusy(false);
  }

`,
  '',
  'free chat sender',
);

replaceOnce(
`        <SectionCard
          title="Chat e registro do evento"
          description="Mensagens, alterações de estado, fotos e conclusões ficam vinculadas somente a esta hospedagem.">`,
`        <SectionCard
          title="Comunicação e registro do evento"
          description="A comunicação é mediada pelo Hospeda Patas. Perguntas, respostas, fotos e alterações de estado ficam vinculadas a esta hospedagem.">`,
  'chat section heading',
);

replaceOnce(
`          {event.status !== 'cancelled' ? (
            <>
              <FormField
                label="Mensagem"
                multiline
                maxLength={1500}
                placeholder="Escreva para o outro participante..."
                value={messageBody}
                onChangeText={setMessageBody}
              />
              <PrimaryButton
                disabled={!messageBody.trim()}
                label="Enviar mensagem"
                loading={busy}
                onPress={() => void sendMessage()}
              />
            </>
          ) : null}
`,
`          <MediatedChatControls
            eventId={event.id}
            eventStatus={event.status}
            userId={user?.id ?? null}
            isTutor={isTutor}
            isCaregiver={isCaregiver}
            messages={messages}
            tasks={tasks}
            pets={eventPets}
            busy={busy}
            onChanged={() => loadEvent(false)}
            onCapturePhotoTask={(taskId) => {
              const task = tasks.find((candidate) => candidate.id === taskId);
              return task ? captureEvidenceAndComplete(task) : undefined;
            }}
          />
`,
  'free chat composer',
);

replaceOnce(
  "  if (message.message_type !== 'text') {\n",
  "  if (!['text', 'preset_question', 'preset_answer'].includes(message.message_type)) {\n",
  'mediated bubble rendering',
);

replaceOnce(
  "function systemMessageText(message: ChatMessage) {\n",
  "function systemMessageText(message: ChatMessage) {\n  if (message.message_type === 'photo_request') return `📸 ${message.body || 'O tutor solicitou uma foto atual do pet.'}`;\n",
  'photo request system copy',
);

await writeFile(path, source, 'utf8');
console.log('Mediated chat patch applied successfully.');
