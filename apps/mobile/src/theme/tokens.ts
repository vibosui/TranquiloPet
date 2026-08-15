export const brandColors = {
  espresso: '#3A1500',
  cocoa: '#6A2600',
  caramelDark: '#7E2D00',
  caramel: '#9E3F0A',
  tangerine: '#FF7325',
  black: '#000000',
  white: '#FFFFFF',
} as const;

export const colors = {
  background: brandColors.white,
  surface: brandColors.white,
  surfaceMuted: '#FFF6F0',
  primary: brandColors.caramel,
  primaryPressed: brandColors.caramelDark,
  primarySoft: '#FBE8DC',
  accent: brandColors.tangerine,
  accentSoft: '#FFF0E8',
  text: brandColors.espresso,
  textMuted: brandColors.cocoa,
  border: '#E9CDBD',
  error: brandColors.caramelDark,
  errorSoft: '#FBE8E1',
  success: brandColors.cocoa,
  successSoft: '#F4E7DF',
  warning: brandColors.tangerine,
  warningSoft: '#FFF0E8',
  overlay: 'rgba(58, 21, 0, 0.48)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  round: 999,
} as const;
