import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

const sanitizeLettersOnly = (txt: string) => txt.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, '');
const sanitizeCurp = (txt: string) => txt.toUpperCase().replace(/[^A-Z0-9]/g, '');
const sanitizeRfc = (txt: string) => txt.toUpperCase().replace(/[^A-ZÑ0-9]/g, '');

import { toAppError } from '@/core/errors/toAppError';
import { http } from '@/core/http/client';
import {
  useGenders,
  useMaritalStatuses,
  useMunicipalities,
  useNationalities,
  useStates,
} from '@/features/catalogs/presentation/hooks';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { BirthDatePickerField, Button, Card, Input, Screen, SelectField } from '@/shared/ui';

import { signInWithPassword } from './authActions';
import { type RegisterFormValues, registerSchema } from './registerSchema';

const STEPS: Array<{
  title: string;
  subtitle: string;
  fields: Array<keyof RegisterFormValues>;
}> = [
  {
    title: 'Datos personales',
    subtitle: 'Cuéntanos sobre ti. Debes ser mayor de 18 años.',
    fields: ['name', 'lastName', 'birthDate', 'idGender', 'idNationality', 'idMaritalStatus'],
  },
  {
    title: 'Identificación y contacto',
    subtitle: 'Usaremos estos datos para validar tu identidad y contactarte.',
    fields: ['curp', 'rfc', 'email', 'mobilePhone'],
  },
  {
    title: 'Domicilio',
    subtitle: 'Selecciona tu entidad, municipio y dirección actual.',
    fields: ['claveEntidad', 'idMunicipality', 'street', 'exteriorNumber', 'neighborhood', 'postalCode'],
  },
  {
    title: 'Empleo y seguridad',
    subtitle: 'Último paso para activar tu cuenta bancaria digital.',
    fields: ['occupation', 'company', 'monthlyIncome', 'password', 'confirmPassword'],
  },
];

