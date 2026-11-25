import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Paleta Fintech Moderna — Opción B (Azul Eléctrico + Cian Luminoso, estilo Revolut / Mercado Pago moderno).
 * Cero tonos marino envejecidos ni dorados tradicionales.
 */
export const colors = {
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',
  primarySoft: '#EFF6FF',
  accent: '#0EA5E9',
  accentLight: '#E0F2FE',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',
  success: '#059669',
  successBg: '#ECFDF5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  overlay: 'rgba(15, 23, 42, 0.55)',
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
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontSize: 21, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3 },
  subheading: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  amount: { fontSize: 36, fontWeight: '800', lineHeight: 42, letterSpacing: -0.8 },
} satisfies Record<string, TextStyle>;

const shadowCard: ViewStyle = Platform.select<ViewStyle>({
  web: {
    boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
  } as ViewStyle,
  default: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
}) as ViewStyle;

const shadowHero: ViewStyle = Platform.select<ViewStyle>({
  web: {
    boxShadow: '0 14px 32px -6px rgba(37, 99, 235, 0.35)',
  } as ViewStyle,
  default: {
    shadowColor: '#2563EB',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
}) as ViewStyle;

export const shadows = { card: shadowCard, hero: shadowHero } as const;

export const layout = {
  maxContentWidth: 680,
  minTouchTarget: 48,
} as const;

export const theme = { colors, spacing, radii, typography, shadows, layout } as const;
export type Theme = typeof theme;
