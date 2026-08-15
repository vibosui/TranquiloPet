import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type Summary = {
  pets: number;
  contacts: number;
  hostingEvents: number;
  activeEvents: number;
};

const emptySummary: Summary = {
  pets: 0,
  contacts: 0,
  hostingEvents: 0,
  activeEvents: 0,
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [summary, setSummary] = useState(emptySummary);

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      const [petsResult, contactsResult, eventsResult, activeResult] = await Promise.all([
        supabase.from('pets').select('id', { count: 'exact', head: true }),
        supabase.from('connections').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
        supabase.from('hosting_events').select('id', { count: 'exact', head: true }),
        supabase
          .from('hosting_events')
          .select('id', { count: 'exact', head: true })
          .in('status', ['accepted', 'in_progress']),
      ]);

      if (!active) return;
      setSummary({
        pets: petsResult.count ?? 0,
        contacts: contactsResult.count ?? 0,
        hostingEvents: eventsResult.count ?? 0,
        activeEvents: activeResult.count ?? 0,
      });
    }

    void loadSummary();
    return () => {
      active = false;
    };
  }, []);

  const firstName = profile?.full_name.trim().split(/\s+/)[0] || 'por aqui';

  return (
    <ScreenShell
      eyebrow="HOSPEDA PATAS"
      title={`Olá, ${firstName}`}
      subtitle="Cuidar bem começa por conhecer. Organize a hospedagem e acompanhe cada cuidado sem ficar no escuro.">
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>CUIDADO QUE ACOLHE</Text>
        <Text style={styles.heroTitle}>Transparência durante toda a hospedagem.</Text>
        <Text style={styles.heroText}>
          Rotina, checklist, fotos e conversa ficam ligados ao mesmo evento para tutor e cuidador saberem exatamente o que aconteceu.
        </Text>
        <PrimaryButton label="Adicionar contato" onPress={() => router.push('/contacts')} />
      </View>

      <View style={styles.metrics}>
        <MetricCard label="Hospedagens" value={summary.hostingEvents} />
        <MetricCard label="Em cuidado" value={summary.activeEvents} />
        <MetricCard label="Contatos" value={summary.contacts} />
      </View>

      {profile?.public_code ? (
        <SectionCard
          title="Seu código de identificação"
          description="Compartilhe este código com tutor ou cuidador para liberar o contato. Ele é permanente.">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.codeCard, pressed && styles.codeCardPressed]}>
            <Text selectable style={styles.code}>{profile.public_code}</Text>
            <Text style={styles.codeHint}>Abrir perfil</Text>
          </Pressable>
        </SectionCard>
      ) : null}

      <SectionCard
        title="O que você quer fazer?"
        description="O MVP agora parte da relação entre duas pessoas e do evento de hospedagem.">
        <ActionCard
          title="Hospedagens"
          description="Veja eventos atuais e o histórico de cuidados."
          onPress={() => router.push('/hosting')}
        />
        <ActionCard
          title="Contatos"
          description="Adicione alguém pelo código HP e prepare uma hospedagem."
          onPress={() => router.push('/contacts')}
        />
        <ActionCard
          title="Meus pets"
          description={`${summary.pets} pet(s) no seu dossiê`}
          onPress={() => router.push('/pets')}
        />
      </SectionCard>

      <View style={styles.promiseCard}>
        <Text style={styles.promiseTitle}>Porque deixar seu pet com alguém não precisa significar ficar sem saber como ele está.</Text>
        <Text style={styles.promiseText}>🐶 🐱 💛</Text>
      </View>
    </ScreenShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Text style={styles.actionArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySoft,
    gap: spacing.md,
  },
  heroKicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minHeight: 88,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  metricValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  codeCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  codeCardPressed: {
    opacity: 0.78,
  },
  code: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  codeHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  actionCard: {
    minHeight: 76,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionPressed: {
    backgroundColor: colors.primarySoft,
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  actionDescription: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionArrow: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '500',
  },
  promiseCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.sm,
  },
  promiseTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 23,
    textAlign: 'center',
  },
  promiseText: {
    fontSize: 20,
    textAlign: 'center',
  },
});
