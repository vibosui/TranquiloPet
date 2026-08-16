import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

const checklist = [
  { icon: '🍖', title: 'Refeição da manhã', meta: '08:00 • foto obrigatória', done: true },
  { icon: '💧', title: 'Trocar água', meta: 'Quando for realizado', done: true },
  { icon: '🦮', title: 'Passeio', meta: '11:30 • foto obrigatória', done: false },
  { icon: '💊', title: 'Administrar medicamento', meta: '14:00 • foto obrigatória', done: false },
];

export default function DemoScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.logoBubble}><Text style={styles.logoEmoji}>🐾</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>Hospeda Patas</Text>
            <Text style={styles.brandTagline}>Cuidado que acolhe. Confiança que fica.</Text>
          </View>
          <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>DEMO</Text></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>HOSPEDAGEM EM ANDAMENTO</Text>
          <Text style={styles.heroTitle}>Fim de semana da Luna</Text>
          <Text style={styles.heroText}>
            Acompanhe rotina, checklist, fotos e ocorrências sem precisar abrir contato direto entre tutor e cuidador.
          </Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressStrong}>2 de 4 tarefas concluídas</Text>
            <Text style={styles.progress}>Tutor ↔ Hospeda Patas ↔ Cuidador</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🐶 Pet hospedado</Text>
            <View style={styles.petRow}>
              <View style={styles.petAvatar}><Text style={styles.petAvatarText}>🐕</Text></View>
              <View style={styles.petCopy}>
                <Text style={styles.petName}>Luna</Text>
                <Text style={styles.muted}>Golden Retriever • porte grande</Text>
                <Text style={styles.linkText}>Dossiê congelado para esta hospedagem ›</Text>
              </View>
            </View>
            <View style={styles.tagRow}>
              <Tag text="Sociável" />
              <Tag text="Rotina definida" />
              <Tag text="Medicação" />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Checklist do cuidado</Text>
            <View style={styles.list}>
              {checklist.map((item) => (
                <View key={item.title} style={[styles.task, item.done && styles.taskDone]}>
                  <Text style={styles.taskIcon}>{item.icon}</Text>
                  <View style={styles.taskCopy}>
                    <Text style={styles.taskTitle}>{item.title}</Text>
                    <Text style={styles.taskMeta}>{item.meta}</Text>
                  </View>
                  <Text style={styles.taskCheck}>{item.done ? '✓' : '○'}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔒 Comunicação mediada</Text>
          <Text style={styles.cardDescription}>
            Sem chat livre e sem exposição de telefone. As interações usam perguntas, respostas e ações padronizadas.
          </Text>
          <View style={styles.timeline}>
            <View style={[styles.message, styles.messageTutor]}>
              <Text style={styles.messageRole}>TUTOR</Text>
              <Text style={styles.messageText}>Como a Luna está agora?</Text>
            </View>
            <View style={[styles.message, styles.messageCaregiver]}>
              <Text style={styles.messageRole}>CUIDADOR</Text>
              <Text style={styles.messageText}>Está tranquila e descansando.</Text>
            </View>
            <View style={styles.photoRequest}>
              <Text style={styles.photoRequestTitle}>📸 Foto solicitada pelo tutor</Text>
              <Text style={styles.muted}>O cuidador responde somente com uma foto capturada pela câmera.</Text>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Ocorrências estruturadas</Text>
            <Text style={styles.cardDescription}>
              Vômito, recusa de alimentação, comportamento atípico, ferimento, fuga, reação alérgica e outros sinais são registrados por categorias — sem texto livre.
            </Text>
            <View style={styles.incidentOk}>
              <Text style={styles.incidentOkText}>✓ Nenhuma ocorrência em acompanhamento</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>📷 Evidências</Text>
            <Text style={styles.cardDescription}>
              Fotos obrigatórias ficam ligadas à tarefa e ao evento, criando um histórico consultável pelo tutor.
            </Text>
            <View style={styles.photoGrid}>
              <View style={styles.photoPlaceholder}><Text style={styles.photoEmoji}>🐶</Text><Text style={styles.photoLabel}>Refeição</Text></View>
              <View style={styles.photoPlaceholder}><Text style={styles.photoEmoji}>🦮</Text><Text style={styles.photoLabel}>Passeio</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Demonstração somente leitura</Text>
          <Text style={styles.footerText}>
            Esta página é um modelo visual do Hospeda Patas. Nenhum cadastro ou dado real é criado ao acessar este QR Code.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Tag({ text }: { text: string }) {
  return <View style={styles.tag}><Text style={styles.tagText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 56,
    gap: spacing.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoBubble: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 24 },
  brandCopy: { flex: 1, minWidth: 0 },
  brand: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  brandTagline: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  demoBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    backgroundColor: colors.accent,
  },
  demoBadgeText: { color: colors.surface, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  hero: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    gap: spacing.sm,
  },
  eyebrow: { color: colors.primarySoft, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: colors.surface, fontSize: 28, fontWeight: '900' },
  heroText: { color: colors.primarySoft, fontSize: 14, lineHeight: 21, maxWidth: 700 },
  progressRow: { marginTop: spacing.sm, gap: spacing.xs },
  progressStrong: { color: colors.surface, fontSize: 13, fontWeight: '900' },
  progress: { color: colors.primarySoft, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  card: {
    flexGrow: 1,
    flexBasis: 360,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  cardDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  petAvatar: {
    width: 58,
    height: 58,
    borderRadius: radii.round,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petAvatarText: { fontSize: 28 },
  petCopy: { flex: 1, minWidth: 0 },
  petName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  linkText: { color: colors.primary, fontSize: 11, fontWeight: '800', marginTop: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.round, backgroundColor: colors.primarySoft },
  tagText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  list: { gap: spacing.sm },
  task: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskDone: { backgroundColor: colors.successSoft },
  taskIcon: { fontSize: 18 },
  taskCopy: { flex: 1, minWidth: 0 },
  taskTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  taskMeta: { color: colors.textMuted, fontSize: 9, marginTop: 2 },
  taskCheck: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  timeline: { gap: spacing.sm },
  message: { maxWidth: '88%', padding: spacing.md, borderRadius: radii.lg, gap: spacing.xs },
  messageTutor: { alignSelf: 'flex-end', backgroundColor: colors.primarySoft },
  messageCaregiver: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted },
  messageRole: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  messageText: { color: colors.text, fontSize: 12, lineHeight: 17 },
  photoRequest: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.accentSoft, gap: spacing.xs },
  photoRequestTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  incidentOk: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.successSoft },
  incidentOkText: { color: colors.success, fontSize: 11, fontWeight: '900' },
  photoGrid: { flexDirection: 'row', gap: spacing.sm },
  photoPlaceholder: {
    flex: 1,
    minHeight: 110,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  photoEmoji: { fontSize: 30 },
  photoLabel: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  footer: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.accentSoft, gap: spacing.xs },
  footerTitle: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  footerText: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
});
