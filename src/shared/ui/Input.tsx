import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, layout, radii, spacing, typography } from '../theme';

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

function InputBase({
  label,
  error,
  hint,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  autoComplete,
  importantForAutofill,
  textContentType,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const allowAutofill = Boolean(autoComplete && autoComplete !== 'off');
  const resolvedAutoComplete = allowAutofill ? autoComplete : 'off';
  const resolvedImportantForAutofill = importantForAutofill ?? (allowAutofill ? 'yes' : 'no');
  const resolvedTextContentType = textContentType ?? (allowAutofill ? undefined : 'none');

  const isPasswordField = Boolean(secureTextEntry);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, focused && styles.focused, !!error && styles.errorBorder]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={resolvedAutoComplete}
          importantForAutofill={resolvedImportantForAutofill}
          textContentType={resolvedTextContentType}
          secureTextEntry={isPasswordField && !passwordVisible}
          style={[styles.input, isPasswordField && styles.inputWithAction, style]}
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
        {isPasswordField ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            style={styles.eyeButton}
            onPress={() => setPasswordVisible((prev) => !prev)}
          >
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
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
  inputContainer: {
    minHeight: layout.minTouchTarget,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: layout.minTouchTarget - 3,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 15,
  },
  inputWithAction: {
    paddingRight: spacing.xs,
  },
  eyeButton: {
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: layout.minTouchTarget - 3,
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
