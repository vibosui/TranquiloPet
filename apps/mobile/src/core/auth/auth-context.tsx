import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '@/core/supabase/client';

export type HospedaProfile = {
  id: string;
  public_code: string;
  full_name: string;
  phone: string | null;
  avatar_path: string | null;
  tutor_enabled: boolean;
  caregiver_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type SignUpInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: HospedaProfile | null;
  error: string | null;
  clearError(): void;
  refreshProfile(): Promise<HospedaProfile | null>;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: SignUpInput): Promise<{ requiresEmailConfirmation: boolean }>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyError(error: unknown) {
  if (!(error instanceof Error)) return 'Não foi possível concluir a operação.';

  const normalized = error.message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (normalized.includes('user already registered')) {
    return 'Já existe uma conta com este e-mail.';
  }
  if (normalized.includes('password')) {
    return 'A senha informada não atende aos requisitos de segurança.';
  }

  return error.message;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<HospedaProfile | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      return null;
    }

    setProfileLoading(true);
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(
          'id, public_code, full_name, phone, avatar_path, tutor_enabled, caregiver_enabled, created_at, updated_at',
        )
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      const nextProfile = data as HospedaProfile;
      setProfile(nextProfile);
      return nextProfile;
    } catch (profileError) {
      setError(friendlyError(profileError));
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(friendlyError(sessionError));
      setSession(data.session ?? null);
      setBootstrapping(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setError(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (bootstrapping) return;
    if (!session?.user.id) {
      setProfile(null);
      return;
    }
    void refreshProfile();
  }, [bootstrapping, refreshProfile, session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading: bootstrapping || Boolean(session && profileLoading),
      session,
      user: session?.user ?? null,
      profile,
      error,
      clearError: () => setError(null),
      refreshProfile,
      signIn: async (email, password) => {
        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) {
          const message = friendlyError(signInError);
          setError(message);
          throw new Error(message);
        }
      },
      signUp: async ({ fullName, email, phone, password }) => {
        setError(null);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
            },
          },
        });
        if (signUpError) {
          const message = friendlyError(signUpError);
          setError(message);
          throw new Error(message);
        }
        return { requiresEmailConfirmation: !data.session };
      },
      signOut: async () => {
        setError(null);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          const message = friendlyError(signOutError);
          setError(message);
          throw new Error(message);
        }
      },
    }),
    [bootstrapping, error, profile, profileLoading, refreshProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
