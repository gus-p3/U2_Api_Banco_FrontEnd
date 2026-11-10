import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Button, Card, Input, Screen } from '@/shared/ui';

import { authDeps } from '../di';
import { signInWithBiometrics, signInWithPassword } from './authActions';
import { type LoginFormValues, loginSchema } from './loginSchema';
import { useSessionStore } from './sessionStore';

export function LoginScreen() {
  const router = useRouter();
  const endReason = useSessionStore((s) => s.endReason);
  const [serverError, setServerError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    void (async () => {
      const [avail, lastEmail] = await Promise.all([
        authDeps.biometrics.isAvailable(),
        authDeps.store.getLastEmail(),
      ]);
      setBiometricAvailable(avail);
      if (lastEmail) {
        setValue('email', lastEmail);
        const secret = await authDeps.store.getBiometricSecret(lastEmail);
        if (secret) setBiometricEmail(lastEmail);
      }
    })();
  }, [setValue]);

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await signInWithPassword(values.email, values.password);
    } catch (e) {
      setServerError(toAppError(e).message);
    }
  };

  const onBiometricPress = async () => {
    const email = (getValues('email') || biometricEmail || '').trim();
    if (!email) {
      setServerError('Ingresa tu correo electrónico para usar el acceso biométrico.');
      return;
    }
    setServerError(null);
    setBioLoading(true);
    try {
      await signInWithBiometrics(email);
    } catch (e) {
      setServerError(toAppError(e).message);
    } finally {
      setBioLoading(false);
    }
  };

  const fillDemo = () => {
    setValue('email', 'alejandro.hernandez@banco-demo.com', { shouldValidate: true });
    setValue('password', 'PasswordSegura#2026', { shouldValidate: true });
  };

  return (
    <Screen>
      <View style={styles.brand}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>BD</Text>
        </View>
        <Text style={styles.title}>Banco Digital</Text>
        <Text style={styles.subtitle}>Banca segura y transparente</Text>
      </View>

      {endReason === 'inactivity' ? (
        <View style={styles.bannerWarn} accessibilityRole="alert">
          <Text style={styles.bannerWarnText}>
            Tu sesión se cerró por inactividad de 5 minutos. Inicia sesión nuevamente.
          </Text>
        </View>
      ) : null}

      <Card style={styles.formCard}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Correo electrónico"
              placeholder="nombre@correo.com"
              keyboardType="email-address"
              autoComplete="email"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Contraseña"
              placeholder="••••••••••••"
              secureTextEntry
              autoComplete="password"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />

        {serverError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{serverError}</Text>
          </View>
        ) : null}

        <Button
          title="Iniciar sesión"
          loading={isSubmitting}
          onPress={() => void handleSubmit(onSubmit)()}
        />

        {Platform.OS !== 'web' && biometricAvailable ? (
          <Button
            title={
              biometricEmail ? `Entrar con huella (${biometricEmail})` : 'Entrar con huella digital'
            }
            variant="outline"
            loading={bioLoading}
            onPress={() => void onBiometricPress()}
          />
        ) : null}

        <Button title="Usar credenciales demo" variant="ghost" onPress={fillDemo} />
      </Card>

      <Button
        title="¿Aún no eres cliente? Abre tu cuenta"
        variant="ghost"
        onPress={() => router.push('/(auth)/register')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xl },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badgeText: { ...typography.heading, color: colors.accent, letterSpacing: 1 },
  title: { ...typography.title, color: colors.primary },
  subtitle: { ...typography.body, color: colors.textMuted },
  formCard: { gap: spacing.lg },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: { ...typography.caption, color: colors.danger },
  bannerWarn: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bannerWarnText: { ...typography.caption, color: colors.warning, fontWeight: '600' },
});
