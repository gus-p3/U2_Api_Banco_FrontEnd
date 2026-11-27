import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { colors, radii, shadows, spacing, typography } from '@/shared/theme';
import { Button, Card, Input, Loader, Screen } from '@/shared/ui';

import { authDeps } from '../di';
import type { AuthChallenge } from '../domain/entities';
import {
  cancel2faChallenge,
  poll2faChallengeStatus,
  request2faMobileFingerprint,
  send2faEmailCode,
  signInWithBiometrics,
  signInWithPasswordChallenge,
  verifyEmailOrLoginCode,
} from './authActions';
import { type LoginFormValues, loginSchema } from './loginSchema';
import { useSessionStore } from './sessionStore';

export function LoginScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const endReason = useSessionStore((s) => s.endReason);
  const [serverError, setServerError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  // Estado del desafío 2FA / verificación por correo o huella remota
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTouched, setOtpTouched] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [waitingBiometric, setWaitingBiometric] = useState(false);
  const [challengeFeedback, setChallengeFeedback] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
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
        setValue('email', lastEmail, { shouldValidate: true });
        const secret = await authDeps.store.getBiometricSecret(lastEmail);
        if (secret) setBiometricEmail(lastEmail);
      }
    })();
  }, [setValue]);

  // Polling cuando Web espera autorización con huella digital desde Android
  useEffect(() => {
    if (!challenge || !waitingBiometric) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const status = await poll2faChallengeStatus(challenge.challengeId, challenge.pollToken);
        if (!active) return;
        if (status.estado === 'CONSUMIDO' || status.authResponse?.token) {
          clearInterval(timer);
          setWaitingBiometric(false);
          setChallenge(null);
        } else if (status.estado === 'RECHAZADO') {
          clearInterval(timer);
          setWaitingBiometric(false);
          setServerError('El inicio de sesión fue rechazado desde tu dispositivo Android.');
        } else if (status.estado === 'EXPIRADO') {
          clearInterval(timer);
          setWaitingBiometric(false);
          setServerError('La solicitud de acceso expiró. Intenta iniciar sesión nuevamente.');
        } else if (status.estado === 'CANCELADO') {
          clearInterval(timer);
          setWaitingBiometric(false);
        }
      } catch {
        // Reintenta en el siguiente intervalo
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [challenge, waitingBiometric]);

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setChallengeFeedback(null);
    try {
      const outcome = await signInWithPasswordChallenge(values.email, values.password);
      if (outcome.kind === 'challenge') {
        setChallenge(outcome.challenge);
        setCodeSent(outcome.challenge.codeSent);
        setOtpCode('');
        setOtpTouched(false);
        setWaitingBiometric(false);
        if (outcome.challenge.codeSent) {
          setChallengeFeedback(
            outcome.challenge.purpose === 'EMAIL_VERIFICATION'
              ? `Enviamos un código de 6 dígitos a ${outcome.challenge.email} para verificar tu cuenta.`
              : `Enviamos un código de 6 dígitos a ${outcome.challenge.email}.`,
          );
        }
      }
    } catch (e) {
      setServerError(toAppError(e).message);
    }
  };

  const handleSendEmailCode = async () => {
    if (!challenge) return;
    setServerError(null);
    setChallengeFeedback(null);
    setSendingCode(true);
    try {
      await send2faEmailCode(challenge.challengeId, challenge.pollToken);
      setCodeSent(true);
      setWaitingBiometric(false);
      setChallengeFeedback(`Enviamos un código de 6 dígitos a ${challenge.email}.`);
    } catch (e) {
      setServerError(toAppError(e).message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleRequestMobileFingerprint = async () => {
    if (!challenge) return;
    setServerError(null);
    setChallengeFeedback(null);
    setSendingCode(true);
    try {
      await request2faMobileFingerprint(challenge.challengeId, challenge.pollToken);
      setWaitingBiometric(true);
      setChallengeFeedback(
        'Notificación enviada a tu celular Android. Abre la app y coloca tu huella digital.',
      );
    } catch (e) {
      setServerError(toAppError(e).message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!challenge) return;
    setOtpTouched(true);
    if (!/^[0-9]{6}$/.test(otpCode.trim())) {
      setServerError('Introduce los 6 dígitos del código enviado a tu correo.');
      return;
    }
    setServerError(null);
    setVerifyingCode(true);
    try {
      await verifyEmailOrLoginCode(challenge.challengeId, challenge.pollToken, otpCode);
      setChallenge(null);
    } catch (e) {
      setServerError(toAppError(e).message);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleCancelChallenge = async () => {
    if (challenge) {
      await cancel2faChallenge(challenge.challengeId, challenge.pollToken);
    }
    setChallenge(null);
    setWaitingBiometric(false);
    setCodeSent(false);
    setOtpCode('');
    setOtpTouched(false);
    setServerError(null);
    setChallengeFeedback(null);
  };

  const onBiometricPress = async () => {
    const rawEmail = getValues('email') || biometricEmail || '';
    if (!getValues('email') && biometricEmail) {
      setValue('email', biometricEmail, { shouldValidate: true });
    }
    const validEmail = await trigger('email');
    const parsed = loginSchema.shape.email.safeParse(rawEmail);
    if (!validEmail || !parsed.success) {
      setServerError('Ingresa un correo electrónico válido para usar el acceso con huella digital.');
      return;
    }
    setServerError(null);
    setBioLoading(true);
    try {
      await signInWithBiometrics(parsed.data);
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

  const otpLiveError =
    otpTouched && otpCode.length > 0 && otpCode.length < 6
      ? 'El código debe tener exactamente 6 dígitos numéricos.'
      : undefined;

  if (challenge) {
    const isAccountVerify = challenge.purpose === 'EMAIL_VERIFICATION';
    const supportsRemoteBio =
      isWeb && !isAccountVerify && challenge.availableMethods.includes('MOBILE_BIOMETRIC');

    return (
      <Screen>
        <View style={styles.brand}>
          <View style={styles.badge}>
            <Ionicons
              name={waitingBiometric ? 'finger-print' : 'mail-open-outline'}
              size={28}
              color={colors.textOnPrimary}
            />
          </View>
          <View style={styles.pillTag}>
            <Text style={styles.pillTagText}>
              {isAccountVerify ? 'VERIFICACIÓN DE CUENTA' : 'VERIFICACIÓN EN 2 PASOS'}
            </Text>
          </View>
          <Text style={styles.title}>
            {isAccountVerify ? 'Verifica tu cuenta' : 'Confirma tu inicio de sesión'}
          </Text>
          <Text style={styles.subtitle}>
            {isAccountVerify
              ? `Para verificar tu cuenta creada (${challenge.email}), introduce el código de 6 dígitos que enviamos a tu correo.`
              : isWeb
                ? `Elige cómo deseas confirmar tu acceso en Web para ${challenge.email}.`
                : `Enviamos un código de 6 dígitos a ${challenge.email} para autorizar este acceso.`}
          </Text>
        </View>

        <Card style={styles.formCard}>
          {isWeb && !isAccountVerify ? (
            <View style={styles.methodBox}>
              <Text style={styles.methodTitle}>Opciones de verificación</Text>
              <Button
                title={codeSent ? 'Reenviar código a mi correo' : 'Enviar código a mi correo'}
                variant={codeSent && !waitingBiometric ? 'secondary' : 'primary'}
                loading={sendingCode && !waitingBiometric}
                onPress={() => void handleSendEmailCode()}
              />
              {supportsRemoteBio ? (
                <Button
                  title="Autorizar con la huella de mi teléfono"
                  variant={waitingBiometric ? 'primary' : 'outline'}
                  loading={sendingCode && waitingBiometric}
                  onPress={() => void handleRequestMobileFingerprint()}
                />
              ) : (
                <View style={styles.infoNote}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.infoNoteText}>
                    Aún no tienes huella digital registrada en tu teléfono Android. Verifica con el
                    código enviado a tu correo y activa tu huella desde la app móvil.
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {waitingBiometric ? (
            <View style={styles.waitingBox}>
              <Ionicons name="finger-print" size={34} color={colors.primary} />
              <Text style={styles.waitingTitle}>Esperando autorización en tu teléfono</Text>
              <Text style={styles.waitingText}>
                Abre la notificación en tu app Android y coloca tu huella digital para entrar en Web.
              </Text>
              <Loader message="Esperando confirmación biométrica..." />
              <Button
                title="Prefiero usar código por correo"
                variant="outline"
                onPress={() => void handleSendEmailCode()}
              />
            </View>
          ) : null}

          {codeSent && !waitingBiometric ? (
            <>
              <Input
                label="Código de verificación (6 dígitos)"
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onBlur={() => setOtpTouched(true)}
                onChangeText={(txt) => {
                  setOtpCode(txt.replace(/[^0-9]/g, ''));
                  setOtpTouched(true);
                  setServerError(null);
                }}
                error={otpLiveError}
              />

              <Button
                title="Verificar código y entrar"
                loading={verifyingCode}
                onPress={() => void handleVerifyCode()}
              />

              {!isWeb || isAccountVerify ? (
                <Button
                  title="Reenviar código al correo"
                  variant="outline"
                  loading={sendingCode}
                  onPress={() => void handleSendEmailCode()}
                />
              ) : null}
            </>
          ) : null}

          {challengeFeedback ? (
            <View style={styles.infoNote}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.infoNoteText}>{challengeFeedback}</Text>
            </View>
          ) : null}

          {serverError ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          ) : null}

          <Button
            title="Cancelar y volver"
            variant="ghost"
            onPress={() => void handleCancelChallenge()}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.brand}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={28} color={colors.textOnPrimary} />
        </View>
        <View style={styles.pillTag}>
          <Text style={styles.pillTagText}>FINTECH DIGITAL</Text>
        </View>
        <Text style={styles.title}>Banco Digital</Text>
        <Text style={styles.subtitle}>Tu dinero, pagos y recargas al instante</Text>
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
              maxLength={100}
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
              maxLength={100}
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
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    ...shadows.hero,
  },
  pillTag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  pillTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  formCard: { gap: spacing.lg },
  methodBox: { gap: spacing.sm },
  methodTitle: { ...typography.subheading, color: colors.text, fontWeight: '700' },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  infoNoteText: { ...typography.caption, color: colors.primary, flex: 1, lineHeight: 18 },
  waitingBox: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  waitingTitle: { ...typography.subheading, color: colors.text, fontWeight: '700', textAlign: 'center' },
  waitingText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { ...typography.caption, color: colors.danger },
  bannerWarn: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bannerWarnText: { ...typography.caption, color: colors.warning, fontWeight: '600' },
});
