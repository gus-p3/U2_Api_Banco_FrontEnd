import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency, formatDateTime, initials } from '@/core/utils/format';
import { useCustomer } from '@/features/accounts/presentation/hooks';
import { authDeps } from '@/features/auth/di';
import {
  activateBiometrics,
  deactivateBiometrics,
  signOut,
} from '@/features/auth/presentation/authActions';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Button, Card, Loader, Screen } from '@/shared/ui';

export function ProfileScreen() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const remaining = useSessionStore((s) => s.remainingSeconds);
  const { data: customer, isLoading } = useCustomer();

  const [bioSupported, setBioSupported] = useState(false);
  const [localEnrolled, setLocalEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const avail = await authDeps.biometrics.isAvailable();
      setBioSupported(avail);
      if (session?.email) {
        const s = await authDeps.store.getBiometricSecret(session.email);
        setLocalEnrolled(!!s);
      }
    })();
  }, [session?.email]);

  const handleToggleBio = async () => {
    setFeedback(null);
    setBusy(true);
    try {
      if (localEnrolled) {
        await deactivateBiometrics();
        setLocalEnrolled(false);
        setFeedback('Huella desvinculada de este dispositivo.');
      } else {
        await activateBiometrics();
        setLocalEnrolled(true);
        setFeedback('Huella activada correctamente para iniciar sesión y autorizar pagos.');
      }
    } catch (e) {
      setFeedback(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Perfil y seguridad</Text>

      {isLoading ? (
        <Loader message="Cargando perfil..." />
      ) : (
        <Card style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(customer?.fullName ?? session?.email)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{customer?.fullName ?? 'Cliente'}</Text>
            <Text style={styles.meta}>{customer?.email ?? session?.email}</Text>
            {customer?.curp ? <Text style={styles.meta}>CURP: {customer.curp}</Text> : null}
            {customer?.rfc ? <Text style={styles.meta}>RFC: {customer.rfc}</Text> : null}
          </View>
        </Card>
      )}

      {customer ? (
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.section}>Datos de contacto, domicilio y empleo</Text>
            <Button
              title="Editar"
              variant="outline"
              fullWidth={false}
              onPress={() => router.push('/profile/edit')}
            />
          </View>
          <InfoRow label="Teléfono móvil" value={customer.mobilePhone ?? '—'} />
          {customer.alternativePhone ? (
            <InfoRow label="Teléfono alternativo" value={customer.alternativePhone} />
          ) : null}
          <InfoRow label="Domicilio" value={customer.address ?? '—'} />
          <InfoRow
            label="Profesión / Ocupación"
            value={customer.professionName ?? customer.occupation ?? '—'}
          />
          <InfoRow label="Empresa" value={customer.company ?? '—'} />
          {customer.monthlyIncome != null ? (
            <InfoRow label="Ingreso mensual" value={formatCurrency(customer.monthlyIncome)} />
          ) : null}
          <InfoRow
            label="Monto de operación (límite)"
            value={customer.operationAmountLabel ?? 'Sin límite configurado'}
          />
          {customer.genderName ? <InfoRow label="Género" value={customer.genderName} /> : null}
          {customer.nationalityName ? (
            <InfoRow label="Nacionalidad" value={customer.nationalityName} />
          ) : null}
          {customer.maritalStatusName ? (
            <InfoRow label="Estado civil" value={customer.maritalStatusName} />
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.section}>Seguridad y sesión</Text>
        <InfoRow label="Método de acceso actual" value={session?.authMethod ?? '—'} />
        <InfoRow
          label="Último acceso"
          value={session?.lastLoginAt ? formatDateTime(session.lastLoginAt) : 'Sesión actual'}
        />
        <InfoRow
          label="Tiempo restante de la sesión"
          value={remaining !== null ? `${remaining} s` : '—'}
        />

        {Platform.OS === 'web' ? (
          <Text style={styles.hint}>
            El enrolamiento de huella digital está disponible desde la aplicación Android.
          </Text>
        ) : bioSupported ? (
          <Button
            title={
              localEnrolled
                ? 'Desactivar huella en este dispositivo'
                : 'Activar acceso y pagos con huella'
            }
            variant={localEnrolled ? 'outline' : 'secondary'}
            loading={busy}
            onPress={() => void handleToggleBio()}
          />
        ) : (
          <Text style={styles.hint}>
            Configura una huella en los ajustes de tu dispositivo Android para habilitar biometría.
          </Text>
        )}

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </Card>

      <Button title="Cerrar sesión segura" variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  headerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.textOnPrimary },
  headerInfo: { flex: 1, gap: 2 },
  name: { ...typography.subheading, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textMuted },
  card: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  section: { ...typography.subheading, color: colors.text, fontWeight: '700', flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.caption, color: colors.textMuted },
  rowValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  hint: { ...typography.caption, color: colors.textMuted },
  feedback: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
