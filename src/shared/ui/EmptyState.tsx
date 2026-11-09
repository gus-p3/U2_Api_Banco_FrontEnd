import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, spacing, typography } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export const EmptyState = memo(function EmptyState({
  title,
  description,
  icon = 'file-tray-outline',
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="outline" fullWidth={false} onPress={onAction} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', padding: spacing.xxl, gap: spacing.sm },
  title: { ...typography.subheading, color: colors.text, textAlign: 'center' },
  desc: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
