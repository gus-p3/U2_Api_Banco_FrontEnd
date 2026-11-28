import { memo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radii, shadows, spacing, typography } from '../theme';

export interface AppModalProps {
  visible: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
  /** Botones (Button) mostrados al pie. */
  actions?: ReactNode;
  onRequestClose?: () => void;
}

function AppModalBase({ visible, title, message, children, actions, onRequestClose }: AppModalProps) {
  return (
    <RNModal transparent visible={visible} animationType="fade" onRequestClose={onRequestClose}>
      <KeyboardAvoidingView
        style={styles.avoid}
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onRequestClose}
            accessibilityLabel="Cerrar"
          />
          <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {children}
            {actions ? <View style={styles.actions}>{actions}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

export const AppModal = memo(AppModalBase);

const styles = StyleSheet.create({
  avoid: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  title: { ...typography.heading, color: colors.text },
  message: { ...typography.body, color: colors.textMuted },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
