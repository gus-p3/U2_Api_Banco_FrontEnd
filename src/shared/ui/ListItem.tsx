import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radii, spacing, typography } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Texto a la derecha (p. ej. importe). */
  trailing?: string;
  trailingTone?: 'default' | 'positive' | 'negative';
  icon?: IconName;
  onPress?: () => void;
  showChevron?: boolean;
}

function ListItemBase({
  title,
  subtitle,
  trailing,
  trailingTone = 'default',
  icon,
  onPress,
  showChevron,
}: ListItemProps) {
  const content = (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text
          style={[
            styles.trailing,
            trailingTone === 'positive' && { color: colors.success },
            trailingTone === 'negative' && { color: colors.danger },
          ]}
        >
          {trailing}
        </Text>
      ) : null}
      {(showChevron ?? !!onPress) ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, trailing].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

export const ListItem = memo(ListItemBase);

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1 },
  title: { ...typography.subheading, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
  trailing: { ...typography.subheading, color: colors.text },
  pressed: { opacity: 0.7 },
});
