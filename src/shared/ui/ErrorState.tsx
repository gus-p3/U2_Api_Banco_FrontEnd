import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, spacing, typography } from '../theme';

export const ErrorState = memo(function ErrorState({
  message,
  onRetry,
  title = 'Algo salió mal',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{message}</Text>
      {onRetry ? (
        <Button title="Reintentar" variant="outline" fullWidth={false} onPress={onRetry} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', padding: spacing.xxl, gap: spacing.sm },
  title: { ...typography.subheading, color: colors.text, textAlign: 'center' },
  desc: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
