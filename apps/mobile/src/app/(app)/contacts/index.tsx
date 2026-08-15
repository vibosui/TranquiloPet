import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth, type HospedaProfile } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type Connection = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  created_at: string;
};

type Contact = {
  connection: Connection;
  profile: HospedaProfile | null;
};

export default function ContactsScreen() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: connectionData, error: connectionError } = await supabase
      .from('connections')
      .select('id, user_a_id, user_b_id, status, created_at')
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });

    if (connectionError) {
      setError('Não foi possível carregar seus contatos.');
      setLoading(false);
      return;
    }

    const connections = (connectionData ?? []) as Connection[];
    const otherIds = connections.map((connection) =>
      connection.user_a_id === user.id ? connection.user_b_id : connection.user_a_id,
    );

    let profileMap = new Map<string, HospedaProfile>();
    if (otherIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select(
          'id, public_code, full_name, phone, avatar_path, tutor_enabled, caregiver_enabled, created_at, updated_at',
        )
        .in('id', otherIds);

      if (profileError) {
        setError('Os contatos foram encontrados, mas alguns perfis não puderam ser carregados.');
      } else {
        profileMap = new Map(
          ((profiles ?? []) as HospedaProfile[]).map((profile) => [profile.id, profile]),
        );
      }
    }

    setContacts(
      connections.map((connection) => {
        const otherId = connection.user_a_id === user.id ? connection.user_b_id : connection.user_a_id;
        return { connection, profile: profileMap.get(otherId) ?? null };
      }),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  async function connectByCode() {
    if (!/^HP-[A-HJ-NP-Z2-9]{6}$/.test(normalizedCode) || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('connect_by_code', {
        p_public_code: normalizedCode,
      });
      if (rpcError) throw rpcError;
      setCode('');
      await loadContacts();
    } catch (connectError) {
      const message = connectError instanceof Error ? connectError.message : '';
      if (message.toLowerCase().includes('not found')) {
        setError('Nenhum usuário foi encontrado com esse código.');
      } else if (message.toLowerCase().includes('yourself')) {
        setError('Esse código pertence à sua própria conta.');
      } else {
        setError('Não foi possível adicionar este contato agora.');
      }
    } finally {
      setConnecting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="CONTATOS"
      title="Conecte tutor e cuidador"
      subtitle="Use o código permanente HP do outro usuário. A estrutura de solicitação já existe; durante o MVP o aceite é automático.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard
        title="Adicionar por código"
        description="Exemplo: HP-7K3M9Q. Letras ambíguas como I e O não são usadas.">
        <FormField
          label="Código Hospeda Patas"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          placeholder="HP-XXXXXX"
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase())}
          onSubmitEditing={() => void connectByCode()}
        />
        <PrimaryButton
          disabled={!/^HP-[A-HJ-NP-Z2-9]{6}$/.test(normalizedCode)}
          label="Adicionar contato"
          loading={connecting}
          onPress={() => void connectByCode()}
        />
      </SectionCard>

      <SectionCard
        title="Meus contatos"
        description="As hospedagens e chats ficarão agrupados por cada pessoa.">
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : contacts.length === 0 ? (
          <Text style={styles.empty}>Você ainda não adicionou nenhum contato.</Text>
        ) : (
          <View style={styles.contactList}>
            {contacts.map(({ connection, profile }) => (
              <View key={connection.id} style={styles.contactCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(profile?.full_name || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactCopy}>
                  <Text style={styles.contactName}>{profile?.full_name || 'Usuário Hospeda Patas'}</Text>
                  <Text selectable style={styles.contactCode}>{profile?.public_code || 'Código indisponível'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </SectionCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  contactList: {
    gap: spacing.sm,
  },
  contactCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.round,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  contactCopy: {
    flex: 1,
  },
  contactName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  contactCode: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
});
