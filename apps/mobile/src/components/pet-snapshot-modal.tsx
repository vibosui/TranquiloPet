import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/theme/tokens';

type PetSnapshotModalProps = {
  snapshot: unknown;
  handoffSnapshot?: unknown;
  visible: boolean;
  onClose: () => void;
};

const keyLabels: Record<string, string> = {
  name: 'Nome',
  species: 'Espécie',
  breed: 'Raça',
  sex: 'Sexo',
  birth_date: 'Data de nascimento',
  approximate_weight_kg: 'Peso aproximado (kg)',
  size: 'Porte',
  identification_notes: 'Características de identificação',
  dossier: 'Dossiê de cuidado',
  behavior: 'Comportamento e personalidade',
  traits: 'Características',
  strangers_reaction: 'Reação a pessoas desconhecidas',
  other_pets: 'Convívio com outros pets',
  fears_or_discomforts: 'Medos e desconfortos',
  forbidden_actions: 'O que não deve ser feito',
  feeding: 'Alimentação',
  types: 'Tipo de alimentação',
  brand: 'Marca / tipo',
  amount: 'Quantidade por refeição',
  unit: 'Unidade',
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
  other_time: 'Outro horário',
  treats_allowed: 'Pode receber petiscos',
  treats_details: 'Detalhes dos petiscos',
  forbidden_foods: 'Alimentos proibidos',
  water: 'Água',
  drinks_normally: 'Bebe água normalmente',
  special_instructions: 'Orientações especiais',
  change_frequency: 'Frequência de troca',
  walks: 'Passeios',
  count_per_day: 'Passeios por dia',
  usual_times: 'Horários habituais',
  average_duration: 'Duração média',
  equipment: 'Equipamentos',
  behaviors: 'Comportamento no passeio',
  instructions: 'Orientações',
  routine: 'Rotina',
  wake_time: 'Horário que acorda',
  sleep_time: 'Horário que dorme',
  sleeping_places: 'Onde costuma dormir',
  stays_alone: 'Costuma ficar sozinho',
  alone_duration: 'Tempo que fica sozinho',
  habits: 'Hábitos importantes',
  hygiene: 'Higiene e necessidades',
  toilet_training: 'Hábito de fazer no local correto',
  urine_place: 'Onde faz xixi',
  stool_place: 'Onde faz cocô',
  signals_to_go_out: 'Sinaliza quando precisa sair',
  usual_frequency: 'Frequência habitual',
  objects: 'Brinquedos e objetos',
  attachment_objects: 'Objetos de apego',
  description: 'Descrição',
  bringing_to_hosting: 'Costuma levar para hospedagem',
  health: 'Saúde',
  conditions: 'Condições de saúde',
  allergies: 'Alergias',
  dietary_restrictions: 'Restrições alimentares',
  surgery_or_other: 'Cirurgias / outras condições',
  preventive_care: 'Vacinação e prevenção',
  vaccination_status: 'Situação da vacinação',
  vaccines: 'Vacinas registradas',
  other_vaccine: 'Outra vacina',
  deworming_status: 'Vermífugo',
  deworming_details: 'Detalhes do vermífugo',
  flea_tick_status: 'Antipulgas / carrapatos',
  flea_tick_details: 'Detalhes do antipulgas / carrapatos',
  vaccination_card_notes: 'Observações da carteirinha',
  medications: 'Medicamentos',
  dosage: 'Dosagem',
  schedule: 'Horários',
  administration: 'Como administrar',
  period: 'Período do tratamento',
  emergency: 'Emergência',
  tutor_name: 'Nome do tutor',
  tutor_phone: 'Telefone do tutor',
  tutor_whatsapp: 'WhatsApp do tutor',
  contact_name: 'Contato de emergência',
  contact_phone: 'Telefone do contato',
  vet_name: 'Veterinário',
  clinic: 'Clínica',
  vet_phone: 'Telefone veterinário',
  vet_address: 'Endereço veterinário',
  authorization: 'Autorização em emergência',
  additional_notes: 'Outras informações',
  prepared: 'Registro de entrega preparado',
  recorded_at: 'Data e horário do registro',
  items: 'Itens enviados',
  item_quantities: 'Quantidades / detalhes',
  pet_state: 'Estado do pet na entrega',
  observation: 'Observação da entrega',
  photos: 'Fotos do registro de entrega',
};

