const configuredMonitorUrl = process.env.EXPO_PUBLIC_MONITOR_API_URL?.trim();

export const environment = {
  // O monitor recebe dados fictícios por HTTP local e nunca deve existir em build de produção.
  monitorApiUrl: __DEV__ ? configuredMonitorUrl?.replace(/\/$/, '') || null : null,
} as const;
