const configuredMonitorUrl = process.env.EXPO_PUBLIC_MONITOR_API_URL?.trim();

const defaultSupabaseUrl = 'https://inenqyqkfpczotnlimkf.supabase.co';
const defaultSupabasePublishableKey = 'sb_publishable_ZiMIEu1EACt8P0HZ922ekw_JkgNcKjD';

export const environment = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || defaultSupabaseUrl,
  // Publishable keys are intentionally safe for client apps; RLS remains the security boundary.
  supabasePublishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || defaultSupabasePublishableKey,
  // Monitor de desenvolvimento opcional. Nunca é fonte de dados do produto.
  monitorApiUrl: __DEV__ ? configuredMonitorUrl?.replace(/\/$/, '') || null : null,
} as const;