export function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const genders = useGenders();
  const nationalities = useNationalities();
  const marital = useMaritalStatuses();
  const states = useStates();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      lastName: '',
      birthDate: '',
      curp: '',
      rfc: '',
      idGender: 0,
      idNationality: 0,
      idMaritalStatus: 0,
      email: '',
      mobilePhone: '',
      street: '',
      exteriorNumber: '',
      neighborhood: '',
      claveEntidad: '',
      idMunicipality: 0,
      postalCode: '',
      occupation: '',
      company: '',
      monthlyIncome: '',
      password: '',
      confirmPassword: '',
    },
  });

  const selectedState = watch('claveEntidad');
  const passwordValue = watch('password');
  const confirmPasswordValue = watch('confirmPassword');
  const municipalities = useMunicipalities(selectedState || undefined);

  const passwordRules = useMemo(
    () => [
      {
        label: 'Entre 12 y 100 caracteres',
        ok: passwordValue.length >= 12 && passwordValue.length <= 100,
      },
      { label: 'Al menos una letra mayúscula (A–Z)', ok: /[A-Z]/.test(passwordValue) },
      { label: 'Al menos una letra minúscula (a–z)', ok: /[a-z]/.test(passwordValue) },
      { label: 'Al menos un número (0–9)', ok: /\d/.test(passwordValue) },
      {
        label: 'Al menos un carácter especial (@$!%*?&#._-)',
        ok: /[@$!%*?&#._-]/.test(passwordValue),
      },
    ],
    [passwordValue],
  );
  const passwordsMatch = confirmPasswordValue.length > 0 && passwordValue === confirmPasswordValue;

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

  const currentStep = STEPS[step] ?? STEPS[0]!;

  const handleNextStep = async () => {
    setServerError(null);
    const valid = await trigger(currentStep.fields);
    if (valid) {
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
  };

  const handlePrevStep = () => {
    setServerError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const onSubmit = async (v: RegisterFormValues) => {
    setServerError(null);
    try {
      const body = {
        name: v.name.trim(),
        lastName: v.lastName.trim(),
        birthDate: v.birthDate.trim(),
        curp: v.curp.trim().toUpperCase(),
        rfc: v.rfc.trim().toUpperCase(),
        idGender: v.idGender,
        idNationality: v.idNationality,
        idMaritalStatus: v.idMaritalStatus,
        email: v.email.trim(),
        mobilePhone: v.mobilePhone.trim(),
        street: v.street.trim(),
        exteriorNumber: v.exteriorNumber.trim(),
        neighborhood: v.neighborhood.trim(),
        idMunicipality: v.idMunicipality,
        claveEntidad: v.claveEntidad.trim(),
        postalCode: v.postalCode.trim(),
        occupation: v.occupation.trim(),
        company: v.company.trim(),
        monthlyIncome: Number(v.monthlyIncome),
        initialBalance: 1000,
        password: v.password,
      };
      await http.post('/v1/clientes', body, { skipAuth: true });
      await signInWithPassword(v.email.trim(), v.password);
    } catch (e) {
      setServerError(toAppError(e).message);
    }
  };

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <Screen>
      <Text style={styles.title}>Apertura de cuenta</Text>
      <Text style={styles.stepCounter}>
        Paso {step + 1} de {STEPS.length} · {currentStep.title}
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <Card style={styles.card}>
        <Text style={styles.section}>{currentStep.title}</Text>
        <Text style={styles.subtitle}>{currentStep.subtitle}</Text>

        {step === 0 ? (
          <>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input
                  label="Nombre(s)"
                  placeholder="Ej. Alejandro"
                  maxLength={50}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeLettersOnly(txt))}
                  error={errors.name?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="lastName"
              render={({ field }) => (
                <Input
                  label="Apellidos"
                  placeholder="Ej. Hernández"
                  maxLength={50}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeLettersOnly(txt))}
                  error={errors.lastName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="birthDate"
              render={({ field }) => (
                <BirthDatePickerField
                  label="Fecha de nacimiento"
                  value={field.value}
                  onChange={(iso) => {
                    field.onChange(iso);
                    clearErrors('birthDate');
                  }}
                  error={errors.birthDate?.message}
                />
              )}
            />
            <SelectField
              label="Género"
              placeholder="Selecciona tu género"
              value={watch('idGender') || null}
              options={genderOptions}
              loading={genders.isLoading}
              onSelect={(val) => {
                setValue('idGender', val, { shouldValidate: true, shouldTouch: true });
              }}
              error={errors.idGender?.message}
            />
            <SelectField
              label="Nacionalidad"
              placeholder="Selecciona tu nacionalidad"
              value={watch('idNationality') || null}
              options={nationalityOptions}
              loading={nationalities.isLoading}
              searchable
              onSelect={(val) => {
                setValue('idNationality', val, { shouldValidate: true, shouldTouch: true });
              }}
              error={errors.idNationality?.message}
            />
            <SelectField
              label="Estado civil"
              placeholder="Selecciona tu estado civil"
              value={watch('idMaritalStatus') || null}
              options={maritalOptions}
              loading={marital.isLoading}
              onSelect={(val) => {
                setValue('idMaritalStatus', val, { shouldValidate: true, shouldTouch: true });
              }}
              error={errors.idMaritalStatus?.message}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Controller
              control={control}
              name="curp"
              render={({ field }) => (
                <Input
                  label="CURP (18 caracteres)"
                  placeholder="HERA950515HDFRND01"
                  autoCapitalize="characters"
                  maxLength={18}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeCurp(txt))}
                  error={errors.curp?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="rfc"
              render={({ field }) => (
                <Input
                  label="RFC (12 o 13 caracteres)"
                  placeholder="HERA950515ABC"
                  autoCapitalize="characters"
                  maxLength={13}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeRfc(txt))}
                  error={errors.rfc?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Input
                  label="Correo electrónico"
                  keyboardType="email-address"
                  placeholder="correo@ejemplo.com"
                  maxLength={100}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.email?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="mobilePhone"
              render={({ field }) => (
                <Input
                  label="Teléfono celular (10 dígitos)"
                  keyboardType="number-pad"
                  placeholder="5512345678"
                  maxLength={10}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(txt.replace(/[^0-9]/g, ''))}
                  error={errors.mobilePhone?.message}
                />
              )}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <SelectField
              label="Entidad federativa (Estado)"
              placeholder="Selecciona tu estado"
              value={selectedState || null}
              options={stateOptions}
              loading={states.isLoading}
              searchable
              onSelect={(code) => {
                setValue('claveEntidad', code, { shouldValidate: true, shouldTouch: true });
                // Reinicia municipio sin disparar validación prematura antes de que el usuario elija
                setValue('idMunicipality', 0, {
                  shouldValidate: false,
                  shouldDirty: false,
                  shouldTouch: false,
                });
                clearErrors('idMunicipality');
              }}
              error={errors.claveEntidad?.message}
            />
            <SelectField
              label="Municipio o Alcaldía"
              placeholder={
                selectedState ? 'Selecciona tu municipio' : 'Primero selecciona una entidad federativa'
              }
              value={watch('idMunicipality') || null}
              options={municipalityOptions}
              loading={Boolean(selectedState) && municipalities.isLoading}
              disabled={!selectedState}
              searchable
              emptyText="No se encontraron municipios para este estado"
              onSelect={(id) => {
                setValue('idMunicipality', id, { shouldValidate: true, shouldTouch: true });
              }}
              error={errors.idMunicipality?.message}
            />
            <Controller
              control={control}
              name="street"
              render={({ field }) => (
                <Input
                  label="Calle"
                  placeholder="Av. Reforma"
                  maxLength={100}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.street?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="exteriorNumber"
              render={({ field }) => (
                <Input
                  label="Número exterior"
                  placeholder="123"
                  maxLength={20}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.exteriorNumber?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="neighborhood"
              render={({ field }) => (
                <Input
                  label="Colonia"
                  placeholder="Juárez"
                  maxLength={100}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.neighborhood?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="postalCode"
              render={({ field }) => (
                <Input
                  label="Código postal (5 dígitos)"
                  keyboardType="number-pad"
                  placeholder="06600"
                  maxLength={5}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(txt.replace(/[^0-9]/g, ''))}
                  error={errors.postalCode?.message}
                />
              )}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Controller
              control={control}
              name="occupation"
              render={({ field }) => (
                <Input
                  label="Ocupación"
                  placeholder="Ingeniero de software"
                  maxLength={80}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeLettersOnly(txt))}
                  error={errors.occupation?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="company"
              render={({ field }) => (
                <Input
                  label="Empresa"
                  placeholder="Tecnología MX"
                  maxLength={100}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.company?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="monthlyIncome"
              render={({ field }) => (
                <Input
                  label="Ingreso mensual (MXN)"
                  keyboardType="decimal-pad"
                  placeholder="25000"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(txt.replace(/[^0-9.]/g, ''))}
                  error={errors.monthlyIncome?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Input
                  label="Contraseña"
                  placeholder="Mínimo 12 caracteres"
                  secureTextEntry
                  maxLength={100}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.password?.message}
                />
              )}
            />
            <View style={styles.checklistBox}>
              <Text style={styles.checklistTitle}>Requisitos de seguridad</Text>
              {passwordRules.map((rule) => (
                <View key={rule.label} style={styles.checklistRow}>
                  <Ionicons
                    name={rule.ok ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={rule.ok ? colors.success : colors.textMuted}
                  />
                  <Text style={[styles.checklistText, rule.ok && styles.checklistTextOk]}>
                    {rule.label}
                  </Text>
                </View>
              ))}
            </View>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field }) => (
                <Input
                  label="Confirmar contraseña"
                  placeholder="Vuelve a escribir tu contraseña"
                  secureTextEntry
                  maxLength={100}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={
                    errors.confirmPassword?.message ??
                    (confirmPasswordValue.length > 0 && !passwordsMatch
                      ? 'Las contraseñas no coinciden'
                      : undefined)
                  }
                />
              )}
            />
            {passwordsMatch ? (
              <View style={styles.matchRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.matchText}>Las contraseñas coinciden</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {serverError ? (
          <Text accessibilityRole="alert" style={styles.serverError}>
            {serverError}
          </Text>
        ) : null}

        <View style={styles.navRow}>
          {step > 0 ? (
            <View style={styles.navBtnWrap}>
              <Button title="Anterior" variant="outline" onPress={handlePrevStep} />
            </View>
          ) : null}
          <View style={styles.navBtnWrap}>
            {step < STEPS.length - 1 ? (
              <Button title="Siguiente" onPress={() => void handleNextStep()} />
            ) : (
              <Button
                title="Crear cuenta bancaria"
                loading={isSubmitting}
                onPress={() => void handleSubmit(onSubmit)()}
              />
            )}
          </View>
        </View>
      </Card>

      <Button
        title="¿Ya tienes cuenta? Inicia sesión"
        variant="ghost"
        onPress={() => router.replace('/(auth)/login')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  stepCounter: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  card: { gap: spacing.md, marginBottom: spacing.md },
  section: { ...typography.heading, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs },
  serverError: { ...typography.caption, color: colors.danger },
  checklistBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  checklistTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 2,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  checklistText: { ...typography.caption, color: colors.textMuted },
  checklistTextOk: { color: colors.success, fontWeight: '600' },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: -spacing.xs,
  },
  matchText: { ...typography.caption, color: colors.success, fontWeight: '600' },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  navBtnWrap: { flex: 1 },
});
