/**
 * Recursos deliberadamente desligados enquanto o fluxo local do MVP e validado.
 * Nenhuma flag publica deve ser tratada como controle de seguranca.
 */
export function isLocalDemoDataEnabled(
  isDevelopment: boolean,
  publicOptIn: string | undefined,
) {
  return isDevelopment || publicOptIn === '1';
}

const localDemoDataEnabled = isLocalDemoDataEnabled(
  __DEV__,
  process.env.EXPO_PUBLIC_ENABLE_LOCAL_DEMO,
);

export const featureFlags = {
  // EXPO_PUBLIC_* fica embutida e visivel no app. Esta flag habilita apenas dados ficticios.
  localDemoData: localDemoDataEnabled,
  productionAuthentication: false,
  remotePhotoUpload: false,
  cameraCapture: false,
  preciseLocation: false,
  backgroundSync: false,
  pushNotifications: false,
  payments: false,
  remoteLocationRefresh: false,
} as const;
