import { memo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, layout, radii, spacing, typography } from '../theme';

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

function InputBase({ label, error, hint, style, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, focused && styles.focused, !!error && styles.errorBorder, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const Input = memo(InputBase);

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { ...typography.caption, color: colors.text, fontWeight: '600' },
  input: {
    minHeight: layout.minTouchTarget,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 15,
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  errorBorder: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  error: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption, color: colors.textMuted },
});
