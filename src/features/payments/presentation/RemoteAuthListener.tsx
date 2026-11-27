import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, maskAccount } from '@/core/utils/format';
import { accountKeys } from '@/features/accounts/presentation/hooks';
import type { PendingLogin2faDto } from '@/features/auth/data/dto';
import {
  approvePendingLogin2fa,
  confirmPaymentWithFingerprint,
  getPendingLogin2faRequests,
  isBiometricConfirmationAvailable,
  rejectPendingLogin2fa,
} from '@/features/auth/presentation/authActions';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
import {
  approveRemoteAuthorization,
  getPendingRemoteAuthorizations,
  type PagoAutorizacionDto,
  registerPushToken,
  rejectRemoteAuthorization,
} from '@/features/payments/data/authorizationRepository';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { AppModal, Button } from '@/shared/ui';

const POLL_INTERVAL_MS = 3000;

async function setupMobileNotifications(
  onTapAuthorization: (autorizacionId: string) => void,
  onTapLogin2fa: (challengeId: string) => void,
): Promise<() => void> {
  if (Platform.OS === 'web') return () => undefined;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('payment-auth', {
        name: 'Autorización de pagos y accesos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const perms = await Notifications.getPermissionsAsync();
    let granted = perms.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }

    if (granted) {
      let pushToken: string | null = null;
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        if (typeof deviceToken?.data === 'string' && deviceToken.data.length >= 10) {
          pushToken = deviceToken.data;
        }
      } catch {
        // Sin FCM nativo disponible
      }
      if (!pushToken) {
        try {
          const expoToken = await Notifications.getExpoPushTokenAsync();
          if (typeof expoToken?.data === 'string' && expoToken.data.length >= 10) {
            pushToken = expoToken.data;
          }
        } catch {
          // Sin projectId EAS: seguiremos con notificación local + polling en vivo
        }
      }
      if (pushToken) {
        await registerPushToken(
          pushToken,
          Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
          `${Platform.OS.toUpperCase()} Mobile`,
        ).catch(() => undefined);
      }
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        { type?: string; autorizacionId?: string; challengeId?: string } | undefined;
      if (data?.type === 'LOGIN_2FA' && data?.challengeId) {
        onTapLogin2fa(String(data.challengeId));
      } else if (data?.autorizacionId) {
        onTapAuthorization(String(data.autorizacionId));
      }
    });

    return () => sub.remove();
  } catch {
    return () => undefined;
  }
}

async function triggerLocalAuthNotification(auth: PagoAutorizacionDto): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Autoriza tu pago desde Web',
        body: `Confirma con tu huella el pago de ${formatCurrency(auth.monto)} en ${auth.nombreServicio}.`,
        sound: 'default',
        data: {
          type: 'PAYMENT_AUTHORIZATION',
          autorizacionId: auth.idAutorizacion,
        },
      },
      trigger: null,
    });
  } catch {
    // Silencioso si el entorno no soporta notificaciones locales
  }
}

async function triggerLocalLogin2faNotification(loginReq: PendingLogin2faDto): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '¿Autorizas inicio de sesión en Web?',
        body: `Confirma con tu huella el acceso web para ${loginReq.email}.`,
        sound: 'default',
        data: {
          type: 'LOGIN_2FA',
          challengeId: loginReq.challengeId,
        },
      },
      trigger: null,
    });
  } catch {
    // Silencioso si el entorno no soporta notificaciones locales
  }
}

/**
 * Escucha solicitudes de autorización originadas en la Web (pagos e inicio de sesión 2FA).
 * Cuando llega una, dispara notificación en Android y muestra el modal para autorizar con huella digital.
 */
