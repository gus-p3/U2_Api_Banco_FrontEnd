import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing } from '../theme';

export interface CardProps {
  children: ReactNode;
  tone?: 'default' | 'primary';
  style?: StyleProp<ViewStyle>;
}

function CardBase({ children, tone = 'default', style }: CardProps) {
  return <View style={[styles.card, tone === 'primary' && styles.primary, style]}>{children}</View>;
}

export const Card = memo(CardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  primary: { backgroundColor: colors.primary },
});
