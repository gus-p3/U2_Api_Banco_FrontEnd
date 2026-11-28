import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { http } from '@/core/http/client';
import { calculateCurp, calculateRfc } from '@/core/utils/curpRfc';
import { sanitizeDecimalAmount } from '@/core/validation/validators';
import {
  useGenders,
  useMaritalStatuses,
  useMunicipalities,
  useNationalities,
  useOperationAmounts,
  useProfessions,
  useStates,
} from '@/features/catalogs/presentation/hooks';
import { colors, radii, spacing, typography } from '@/shared/theme';
import {
  AppModal,
  BirthDatePickerField,
  Button,
  Card,
  Input,
  Loader,
  Screen,
  SelectField,
} from '@/shared/ui';

import type { AuthResponseDto } from '../data/dto';
import { toAuthChallenge } from '../data/mappers';
import type { AuthChallenge } from '../domain/entities';
import { send2faEmailCode, signInWithPasswordChallenge, verifyEmailOrLoginCode } from './authActions';
import { type RegisterFormValues, registerSchema } from './registerSchema';

const sanitizeLettersOnly = (txt: string) => txt.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, '');
const sanitizeCurp = (txt: string) => txt.toUpperCase().replace(/[^A-Z0-9]/g, '');
const sanitizeRfc = (txt: string) => txt.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '');

const STEPS: Array<{
  title: string;
  subtitle: string;
  fields: Array<keyof RegisterFormValues>;
}> = [
  {
    title: 'Datos personales',
    subtitle: 'Cuéntanos sobre ti. Debes ser mayor de 18 años.',
    fields: [
      'name',
      'secondName',
      'lastName',
      'secondLastName',
      'birthDate',
      'idGender',
      'birthStateCode',
      'idNationality',
      'idMaritalStatus',
    ],
  },
  {
    title: 'Identificación y contacto',
    subtitle: 'Calculamos tu CURP y RFC automáticamente; revísalos y completa tu contacto.',
    fields: ['curp', 'rfc', 'email', 'mobilePhone'],
  },
  {
    title: 'Domicilio',
    subtitle: 'Selecciona tu entidad, municipio y dirección actual.',
    fields: ['claveEntidad', 'idMunicipality', 'street', 'exteriorNumber', 'neighborhood', 'postalCode'],
  },
  {
    title: 'Empleo, monto de operación y seguridad',
    subtitle: 'Último paso para activar tu cuenta bancaria digital.',
    fields: [
      'idProfession',
      'company',
      'idOperationAmount',
      'monthlyIncome',
      'password',
      'confirmPassword',
    ],
  },
];