export function RemoteAuthListener() {
  const status = useSessionStore((s) => s.status);
  const queryClient = useQueryClient();

  const [activeAuth, setActiveAuth] = useState<PagoAutorizacionDto | null>(null);
  const [activeLogin, setActiveLogin] = useState<PendingLogin2faDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const notifiedLoginIdsRef = useRef<Set<string>>(new Set());
  const dismissedLoginIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS === 'web' || status !== 'authenticated') {
      setActiveAuth(null);
      setActiveLogin(null);
      return;
    }

    let cancelled = false;
    let cleanupNotif: (() => void) | undefined;

    const checkPending = async (forceOpenId?: string, forceLoginId?: string) => {
      try {
        const list = await getPendingRemoteAuthorizations();
        if (cancelled) return;
        const target = forceOpenId
          ? (list.find((a) => a.idAutorizacion === forceOpenId) ?? list[0])
          : list.find((a) => !dismissedIdsRef.current.has(a.idAutorizacion));

        if (target) {
          if (!notifiedIdsRef.current.has(target.idAutorizacion)) {
            notifiedIdsRef.current.add(target.idAutorizacion);
            void triggerLocalAuthNotification(target);
          }
          setActiveAuth((prev) => (prev?.idAutorizacion === target.idAutorizacion ? prev : target));
          setErrorMsg(null);
          setStatusFeedback(null);
        } else if (!busy) {
          setActiveAuth(null);
        }
      } catch {
        // Error de red transitorio
      }

      try {
        const loginList = await getPendingLogin2faRequests();
        if (cancelled) return;
        const targetLogin = forceLoginId
          ? (loginList.find((l) => l.challengeId === forceLoginId) ?? loginList[0])
          : loginList.find((l) => !dismissedLoginIdsRef.current.has(l.challengeId));

        if (targetLogin) {
          if (!notifiedLoginIdsRef.current.has(targetLogin.challengeId)) {
            notifiedLoginIdsRef.current.add(targetLogin.challengeId);
            void triggerLocalLogin2faNotification(targetLogin);
          }
          setActiveLogin((prev) => (prev?.challengeId === targetLogin.challengeId ? prev : targetLogin));
          setErrorMsg(null);
          setStatusFeedback(null);
        } else if (!busy) {
          setActiveLogin(null);
        }
      } catch {
        // Error de red transitorio
      }
    };

    void setupMobileNotifications(
      (autorizacionId) => {
        dismissedIdsRef.current.delete(autorizacionId);
        void checkPending(autorizacionId, undefined);
      },
      (challengeId) => {
        dismissedLoginIdsRef.current.delete(challengeId);
        void checkPending(undefined, challengeId);
      },
    ).then((fn) => {
      cleanupNotif = fn;
    });

    void checkPending();
    const timer = setInterval(() => {
      void checkPending();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      cleanupNotif?.();
    };
  }, [status, busy]);

  if (Platform.OS === 'web' || status !== 'authenticated' || (!activeAuth && !activeLogin)) {
    return null;
  }

  const handleApprovePayment = async () => {
    if (!activeAuth) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusFeedback(null);
    try {
      const bioAvailable = await isBiometricConfirmationAvailable();
      if (!bioAvailable) {
        setErrorMsg(
          'Activa tu huella digital en Perfil para poder autorizar pagos desde este dispositivo.',
        );
        return;
      }
      const confirmationToken = await confirmPaymentWithFingerprint();
      const updated = await approveRemoteAuthorization(activeAuth.idAutorizacion, confirmationToken);
      dismissedIdsRef.current.add(activeAuth.idAutorizacion);
      await queryClient.invalidateQueries({ queryKey: accountKeys.customer });
      await queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      const msg =
        updated.resultadoPago?.mensaje ??
        'Pago autorizado con huella digital. Ya puedes ver el resultado en la web.';
      setStatusFeedback(msg);
      setTimeout(() => {
        setActiveAuth(null);
        setStatusFeedback(null);
      }, 2200);
    } catch (e) {
      setErrorMsg(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!activeAuth) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await rejectRemoteAuthorization(activeAuth.idAutorizacion);
      dismissedIdsRef.current.add(activeAuth.idAutorizacion);
      setActiveAuth(null);
    } catch (e) {
      setErrorMsg(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const handleApproveLogin = async () => {
    if (!activeLogin) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusFeedback(null);
    try {
      const bioAvailable = await isBiometricConfirmationAvailable();
      if (!bioAvailable) {
        setErrorMsg(
          'Activa tu huella digital en Perfil para poder autorizar accesos desde este dispositivo.',
        );
        return;
      }
      const confirmationToken = await confirmPaymentWithFingerprint();
      await approvePendingLogin2fa(activeLogin.challengeId, confirmationToken);
      dismissedLoginIdsRef.current.add(activeLogin.challengeId);
      setStatusFeedback('Inicio de sesión en Web autorizado con tu huella digital.');
      setTimeout(() => {
        setActiveLogin(null);
        setStatusFeedback(null);
      }, 1800);
    } catch (e) {
      setErrorMsg(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRejectLogin = async () => {
    if (!activeLogin) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await rejectPendingLogin2fa(activeLogin.challengeId);
      dismissedLoginIdsRef.current.add(activeLogin.challengeId);
      setActiveLogin(null);
    } catch (e) {
      setErrorMsg(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (activeAuth) {
    return (
      <AppModal
        visible={Boolean(activeAuth)}
        title="¿Autorizas este pago desde Web?"
        onRequestClose={() => {
          if (!busy) {
            dismissedIdsRef.current.add(activeAuth.idAutorizacion);
            setActiveAuth(null);
          }
        }}
        actions={
          <>
            <Button
              title="Autorizar con huella digital"
              loading={busy}
              disabled={Boolean(statusFeedback)}
              onPress={() => void handleApprovePayment()}
            />
            <Button
              title="Rechazar pago"
              variant="danger"
              disabled={busy || Boolean(statusFeedback)}
              onPress={() => void handleRejectPayment()}
            />
          </>
        }
      >
        <View style={styles.headerBadge}>
          <Ionicons name="finger-print" size={28} color={colors.primary} />
          <Text style={styles.headerText}>
            Se inició un pago en tu sesión Web. Confírmalo con tu huella digital solo si tú lo
            solicitaste.
          </Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.row}>
            <Text style={styles.label}>Servicio</Text>
            <Text style={styles.value}>{activeAuth.nombreServicio}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Producto</Text>
            <Text style={styles.value}>{activeAuth.nombreProducto}</Text>
          </View>
          {activeAuth.destinoEnmascarado ? (
            <View style={styles.row}>
              <Text style={styles.label}>
                {activeAuth.tipoPago === 'RECARGA' ? 'Teléfono' : 'Referencia'}
              </Text>
              <Text style={styles.value}>{activeAuth.destinoEnmascarado}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Cuenta</Text>
            <Text style={styles.value}>{maskAccount(activeAuth.numCuenta)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monto</Text>
            <Text style={styles.amount}>{formatCurrency(activeAuth.monto)}</Text>
          </View>
        </View>

        {errorMsg ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMsg}
          </Text>
        ) : null}
        {statusFeedback ? (
          <Text accessibilityRole="summary" style={styles.success}>
            {statusFeedback}
          </Text>
        ) : null}
      </AppModal>
    );
  }

  return (
    <AppModal
      visible={Boolean(activeLogin)}
      title="¿Autorizas inicio de sesión en Web?"
      onRequestClose={() => {
        if (!busy && activeLogin) {
          dismissedLoginIdsRef.current.add(activeLogin.challengeId);
          setActiveLogin(null);
        }
      }}
      actions={
        <>
          <Button
            title="Autorizar acceso con huella"
            loading={busy}
            disabled={Boolean(statusFeedback)}
            onPress={() => void handleApproveLogin()}
          />
          <Button
            title="Rechazar acceso"
            variant="danger"
            disabled={busy || Boolean(statusFeedback)}
            onPress={() => void handleRejectLogin()}
          />
        </>
      }
    >
      <View style={styles.headerBadge}>
        <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
        <Text style={styles.headerText}>
          Alguien intenta iniciar sesión en Banco Digital Web con tu cuenta. Confírmalo con tu huella
          digital solo si eres tú.
        </Text>
      </View>

      {activeLogin ? (
        <View style={styles.summary}>
          <View style={styles.row}>
            <Text style={styles.label}>Cuenta</Text>
            <Text style={styles.value}>{activeLogin.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Canal</Text>
            <Text style={styles.value}>{activeLogin.channel}</Text>
          </View>
        </View>
      ) : null}

      {errorMsg ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMsg}
        </Text>
      ) : null}
      {statusFeedback ? (
        <Text accessibilityRole="summary" style={styles.success}>
          {statusFeedback}
        </Text>
      ) : null}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    ...typography.caption,
    color: colors.primary,
    flex: 1,
    lineHeight: 18,
  },
  summary: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: { ...typography.caption, color: colors.textMuted },
  value: { ...typography.caption, color: colors.text, fontWeight: '600', flexShrink: 1 },
  amount: { ...typography.subheading, color: colors.primary },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  success: { ...typography.caption, color: colors.success, fontWeight: '600', marginTop: spacing.xs },
});
