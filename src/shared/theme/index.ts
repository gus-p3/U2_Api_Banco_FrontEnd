import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  primary: '#0B1F4B',
  primaryLight: '#1B3A7A',
  primaryDark: '#06122E',
  accent: '#C9A227',
  accentLight: '#F3E3A6',
  background: '#F4F6FA',
  surface: '#FFFFFF',
  border: '#E1E6F0',
  text: '#101828',
  textMuted: '#667085',
  textOnPrimary: '#FFFFFF',
  success: '#12805C',
  successBg: '#E3F6EE',
  warning: '#B54708',
  warningBg: '#FEF0C7',
  danger: '#B42318',
  dangerBg: '#FEE4E2',
  overlay: 'rgba(6, 18, 46, 0.55)',
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  heading: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  subheading: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  amount: { fontSize: 34, fontWeight: '700', lineHeight: 40 },
} satisfies Record<string, TextStyle>;

const shadowCard: ViewStyle = Platform.select<ViewStyle>({
  web: { boxShadow: '0 4px 14px rgba(16, 24, 40, 0.08)' } as ViewStyle,
  default: {
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
}) as ViewStyle;

export const shadows = { card: shadowCard } as const;

export const layout = {
  maxContentWidth: 640,
  minTouchTarget: 48,
} as const;

export const theme = { colors, spacing, radii, typography, shadows, layout } as const;
export type Theme = typeof theme;