export function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [verificationChallenge, setVerificationChallenge] = useState<AuthChallenge | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [autoCalcBanner, setAutoCalcBanner] = useState<string | null>(null);
  const [submitModal, setSubmitModal] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    title: string;
    message: string;
    challenge?: AuthChallenge | null;
  }>({ status: 'idle', title: '', message: '', challenge: null });

  const curpManuallyEditedRef = useRef(false);
  const rfcManuallyEditedRef = useRef(false);

  const genders = useGenders();
  const nationalities = useNationalities();
  const marital = useMaritalStatuses();
  const states = useStates();
  const professions = useProfessions();
  const operationAmounts = useOperationAmounts();

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
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      secondName: '',
      lastName: '',
      secondLastName: '',
      birthDate: '',
      birthStateCode: '',
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
      idProfession: 0,
      occupation: '',
      idOperationAmount: 0,
      company: '',
      monthlyIncome: '',
      password: '',
      confirmPassword: '',
    },
  });

  const watchedName = watch('name');
  const watchedSecondName = watch('secondName');
  const watchedLastName = watch('lastName');
  const watchedSecondLastName = watch('secondLastName');
  const watchedBirthDate = watch('birthDate');
  const watchedGenderId = watch('idGender');
  const watchedBirthStateCode = watch('birthStateCode');
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
  const birthStateOptions = useMemo(
    () => [...stateOptions, { value: 'NE', label: 'Nacido en el extranjero (NE)' }],
    [stateOptions],
  );
  const municipalityOptions = useMemo(
    () => (municipalities.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    [municipalities.data],
  );
  const professionOptions = useMemo(
    () => (professions.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [professions.data],
  );
  const operationAmountOptions = useMemo(
    () => (operationAmounts.data ?? []).map((r) => ({ value: r.id, label: r.label })),
    [operationAmounts.data],
  );

  const selectedGenderName = useMemo(
    () => genders.data?.find((g) => g.id === watchedGenderId)?.name,
    [genders.data, watchedGenderId],
  );

  // Recalcula CURP y RFC automáticamente al cambiar los datos personales (salvo edición manual)
  useEffect(() => {
    const calcInput = {
      firstName: watchedName,
      secondName: watchedSecondName,
      lastName: watchedLastName,
      secondLastName: watchedSecondLastName,
      birthDate: watchedBirthDate,
      genderName: selectedGenderName,
      birthStateCode: watchedBirthStateCode,
    };

    let updated = false;
    if (!curpManuallyEditedRef.current) {
      const nextCurp = calculateCurp(calcInput);
      if (nextCurp) {
        setValue('curp', nextCurp, { shouldValidate: false });
        updated = true;
      }
    }
    if (!rfcManuallyEditedRef.current) {
      const nextRfc = calculateRfc(calcInput);
      if (nextRfc) {
        setValue('rfc', nextRfc, { shouldValidate: false });
        updated = true;
      }
    }
    if (updated) {
      setAutoCalcBanner(
        'Prellenamos los primeros 16 caracteres de tu CURP (solo faltan los últimos 2) y los primeros 10 de tu RFC (faltan los últimos 3). Puedes editar o borrar libremente.',
      );
    }
  }, [
    watchedName,
    watchedSecondName,
    watchedLastName,
    watchedSecondLastName,
    watchedBirthDate,
    selectedGenderName,
    watchedBirthStateCode,
    setValue,
  ]);

  const handleRecalculateIdentity = () => {
    curpManuallyEditedRef.current = false;
    rfcManuallyEditedRef.current = false;
    const calcInput = {
      firstName: watchedName,
      secondName: watchedSecondName,
      lastName: watchedLastName,
      secondLastName: watchedSecondLastName,
      birthDate: watchedBirthDate,
      genderName: selectedGenderName,
      birthStateCode: watchedBirthStateCode,
    };
    const nextCurp = calculateCurp(calcInput);
    const nextRfc = calculateRfc(calcInput);
    if (nextCurp) {
      setValue('curp', nextCurp, { shouldValidate: false });
      clearErrors('curp');
    }
    if (nextRfc) {
      setValue('rfc', nextRfc, { shouldValidate: false });
      clearErrors('rfc');
    }
    setAutoCalcBanner(
      nextCurp || nextRfc
        ? 'Base de CURP (16 chars) y RFC (10 chars) restablecida. Completa solo los caracteres finales.'
        : 'Completa tus datos del Paso 1 para prellenar tu CURP y RFC.',
    );
  };

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
    setSubmitModal({
      status: 'loading',
      title: 'Creando tu cuenta bancaria...',
      message:
        'Estamos validando tus datos, generando tu cuenta digital y enviando tu código de verificación al correo.',
      challenge: null,
    });
    try {
      const selectedProf = professions.data?.find((p) => p.id === v.idProfession);
      const body: Record<string, string | number> = {
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
        idProfession: v.idProfession,
        occupation: selectedProf?.name ?? v.occupation.trim(),
        idOperationAmount: v.idOperationAmount,
        company: v.company.trim(),
        monthlyIncome: Number(v.monthlyIncome),
        initialBalance: 1000,
        password: v.password,
      };
      if (v.secondName.trim()) {
        body.secondName = v.secondName.trim();
      }
      if (v.secondLastName.trim()) {
        body.secondLastName = v.secondLastName.trim();
      }

      const { data } = await http.post<{ auth?: AuthResponseDto }>('/v1/clientes', body, {
        skipAuth: true,
      });
      let challenge = data?.auth ? toAuthChallenge(data.auth) : null;
      if (!challenge) {
        const outcome = await signInWithPasswordChallenge(v.email.trim(), v.password);
        if (outcome.kind === 'challenge') {
          challenge = outcome.challenge;
        }
      }

      if (challenge) {
        setSubmitModal({
          status: 'success',
          title: '¡Tu cuenta fue creada con éxito!',
          message: `Generamos tu cuenta bancaria digital y enviamos un código de 6 dígitos a ${challenge.email} para verificarla.`,
          challenge,
        });
      } else {
        setSubmitModal({ status: 'idle', title: '', message: '', challenge: null });
      }
    } catch (e) {
      const msg = toAppError(e).message;
      setServerError(msg);
      setSubmitModal({
        status: 'error',
        title: 'No se pudo crear la cuenta',
        message: msg,
        challenge: null,
      });
    }
  };

  const handleVerifyAccountCode = async () => {
    if (!verificationChallenge) return;
    setCodeTouched(true);
    if (!/^[0-9]{6}$/.test(verificationCode.trim())) {
      setServerError('Introduce los 6 dígitos del código enviado a tu correo.');
      return;
    }
    setServerError(null);
    setVerifyingCode(true);
    try {
      await verifyEmailOrLoginCode(
        verificationChallenge.challengeId,
        verificationChallenge.pollToken,
        verificationCode,
      );
    } catch (e) {
      setServerError(toAppError(e).message);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleResendAccountCode = async () => {
    if (!verificationChallenge) return;
    setServerError(null);
    setResendingCode(true);
    try {
      await send2faEmailCode(verificationChallenge.challengeId, verificationChallenge.pollToken);
      setVerificationNotice(`Reenviamos un nuevo código de 6 dígitos a ${verificationChallenge.email}.`);
    } catch (e) {
      setServerError(toAppError(e).message);
    } finally {
      setResendingCode(false);
    }
  };

  if (verificationChallenge) {
    const codeError =
      codeTouched && verificationCode.length > 0 && verificationCode.length < 6
        ? 'El código debe tener exactamente 6 dígitos numéricos.'
        : undefined;
    return (
      <Screen>
        <Text style={styles.title}>Verifica tu cuenta</Text>
        <Text style={styles.stepCounter}>Cuenta creada · Verificación por correo</Text>

        <Card style={styles.card}>
          <Text style={styles.section}>Introduce tu código de verificación</Text>
          <Text style={styles.subtitle}>
            Para verificar tu cuenta creada ({verificationChallenge.email}), introduce el código de 6
            dígitos que se envió a tu correo electrónico.
          </Text>

          <Input
            label="Código de verificación (6 dígitos)"
            placeholder="000000"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={verificationCode}
            onBlur={() => setCodeTouched(true)}
            onChangeText={(txt) => {
              setVerificationCode(txt.replace(/[^0-9]/g, ''));
              setCodeTouched(true);
              setServerError(null);
            }}
            error={codeError}
          />

          {verificationNotice ? <Text style={styles.matchText}>{verificationNotice}</Text> : null}

          {serverError ? (
            <Text accessibilityRole="alert" style={styles.serverError}>
              {serverError}
            </Text>
          ) : null}

          <Button
            title="Verificar cuenta y entrar"
            loading={verifyingCode}
            onPress={() => void handleVerifyAccountCode()}
          />
          <Button
            title="Reenviar código"
            variant="outline"
            loading={resendingCode}
            onPress={() => void handleResendAccountCode()}
          />
        </Card>

        <Button
          title="Ir a iniciar sesión"
          variant="ghost"
          onPress={() => router.replace('/(auth)/login')}
        />
      </Screen>
    );
  }

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
                  label="Primer nombre"
                  placeholder="Ej. Alejandro"
                  autoCapitalize="words"
                  maxLength={62}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeLettersOnly(txt))}
                  error={errors.name?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="secondName"
              render={({ field }) => (
                <Input
                  label="Segundo nombre (opcional)"
                  placeholder="Ej. Guadalupe"
                  autoCapitalize="words"
                  maxLength={62}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeLettersOnly(txt))}
                  error={errors.secondName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="lastName"
              render={({ field }) => (
                <Input
                  label="Apellido paterno"
                  placeholder="Ej. Hernández"
                  autoCapitalize="words"
                  maxLength={62}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeLettersOnly(txt))}
                  error={errors.lastName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="secondLastName"
              render={({ field }) => (
                <Input
                  label="Apellido materno (opcional)"
                  placeholder="Ej. García"
                  autoCapitalize="words"
                  maxLength={62}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => field.onChange(sanitizeLettersOnly(txt))}
                  error={errors.secondLastName?.message}
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
              label="Entidad de nacimiento (para calcular CURP)"
              placeholder="Selecciona el estado donde naciste"
              value={watchedBirthStateCode || null}
              options={birthStateOptions}
              loading={states.isLoading}
              searchable
              onSelect={(code) => {
                setValue('birthStateCode', code, { shouldValidate: true, shouldTouch: true });
              }}
              error={errors.birthStateCode?.message}
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
            {autoCalcBanner ? (
              <View style={styles.autoCalcBox}>
                <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                <Text style={styles.autoCalcText}>{autoCalcBanner}</Text>
              </View>
            ) : null}

            <Controller
              control={control}
              name="curp"
              render={({ field }) => (
                <Input
                  label="CURP (18 caracteres)"
                  placeholder="HERA950515HDFRND01"
                  autoCapitalize="characters"
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                  maxLength={18}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => {
                    curpManuallyEditedRef.current = true;
                    field.onChange(sanitizeCurp(txt));
                  }}
                  error={errors.curp?.message}
                  hint="Prellenamos los primeros 16 caracteres; completa los últimos 2 de tu CURP."
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
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                  maxLength={13}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={(txt) => {
                    rfcManuallyEditedRef.current = true;
                    field.onChange(sanitizeRfc(txt));
                  }}
                  error={errors.rfc?.message}
                  hint="Prellenamos los primeros 10 caracteres; completa los 3 de tu homoclave."
                />
              )}
            />
            <Button
              title="Restablecer base de CURP y RFC"
              variant="outline"
              onPress={handleRecalculateIdentity}
            />
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Input
                  label="Correo electrónico"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
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
                  maxLength={10}
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
                  maxLength={80}
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
            <SelectField
              label="Profesión / Ocupación"
              placeholder="Selecciona tu profesión"
              value={watch('idProfession') || null}
              options={professionOptions}
              loading={professions.isLoading}
              searchable
              onSelect={(id) => {
                setValue('idProfession', id, { shouldValidate: true, shouldTouch: true });
                const found = professions.data?.find((p) => p.id === id);
                if (found) setValue('occupation', found.name, { shouldValidate: true });
              }}
              error={errors.idProfession?.message}
            />
            <Controller
              control={control}
              name="company"
              render={({ field }) => (
                <Input
                  label="Empresa o lugar de trabajo"
                  placeholder="Tecnología MX"
                  maxLength={100}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.company?.message}
                />
              )}
            />
            <SelectField
              label="Monto de operación (rango mensual y límite por pago)"
              placeholder="Selecciona un rango de $5,000 en $5,000"
              value={watch('idOperationAmount') || null}
              options={operationAmountOptions}
              loading={operationAmounts.isLoading}
              onSelect={(id) => {
                setValue('idOperationAmount', id, { shouldValidate: true, shouldTouch: true });
              }}
              error={errors.idOperationAmount?.message}
            />
            <Text style={styles.helperNote}>
              Define tu perfil transaccional (CNBV) y el tope máximo permitido por operación en pagos.
              Podrás cambiarlo después en tu Perfil.
            </Text>
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
                  onChangeText={(txt) => field.onChange(sanitizeDecimalAmount(txt))}
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
                  autoComplete="new-password"
                  textContentType="newPassword"
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
                  autoComplete="new-password"
                  textContentType="newPassword"
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

      <AppModal
        visible={submitModal.status !== 'idle'}
        title={submitModal.title}
        message={submitModal.message}
        onRequestClose={
          submitModal.status === 'error'
            ? () => setSubmitModal({ status: 'idle', title: '', message: '', challenge: null })
            : undefined
        }
        actions={
          submitModal.status === 'success' && submitModal.challenge ? (
            <Button
              title="Ingresar código de verificación"
              onPress={() => {
                const ch = submitModal.challenge!;
                setSubmitModal({ status: 'idle', title: '', message: '', challenge: null });
                setVerificationChallenge(ch);
                setVerificationCode('');
                setCodeTouched(false);
                setVerificationNotice(
                  `Enviamos un código de 6 dígitos a ${ch.email} para verificar tu cuenta creada.`,
                );
              }}
            />
          ) : submitModal.status === 'error' ? (
            <Button
              title="Entendido, revisar datos"
              onPress={() => setSubmitModal({ status: 'idle', title: '', message: '', challenge: null })}
            />
          ) : undefined
        }
      >
        {submitModal.status === 'loading' ? (
          <Loader message="Procesando solicitud..." />
        ) : submitModal.status === 'success' ? (
          <View style={styles.modalIconWrap}>
            <View style={[styles.modalIconCircle, { backgroundColor: colors.successBg }]}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            </View>
          </View>
        ) : submitModal.status === 'error' ? (
          <View style={styles.modalIconWrap}>
            <View style={[styles.modalIconCircle, { backgroundColor: colors.dangerBg }]}>
              <Ionicons name="alert-circle" size={44} color={colors.danger} />
            </View>
          </View>
        ) : null}
      </AppModal>
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
  helperNote: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs },
  autoCalcBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  autoCalcText: { ...typography.caption, color: colors.primary, flex: 1, lineHeight: 18 },
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
  modalIconWrap: { alignItems: 'center', marginVertical: spacing.xs },
  modalIconCircle: {
    width: 68,
    height: 68,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
