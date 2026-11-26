import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { http } from '@/core/http/client';
import { formatCurrency, formatDateTime, initials } from '@/core/utils/format';
import { validatePhone10 } from '@/core/validation/validators';
import { accountKeys, useCustomer } from '@/features/accounts/presentation/hooks';
import { authDeps } from '@/features/auth/di';
import {
  activateBiometrics,
  deactivateBiometrics,
  signOut,
} from '@/features/auth/presentation/authActions';
import { EMAIL_REGEX } from '@/features/auth/presentation/loginSchema';
import { INCOME_REGEX } from '@/features/auth/presentation/registerSchema';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
import {
  useGenders,
  useMaritalStatuses,
  useMunicipalities,
  useNationalities,
  useStates,
} from '@/features/catalogs/presentation/hooks';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { AppModal, Button, Card, Input, Loader, Screen, SelectField } from '@/shared/ui';

type EditTab = 'contacto' | 'domicilio' | 'empleo' | 'personales';

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
  const [editTab, setEditTab] = useState<EditTab>('contacto');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAltPhone, setEditAltPhone] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editExterior, setEditExterior] = useState('');
  const [editInterior, setEditInterior] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editStateCode, setEditStateCode] = useState('');
  const [editMunicipalityId, setEditMunicipalityId] = useState<number | null>(null);
  const [editOccupation, setEditOccupation] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editIncome, setEditIncome] = useState('');
  const [editGenderId, setEditGenderId] = useState<number | null>(null);
  const [editNationalityId, setEditNationalityId] = useState<number | null>(null);
  const [editMaritalId, setEditMaritalId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const genders = useGenders();
  const nationalities = useNationalities();
  const marital = useMaritalStatuses();
  const states = useStates();
  const municipalities = useMunicipalities(editStateCode || undefined);

  const genderOptions = useMemo(
    () => (genders.data ?? []).map((g) => ({ value: g.id, label: g.name })),
    [genders.data],
  );
  const nationalityOptions = useMemo(
    () => (nationalities.data ?? []).map((n) => ({ value: n.id, label: n.name })),
    [nationalities.data],
  );
  const maritalOptions = useMemo(
    () => (marital.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    [marital.data],
  );
  const stateOptions = useMemo(
    () => (states.data ?? []).map((s) => ({ value: s.code, label: s.name })),
    [states.data],
  );
  const municipalityOptions = useMemo(
    () => (municipalities.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    [municipalities.data],
  );

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
    setEditTab('contacto');
    setEditEmail(customer?.email ?? session?.email ?? '');
    setEditPhone(customer?.mobilePhone ?? '');
    setEditAltPhone(customer?.alternativePhone ?? '');
    setEditStreet(customer?.street ?? '');
    setEditExterior(customer?.exteriorNumber ?? '');
    setEditInterior(customer?.interiorNumber ?? '');
    setEditNeighborhood(customer?.neighborhood ?? '');
    setEditPostalCode(customer?.postalCode ?? '');
    setEditStateCode('');
    setEditMunicipalityId(null);
    setEditOccupation(customer?.occupation ?? '');
    setEditCompany(customer?.company ?? '');
    setEditIncome(customer?.monthlyIncome != null ? String(customer.monthlyIncome) : '');
    setEditGenderId(null);
    setEditNationalityId(null);
    setEditMaritalId(null);
    setEditError(null);
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    const identificador = customer?.curp ?? customer?.rfc;
    if (!identificador) {
      setEditError('No se encontró tu CURP o RFC para actualizar el perfil.');
      return;
    }

    const body: Record<string, string | number> = { identificador };

    // Contacto
    const cleanEmail = editEmail.trim();
    if (cleanEmail && cleanEmail !== (customer?.email ?? session?.email)) {
      if (!EMAIL_REGEX.test(cleanEmail)) {
        setEditError('El formato del correo electrónico es inválido.');
        return;
      }
      body.email = cleanEmail;
    }
    const cleanPhone = editPhone.trim();
    if (cleanPhone && cleanPhone !== customer?.mobilePhone) {
      const phoneErr = validatePhone10(cleanPhone);
      if (phoneErr) {
        setEditError(phoneErr);
        return;
      }
      body.mobilePhone = cleanPhone;
    }
    const cleanAltPhone = editAltPhone.trim();
    if (cleanAltPhone && cleanAltPhone !== (customer?.alternativePhone ?? '')) {
      const altErr = validatePhone10(cleanAltPhone);
      if (altErr) {
        setEditError(`Teléfono alternativo: ${altErr}`);
        return;
      }
      body.alternativePhone = cleanAltPhone;
    }

    // Domicilio
    const cleanStreet = editStreet.trim();
    if (cleanStreet && cleanStreet !== (customer?.street ?? '')) {
      if (cleanStreet.length < 3 || cleanStreet.length > 100) {
        setEditError('La calle debe tener entre 3 y 100 caracteres.');
        return;
      }
      body.street = cleanStreet;
    }
    const cleanExterior = editExterior.trim();
    if (cleanExterior && cleanExterior !== (customer?.exteriorNumber ?? '')) {
      if (cleanExterior.length < 1 || cleanExterior.length > 10) {
        setEditError('El número exterior debe tener entre 1 y 10 caracteres.');
        return;
      }
      body.exteriorNumber = cleanExterior;
    }
    const cleanInterior = editInterior.trim();
    if (cleanInterior && cleanInterior !== (customer?.interiorNumber ?? '')) {
      if (cleanInterior.length > 10) {
        setEditError('El número interior no puede superar 10 caracteres.');
        return;
      }
      body.interiorNumber = cleanInterior;
    }
    const cleanNeighborhood = editNeighborhood.trim();
    if (cleanNeighborhood && cleanNeighborhood !== (customer?.neighborhood ?? '')) {
      if (cleanNeighborhood.length < 2 || cleanNeighborhood.length > 80) {
        setEditError('La colonia debe tener entre 2 y 80 caracteres.');
        return;
      }
      body.neighborhood = cleanNeighborhood;
    }
    const cleanPostal = editPostalCode.trim();
    if (cleanPostal && cleanPostal !== (customer?.postalCode ?? '')) {
      if (!/^[0-9]{5}$/.test(cleanPostal)) {
        setEditError('El código postal debe contener exactamente 5 dígitos numéricos.');
        return;
      }
      body.postalCode = cleanPostal;
    }
    if (editMunicipalityId && editMunicipalityId > 0) {
      body.idMunicipality = editMunicipalityId;
    }

    // Empleo
    const cleanOccupation = editOccupation.trim();
    if (cleanOccupation && cleanOccupation !== (customer?.occupation ?? '')) {
      if (cleanOccupation.length < 3 || cleanOccupation.length > 80) {
        setEditError('La ocupación debe tener entre 3 y 80 caracteres.');
        return;
      }
      body.occupation = cleanOccupation;
    }
    const cleanCompany = editCompany.trim();
    if (cleanCompany && cleanCompany !== (customer?.company ?? '')) {
      if (cleanCompany.length < 3 || cleanCompany.length > 100) {
        setEditError('La empresa debe tener entre 3 y 100 caracteres.');
        return;
      }
      body.company = cleanCompany;
    }
    const cleanIncome = editIncome.trim();
    if (
      cleanIncome &&
      cleanIncome !== (customer?.monthlyIncome != null ? String(customer.monthlyIncome) : '')
    ) {
      if (!INCOME_REGEX.test(cleanIncome) || Number(cleanIncome) < 0.01) {
        setEditError('El ingreso mensual debe ser mayor a cero (máximo 2 decimales).');
        return;
      }
      body.monthlyIncome = Number(cleanIncome);
    }

    // Personales (catálogos)
    if (editGenderId && editGenderId > 0) body.idGender = editGenderId;
    if (editNationalityId && editNationalityId > 0) body.idNationality = editNationalityId;
    if (editMaritalId && editMaritalId > 0) body.idMaritalStatus = editMaritalId;

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
            <Text style={styles.section}>Datos de contacto, domicilio y empleo</Text>
            <Button title="Editar" variant="outline" fullWidth={false} onPress={handleOpenEdit} />
          </View>
          <InfoRow label="Teléfono móvil" value={customer.mobilePhone ?? '—'} />
          {customer.alternativePhone ? (
            <InfoRow label="Teléfono alternativo" value={customer.alternativePhone} />
          ) : null}
          <InfoRow label="Domicilio" value={customer.address ?? '—'} />
          <InfoRow label="Ocupación" value={customer.occupation ?? '—'} />
          <InfoRow label="Empresa" value={customer.company ?? '—'} />
          {customer.monthlyIncome != null ? (
            <InfoRow label="Ingreso mensual" value={formatCurrency(customer.monthlyIncome)} />
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

      <AppModal
        visible={editOpen}
        title="Editar mi perfil"
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
        <View style={styles.tabRow}>
          {(
            [
              { key: 'contacto', label: 'Contacto' },
              { key: 'domicilio', label: 'Domicilio' },
              { key: 'empleo', label: 'Empleo' },
              { key: 'personales', label: 'Personales' },
            ] as const
          ).map((t) => {
            const active = editTab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.tabPill, active && styles.tabPillActive]}
                onPress={() => setEditTab(t.key)}
              >
                <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.editForm}>
            {editTab === 'contacto' ? (
              <>
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
                  label="Teléfono alternativo (opcional, 10 dígitos)"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={editAltPhone}
                  onChangeText={(txt) => setEditAltPhone(txt.replace(/[^0-9]/g, ''))}
                />
              </>
            ) : null}

            {editTab === 'domicilio' ? (
              <>
                <SelectField
                  label="Entidad federativa (para cambiar municipio)"
                  placeholder="Selecciona un estado"
                  value={editStateCode || null}
                  options={stateOptions}
                  loading={states.isLoading}
                  searchable
                  onSelect={(code) => {
                    setEditStateCode(code);
                    setEditMunicipalityId(null);
                  }}
                />
                <SelectField
                  label="Municipio o Alcaldía"
                  placeholder={
                    editStateCode ? 'Selecciona tu municipio' : 'Primero selecciona un estado'
                  }
                  value={editMunicipalityId}
                  options={municipalityOptions}
                  loading={Boolean(editStateCode) && municipalities.isLoading}
                  disabled={!editStateCode}
                  searchable
                  onSelect={setEditMunicipalityId}
                />
                <Input label="Calle" maxLength={100} value={editStreet} onChangeText={setEditStreet} />
                <Input
                  label="Número exterior"
                  maxLength={10}
                  value={editExterior}
                  onChangeText={setEditExterior}
                />
                <Input
                  label="Número interior (opcional)"
                  maxLength={10}
                  value={editInterior}
                  onChangeText={setEditInterior}
                />
                <Input
                  label="Colonia"
                  maxLength={80}
                  value={editNeighborhood}
                  onChangeText={setEditNeighborhood}
                />
                <Input
                  label="Código postal (5 dígitos)"
                  keyboardType="number-pad"
                  maxLength={5}
                  value={editPostalCode}
                  onChangeText={(txt) => setEditPostalCode(txt.replace(/[^0-9]/g, ''))}
                />
              </>
            ) : null}

            {editTab === 'empleo' ? (
              <>
                <Input
                  label="Ocupación"
                  maxLength={80}
                  value={editOccupation}
                  onChangeText={(txt) => setEditOccupation(sanitizeLettersOnly(txt))}
                />
                <Input
                  label="Empresa"
                  maxLength={100}
                  value={editCompany}
                  onChangeText={setEditCompany}
                />
                <Input
                  label="Ingreso mensual (MXN)"
                  keyboardType="decimal-pad"
                  value={editIncome}
                  onChangeText={(txt) => setEditIncome(txt.replace(/[^0-9.]/g, ''))}
                />
              </>
            ) : null}

            {editTab === 'personales' ? (
              <>
                <SelectField
                  label="Género"
                  placeholder="Sin cambios"
                  value={editGenderId}
                  options={genderOptions}
                  loading={genders.isLoading}
                  onSelect={setEditGenderId}
                />
                <SelectField
                  label="Nacionalidad"
                  placeholder="Sin cambios"
                  value={editNationalityId}
                  options={nationalityOptions}
                  loading={nationalities.isLoading}
                  searchable
                  onSelect={setEditNationalityId}
                />
                <SelectField
                  label="Estado civil"
                  placeholder="Sin cambios"
                  value={editMaritalId}
                  options={maritalOptions}
                  loading={marital.isLoading}
                  onSelect={setEditMaritalId}
                />
              </>
            ) : null}
          </View>
        </ScrollView>

        {editError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {editError}
          </Text>
        ) : null}
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
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tabPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabPillText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  tabPillTextActive: { color: colors.textOnPrimary, fontWeight: '700' },
  modalScroll: { maxHeight: 340 },
  editForm: { gap: spacing.md, paddingBottom: spacing.sm },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