const valueLabels: Record<string, string> = {
  dog: 'Cachorro', cat: 'Gato', other: 'Outro', male: 'Macho', female: 'Fêmea',
  small: 'Pequeno', medium: 'Médio', large: 'Grande', calm: 'Calmo', playful: 'Brincalhão',
  agitated: 'Agitado', affectionate: 'Carinhoso', independent: 'Independente', fearful: 'Medroso',
  anxious: 'Ansioso', social: 'Sociável', reserved: 'Reservado', territorial: 'Territorial',
  approaches: 'Se aproxima facilmente', suspicious: 'É desconfiado no início', afraid: 'Tem medo',
  aggressive_risk: 'Pode apresentar comportamento agressivo', loves: 'Adora outros animais',
  adaptation: 'Convive bem, mas precisa de adaptação', alone: 'Prefere ficar sozinho', poor: 'Não convive bem',
  unknown: 'Não informado / não sabe', kibble: 'Ração', natural: 'Alimentação natural', mixed: 'Ração + natural',
  collar: 'Coleira', harness: 'Peitoral', leash: 'Guia', retractable: 'Guia retrátil', pulls: 'Puxa a guia',
  escapes: 'Tenta fugir', barks_dogs: 'Late para outros cães', reactive_animals: 'Reage a outros animais',
  afraid_cars: 'Tem medo de carros', afraid_people: 'Tem medo de pessoas', bed: 'Cama', crate: 'Caixa de transporte',
  room: 'Quarto', outside: 'Área externa', sofa: 'Sofá', with_tutor: 'Com o tutor', toy: 'Brinquedo',
  blanket: 'Cobertor', cloth: 'Paninho', none: 'Não possui', reliable: 'Faz no local correto quase sempre',
  occasional: 'Tem acidentes ocasionais', frequent: 'Costuma fazer fora do local', training: 'Ainda está aprendendo',
  up_to_date: 'Em dia', partial: 'Parcialmente em dia', overdue: 'Atrasado', not_vaccinated: 'Não vacinado',
  not_used: 'Não utiliza', v3: 'V3', v4: 'V4', v5: 'V5', v8: 'V8', v10: 'V10', rabies: 'Antirrábica',
  kennel_cough: 'Gripe / tosse dos canis', giardia: 'Giárdia', immediately: 'Sim, imediatamente',
  try_contact: 'Sim, mas tentar contato antes', only_authorized: 'Somente com autorização', normal: 'Normal',
  tired: 'Mais cansado', altered: 'Apresenta alteração', food: 'Ração', treats: 'Petiscos',
  medications: 'Medicamentos', toys: 'Brinquedos', bowls: 'Potes', carrier: 'Caixa de transporte',
  face: 'Rosto', full_body: 'Corpo inteiro', sides: 'Laterais', distinctive: 'Característica específica',
  accessories: 'Acessórios enviados',
};

const hiddenKeys = new Set(['id', 'captured_at', 'source_updated_at', 'dossier_version', 'primary_photo_path', 'storage_path']);

function titleForKey(key: string) {
  return keyLabels[key] ?? key.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

function scalarLabel(value: unknown) {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (typeof value === 'string') return valueLabels[value] ?? value;
  return String(value);
}

function isScalar(value: unknown) {
  return value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value);
}

function SnapshotValue({ label, value, depth = 0 }: { label: string; value: unknown; depth?: number }) {
  if (isScalar(value)) {
    const rendered = scalarLabel(value);
    if (rendered === 'Não informado') return null;
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{titleForKey(label)}</Text>
        <Text selectable style={styles.rowValue}>{rendered}</Text>
      </View>
    );
  }

  if (Array.isArray(value)) {
    if (!value.length) return null;
    if (value.every(isScalar)) {
      return (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{titleForKey(label)}</Text>
          <Text selectable style={styles.rowValue}>{value.map(scalarLabel).join(' • ')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{titleForKey(label)}</Text>
        {value.map((item, index) => (
          <View key={`${label}-${index}`} style={styles.arrayCard}>
            <Text style={styles.arrayTitle}>Item {index + 1}</Text>
            <SnapshotObject value={item} depth={depth + 1} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.group, depth > 0 && styles.nestedGroup]}>
      <Text style={styles.groupTitle}>{titleForKey(label)}</Text>
      <SnapshotObject value={value} depth={depth + 1} />
    </View>
  );
}

function SnapshotObject({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return (
    <View style={styles.objectBody}>
      {Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !hiddenKeys.has(key))
        .map(([key, item]) => <SnapshotValue key={key} depth={depth} label={key} value={item} />)}
    </View>
  );
}

function snapshotName(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return 'Pet';
  const name = (snapshot as Record<string, unknown>).name;
  return typeof name === 'string' && name.trim() ? name : 'Pet';
}

function captureLabel(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const capturedAt = (snapshot as Record<string, unknown>).captured_at;
  if (typeof capturedAt !== 'string' || !capturedAt) return null;
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function PetSnapshotModal({ snapshot, handoffSnapshot, visible, onClose }: PetSnapshotModalProps) {
  const name = snapshotName(snapshot);
  const captured = captureLabel(snapshot);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>DOSSIÊ CONGELADO</Text>
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.subtitle}>
              Estas são exatamente as informações salvas quando esta hospedagem foi criada.
            </Text>
            {captured ? <Text style={styles.captured}>Snapshot em {captured}</Text> : null}
          </View>
          <Pressable
            accessibilityLabel="Fechar dossiê do pet"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <Text style={styles.closeText}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Somente leitura</Text>
            <Text style={styles.noticeText}>
              Alterações feitas posteriormente no cadastro do pet não mudam este histórico.
            </Text>
          </View>

          <SnapshotObject value={snapshot} />

          {handoffSnapshot && typeof handoffSnapshot === 'object' ? (
            <View style={styles.handoffSection}>
              <Text style={styles.handoffTitle}>Registro de entrega desta hospedagem</Text>
              <SnapshotObject value={handoffSnapshot} />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  captured: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  closeButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.round,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  notice: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    gap: spacing.xs,
  },
  noticeTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  objectBody: {
    gap: spacing.sm,
  },
  row: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  group: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.sm,
  },
  nestedGroup: {
    backgroundColor: colors.surface,
  },
  groupTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  arrayCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  arrayTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  handoffSection: {
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 2,
    borderTopColor: colors.primarySoft,
    gap: spacing.md,
  },
  handoffTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.7,
  },
});
