import { Platform } from 'react-native';

import { environment } from '@/config/environment';

type MetadataValue = boolean | number | string | null;

export type UsageEventName =
  | 'app_opened'
  | 'interaction_test_pressed'
  | 'tutor_registration_opened'
  | 'tutor_registration_submit_started'
  | 'tutor_registration_validation_failed'
  | 'tutor_registration_submit_failed'
  | 'tutor_registration_succeeded'
  | 'demo_login_succeeded'
  | 'demo_account_registered'
  | 'demo_logout'
  | 'profile_viewed'
  | 'tutor_profile_saved'
  | 'caregiver_profile_saved'
  | 'pet_profile_viewed'
  | 'pet_profile_saved';

export type UsageEvent = {
  eventName: UsageEventName;
  screen:
    | 'home'
    | 'login'
    | 'account_registration'
    | 'profile'
    | 'tutor_profile'
    | 'caregiver_profile'
    | 'pet_profile'
    | 'pet_form';
  metadata?: Record<string, MetadataValue>;
};

const sessionId = `${Platform.OS}-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const monitorTimeoutMs = 3_000;
const monitorHeaders = {
  'ngrok-skip-browser-warning': '1',
} as const;

async function fetchMonitor(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), monitorTimeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getSessionId() {
  return sessionId;
}

export async function trackUsage({ eventName, screen, metadata = {} }: UsageEvent) {
  const payload = {
    session_id: sessionId,
    event_name: eventName,
    screen,
    platform: Platform.OS,
    metadata,
  };

  console.info(`[Tranquilo Pet][uso] ${eventName}`, payload);

  if (!environment.monitorApiUrl) {
    return false;
  }

  try {
    const response = await fetchMonitor(`${environment.monitorApiUrl}/api/events`, {
      method: 'POST',
      headers: {
        ...monitorHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[Tranquilo Pet][monitor] evento recusado (${response.status})`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[Tranquilo Pet][monitor] indisponível', error);
    return false;
  }
}

export function trackUsageInBackground(event: UsageEvent) {
  void trackUsage(event);
}

export async function checkMonitorConnection() {
  if (!environment.monitorApiUrl) {
    return 'not_configured' as const;
  }

  try {
    const response = await fetchMonitor(`${environment.monitorApiUrl}/api/health`, {
      headers: monitorHeaders,
    });
    return response.ok ? ('online' as const) : ('offline' as const);
  } catch {
    return 'offline' as const;
  }
}
