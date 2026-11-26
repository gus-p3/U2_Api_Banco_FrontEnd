import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { http } from '@/core/http/client';
import { formatDateTime, initials } from '@/core/utils/format';
import { validatePhone10 } from '@/core/validation/validators';
import { accountKeys, useCustomer } from '@/features/accounts/presentation/hooks';
import { authDeps } from '@/features/auth/di';
import {
  activateBiometrics,
  deactivateBiometrics,
  signOut,
} from '@/features/auth/presentation/authActions';
import { EMAIL_REGEX } from '@/features/auth/presentation/loginSchema';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { AppModal, Button, Card, Input, Loader, Screen } from '@/shared/ui';

const sanitizeLettersOnly = (txt: string) => txt.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, '');

export function ProfileScreen() {
  const queryClient = useQueryClient();
  const session = useSessionStore((s) => s.session);
  const remaining = useSessionStore((s) => s.remainingSeconds);
  const { data: customer, isLoading } = useCustomer();

  const [bioSupported, setBioSupported] = useState(false);
  const [localEnrolled, setLocalEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

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

  const handleOpenEdit = () => {
    setEditEmail(customer?.email ?? session?.email ?? '');
    setEditPhone(customer?.mobilePhone ?? '');
    setEditOccupation(customer?.occupation ?? '');
    setEditCompany(customer?.company ?? '');
    setEditError(null);
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    const identificador = customer?.curp ?? customer?.rfc;
    if (!identificador) {
      setEditError('No se encontró tu CURP o RFC para actualizar el perfil.');
      return;
    }

    const cleanEmail = editEmail.trim();
    const cleanPhone = editPhone.trim();
    const cleanOccupation = editOccupation.trim();
    const cleanCompany = editCompany.trim();

    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      setEditError('El formato del correo electrónico es inválido.');
      return;
    }
    if (cleanPhone) {
      const phoneErr = validatePhone10(cleanPhone);
      if (phoneErr) {
        setEditError(phoneErr);
        return;
      }
    }
    if (cleanOccupation && (cleanOccupation.length < 3 || cleanOccupation.length > 80)) {
      setEditError('La ocupación debe tener entre 3 y 80 caracteres.');
      return;
    }
    if (cleanCompany && (cleanCompany.length < 3 || cleanCompany.length > 100)) {
      setEditError('La empresa debe tener entre 3 y 100 caracteres.');
      return;
    }

    const body: Record<string, string> = { identificador };
    if (cleanEmail && cleanEmail !== (customer?.email ?? session?.email)) {
      body.email = cleanEmail;
    }
    if (cleanPhone && cleanPhone !== customer?.mobilePhone) {
      body.mobilePhone = cleanPhone;
    }
    if (cleanOccupation && cleanOccupation !== customer?.occupation) {
      body.occupation = cleanOccupation;
    }
    if (cleanCompany && cleanCompany !== customer?.company) {
      body.company = cleanCompany;
    }

    if (Object.keys(body).length === 1) {
      setEditOpen(false);
      return;
    }

    setSavingProfile(true);
    setEditError(null);
    try {
      await http.patch('/v1/clientes', body);
      await queryClient.invalidateQueries({ queryKey: accountKeys.customer });
      setEditOpen(false);
      setFeedback('Perfil actualizado correctamente.');
    } catch (e) {
      setEditError(toAppError(e).message);
    } finally {
      setSavingProfile(false);
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
            <Text style={styles.section}>Datos de contacto y empleo</Text>
            <Button title="Editar" variant="outline" fullWidth={false} onPress={handleOpenEdit} />
          </View>
          <InfoRow label="Teléfono móvil" value={customer.mobilePhone ?? '—'} />
          <InfoRow label="Domicilio" value={customer.address ?? '—'} />
          <InfoRow label="Ocupación" value={customer.occupation ?? '—'} />
          <InfoRow label="Empresa" value={customer.company ?? '—'} />
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

      <AppModal
        visible={editOpen}
        title="Editar perfil"
        onRequestClose={() => setEditOpen(false)}
        actions={
          <>
            <Button
              title="Guardar cambios"
              loading={savingProfile}
              onPress={() => void handleSaveProfile()}
            />
            <Button title="Cancelar" variant="ghost" onPress={() => setEditOpen(false)} />
          </>
        }
      >
        <View style={styles.editForm}>
          <Input
            label="Correo electrónico"
            keyboardType="email-address"
            maxLength={100}
            value={editEmail}
            onChangeText={setEditEmail}
          />
          <Input
            label="Teléfono móvil (10 dígitos)"
            keyboardType="number-pad"
            maxLength={10}
            value={editPhone}
            onChangeText={(txt) => setEditPhone(txt.replace(/[^0-9]/g, ''))}
          />
          <Input
            label="Ocupación"
            maxLength={80}
            value={editOccupation}
            onChangeText={(txt) => setEditOccupation(sanitizeLettersOnly(txt))}
          />
          <Input label="Empresa" maxLength={100} value={editCompany} onChangeText={setEditCompany} />
          {editError ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {editError}
            </Text>
          ) : null}
        </View>
      </AppModal>
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
  editForm: { gap: spacing.md },
  errorText: { ...typography.caption, color: colors.danger },
});
