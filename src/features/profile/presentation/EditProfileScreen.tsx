import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { http } from '@/core/http/client';
import { sanitizeDecimalAmount } from '@/core/validation/validators';
import { accountKeys, useCustomer } from '@/features/accounts/presentation/hooks';
import { useSessionStore } from '@/features/auth/presentation/sessionStore';
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
import { Button, Card, ErrorState, Input, Loader, Screen, SelectField } from '@/shared/ui';
import { AppHeader } from '@/shared/ui/AppHeader';

import { type EditProfileFormValues, editProfileSchema } from './editProfileSchema';

const sanitizeLettersOnly = (txt: string) => txt.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, '');
const normalizeText = (txt?: string) => (txt ?? '').trim().toLowerCase();

export function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSessionStore((s) => s.session);
  const { data: customer, isLoading, isError, error, refetch } = useCustomer();

  const [serverError, setServerError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

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
    reset,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      secondName: '',
      lastName: '',
      secondLastName: '',
      email: '',
      mobilePhone: '',
      alternativePhone: '',
      stateCode: '',
      idMunicipality: 0,
      street: '',
      exteriorNumber: '',
      interiorNumber: '',
      neighborhood: '',
      postalCode: '',
      idProfession: 0,
      occupation: '',
      idOperationAmount: 0,
      company: '',
      monthlyIncome: '',
      idGender: 0,
      idNationality: 0,
      idMaritalStatus: 0,
    },
  });

  const selectedStateCode = watch('stateCode');
  const municipalities = useMunicipalities(selectedStateCode || undefined);

  useEffect(() => {
    if (!customer || hydratedRef.current) return;
    hydratedRef.current = true;
    reset(
      {
        name: customer.firstName ?? '',
        secondName: customer.secondName ?? '',
        lastName: customer.lastName ?? '',
        secondLastName: customer.secondLastName ?? '',
        email: customer.email ?? session?.email ?? '',
        mobilePhone: customer.mobilePhone ?? '',
        alternativePhone: customer.alternativePhone ?? '',
        stateCode: customer.stateCode ?? '',
        idMunicipality: customer.municipalityId ?? 0,
        street: customer.street ?? '',
        exteriorNumber: customer.exteriorNumber ?? '',
        interiorNumber: customer.interiorNumber ?? '',
        neighborhood: customer.neighborhood ?? '',
        postalCode: customer.postalCode ?? '',
        idProfession: customer.professionId ?? 0,
        occupation: customer.professionName ?? customer.occupation ?? '',
        idOperationAmount: customer.operationAmountId ?? 0,
        company: customer.company ?? '',
        monthlyIncome: customer.monthlyIncome != null ? String(customer.monthlyIncome) : '',
        idGender: customer.genderId ?? 0,
        idNationality: customer.nationalityId ?? 0,
        idMaritalStatus: customer.maritalStatusId ?? 0,
      },
      { keepErrors: false },
    );
  }, [customer, session?.email, reset]);

  useEffect(() => {
    if (!customer) return;
    if (!watch('stateCode') && customer.stateName && states.data?.length) {
      const matched = states.data.find(
        (s) => normalizeText(s.name) === normalizeText(customer.stateName),
      );
      if (matched) setValue('stateCode', matched.code, { shouldValidate: true });
    }
  }, [customer, states.data, setValue, watch]);

  useEffect(() => {
    if (!customer) return;
    if (!watch('idMunicipality') && customer.municipalityName && municipalities.data?.length) {
      const matched = municipalities.data.find(
        (m) => normalizeText(m.name) === normalizeText(customer.municipalityName),
      );
      if (matched) setValue('idMunicipality', matched.id, { shouldValidate: true });
    }
  }, [customer, municipalities.data, setValue, watch]);

  useEffect(() => {
    if (!customer) return;
    if (!watch('idGender') && customer.genderName && genders.data?.length) {
      const matched = genders.data.find(
        (g) => normalizeText(g.name) === normalizeText(customer.genderName),
      );
      if (matched) setValue('idGender', matched.id, { shouldValidate: true });
    }
  }, [customer, genders.data, setValue, watch]);

  useEffect(() => {
    if (!customer) return;
    if (!watch('idNationality') && customer.nationalityName && nationalities.data?.length) {
      const matched = nationalities.data.find(
        (n) => normalizeText(n.name) === normalizeText(customer.nationalityName),
      );
      if (matched) setValue('idNationality', matched.id, { shouldValidate: true });
    }
  }, [customer, nationalities.data, setValue, watch]);

  useEffect(() => {
    if (!customer) return;
    if (!watch('idMaritalStatus') && customer.maritalStatusName && marital.data?.length) {
      const matched = marital.data.find(
        (m) => normalizeText(m.name) === normalizeText(customer.maritalStatusName),
      );
      if (matched) setValue('idMaritalStatus', matched.id, { shouldValidate: true });
    }
  }, [customer, marital.data, setValue, watch]);

  useEffect(() => {
    if (!customer) return;
    if (!watch('idProfession') && customer.occupation && professions.data?.length) {
      const matched = professions.data.find(
        (p) => normalizeText(p.name) === normalizeText(customer.occupation),
      );
      if (matched) setValue('idProfession', matched.id, { shouldValidate: true });
    }
  }, [customer, professions.data, setValue, watch]);

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
  const professionOptions = useMemo(
    () => (professions.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [professions.data],
  );
  const operationAmountOptions = useMemo(
    () => (operationAmounts.data ?? []).map((r) => ({ value: r.id, label: r.label })),
    [operationAmounts.data],
  );

  const onSubmit = async (vals: EditProfileFormValues) => {
    const identificador = customer?.curp ?? customer?.rfc;
    if (!identificador) {
      setServerError('No se encontró tu CURP o RFC para actualizar el perfil.');
      return;
    }

    const body: Record<string, string | number> = { identificador };

    const cleanName = vals.name.trim();
    if (cleanName !== (customer?.firstName ?? '')) body.name = cleanName;

    const cleanSecondName = vals.secondName.trim();
    if (cleanSecondName !== (customer?.secondName ?? '')) body.secondName = cleanSecondName;

    const cleanLastName = vals.lastName.trim();
    if (cleanLastName !== (customer?.lastName ?? '')) body.lastName = cleanLastName;

    const cleanSecondLastName = vals.secondLastName.trim();
    if (cleanSecondLastName !== (customer?.secondLastName ?? '')) {
      body.secondLastName = cleanSecondLastName;
    }

    const cleanEmail = vals.email.trim();
    if (cleanEmail !== (customer?.email ?? session?.email ?? '')) body.email = cleanEmail;

    const cleanPhone = vals.mobilePhone.trim();
    if (cleanPhone !== (customer?.mobilePhone ?? '')) body.mobilePhone = cleanPhone;

    const cleanAlt = vals.alternativePhone.trim();
    if (cleanAlt && cleanAlt !== (customer?.alternativePhone ?? '')) body.alternativePhone = cleanAlt;

    const cleanStreet = vals.street.trim();
    if (cleanStreet !== (customer?.street ?? '')) body.street = cleanStreet;

    const cleanExterior = vals.exteriorNumber.trim();
    if (cleanExterior !== (customer?.exteriorNumber ?? '')) body.exteriorNumber = cleanExterior;

    const cleanInterior = vals.interiorNumber.trim();
    if (cleanInterior !== (customer?.interiorNumber ?? '')) body.interiorNumber = cleanInterior;

    const cleanNeighborhood = vals.neighborhood.trim();
    if (cleanNeighborhood !== (customer?.neighborhood ?? '')) body.neighborhood = cleanNeighborhood;

    const cleanPostal = vals.postalCode.trim();
    if (cleanPostal !== (customer?.postalCode ?? '')) body.postalCode = cleanPostal;

    if (vals.idMunicipality > 0 && vals.idMunicipality !== (customer?.municipalityId ?? 0)) {
      body.idMunicipality = vals.idMunicipality;
    }

    if (vals.idProfession > 0 && vals.idProfession !== (customer?.professionId ?? 0)) {
      body.idProfession = vals.idProfession;
      const matchedProf = professions.data?.find((p) => p.id === vals.idProfession);
      if (matchedProf) body.occupation = matchedProf.name;
    } else {
      const cleanOccupation = vals.occupation.trim();
      if (cleanOccupation && cleanOccupation !== (customer?.occupation ?? '')) {
        body.occupation = cleanOccupation;
      }
    }

    if (vals.idOperationAmount > 0 && vals.idOperationAmount !== (customer?.operationAmountId ?? 0)) {
      body.idOperationAmount = vals.idOperationAmount;
    }

    const cleanCompany = vals.company.trim();
    if (cleanCompany !== (customer?.company ?? '')) body.company = cleanCompany;

    const cleanIncome = vals.monthlyIncome.trim();
    if (cleanIncome !== (customer?.monthlyIncome != null ? String(customer.monthlyIncome) : '')) {
      body.monthlyIncome = Number(cleanIncome);
    }

    if (vals.idGender > 0 && vals.idGender !== (customer?.genderId ?? 0)) {
      body.idGender = vals.idGender;
    }
    if (vals.idNationality > 0 && vals.idNationality !== (customer?.nationalityId ?? 0)) {
      body.idNationality = vals.idNationality;
    }
    if (vals.idMaritalStatus > 0 && vals.idMaritalStatus !== (customer?.maritalStatusId ?? 0)) {
      body.idMaritalStatus = vals.idMaritalStatus;
    }

    if (Object.keys(body).length === 1) {
      router.back();
      return;
    }

    setServerError(null);
    try {
      await http.patch('/v1/clientes', body);
      await queryClient.invalidateQueries({ queryKey: accountKeys.customer });
      router.back();
    } catch (e) {
      setServerError(toAppError(e).message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.root}>
        <AppHeader sectionTitle="Editar perfil" />
        <Screen>
          <Loader message="Cargando tus datos..." />
        </Screen>
      </View>
    );
  }

  if (isError || !customer) {
    return (
      <View style={styles.root}>
        <AppHeader sectionTitle="Editar perfil" />
        <Screen>
          <ErrorState message={toAppError(error).message} onRetry={() => void refetch()} />
        </Screen>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader sectionTitle="Editar perfil" />
      <Screen>
        <Pressable accessibilityRole="button" style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Volver a Perfil</Text>
        </Pressable>

        <View style={styles.headingBox}>
          <Text style={styles.title}>Editar mi perfil</Text>
          <Text style={styles.subtitle}>
            Revisa y actualiza tu información. Los cambios se validan al momento antes de guardar.
          </Text>
        </View>

        <Card style={styles.sectionCard}>
          <SectionHeader
            icon="person-outline"
            title="Nombre completo"
            subtitle="Primer/segundo nombre y apellidos"
          />
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                label="Primer nombre"
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
                autoCapitalize="words"
                maxLength={62}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={(txt) => field.onChange(sanitizeLettersOnly(txt))}
                error={errors.secondLastName?.message}
              />
            )}
          />
        </Card>

        <Card style={styles.sectionCard}>
          <SectionHeader
            icon="mail-outline"
            title="Contacto"
            subtitle="Correo y teléfonos de contacto"
          />
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                label="Correo electrónico"
                keyboardType="email-address"
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
                label="Teléfono móvil (10 dígitos)"
                keyboardType="number-pad"
                maxLength={10}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={(txt) => field.onChange(txt.replace(/[^0-9]/g, ''))}
                error={errors.mobilePhone?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="alternativePhone"
            render={({ field }) => (
              <Input
                label="Teléfono alternativo (opcional)"
                placeholder="10 dígitos"
                keyboardType="number-pad"
                maxLength={10}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={(txt) => field.onChange(txt.replace(/[^0-9]/g, ''))}
                error={errors.alternativePhone?.message}
              />
            )}
          />
        </Card>

        <Card style={styles.sectionCard}>
          <SectionHeader
            icon="location-outline"
            title="Domicilio"
            subtitle="Entidad, municipio y dirección actual"
          />
          <SelectField
            label="Entidad federativa"
            placeholder={customer.stateName || 'Selecciona un estado'}
            value={selectedStateCode || null}
            options={stateOptions}
            loading={states.isLoading}
            searchable
            error={errors.stateCode?.message}
            onSelect={(code) => {
              setValue('stateCode', code, { shouldValidate: true, shouldTouch: true });
              setValue('idMunicipality', 0, { shouldValidate: true, shouldTouch: true });
              void trigger('idMunicipality');
            }}
          />
          <SelectField
            label="Municipio o Alcaldía"
            placeholder={
              selectedStateCode
                ? (customer.municipalityName ?? 'Selecciona tu municipio')
                : 'Primero selecciona un estado'
            }
            value={watch('idMunicipality') || null}
            options={municipalityOptions}
            loading={Boolean(selectedStateCode) && municipalities.isLoading}
            disabled={!selectedStateCode}
            searchable
            error={errors.idMunicipality?.message}
            onSelect={(id) => {
              setValue('idMunicipality', id, { shouldValidate: true, shouldTouch: true });
            }}
          />
          <Controller
            control={control}
            name="street"
            render={({ field }) => (
              <Input
                label="Calle"
                maxLength={100}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={errors.street?.message}
              />
            )}
          />
          <View style={styles.rowPair}>
            <View style={styles.halfCol}>
              <Controller
                control={control}
                name="exteriorNumber"
                render={({ field }) => (
                  <Input
                    label="Número exterior"
                    maxLength={10}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    error={errors.exteriorNumber?.message}
                  />
                )}
              />
            </View>
            <View style={styles.halfCol}>
              <Controller
                control={control}
                name="interiorNumber"
                render={({ field }) => (
                  <Input
                    label="Interior (opcional)"
                    maxLength={10}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    error={errors.interiorNumber?.message}
                  />
                )}
              />
            </View>
          </View>
          <Controller
            control={control}
            name="neighborhood"
            render={({ field }) => (
              <Input
                label="Colonia"
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
                maxLength={5}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={(txt) => field.onChange(txt.replace(/[^0-9]/g, ''))}
                error={errors.postalCode?.message}
              />
            )}
          />
        </Card>

        <Card style={styles.sectionCard}>
          <SectionHeader
            icon="briefcase-outline"
            title="Información laboral y monto de operación"
            subtitle="Profesión, ingresos y límite máximo por operación"
          />
          <SelectField
            label="Profesión / Ocupación"
            placeholder={customer.professionName ?? customer.occupation ?? 'Selecciona tu profesión'}
            value={watch('idProfession') || null}
            options={professionOptions}
            loading={professions.isLoading}
            searchable
            error={errors.idProfession?.message}
            onSelect={(id) => {
              setValue('idProfession', id, { shouldValidate: true, shouldTouch: true });
              const found = professions.data?.find((p) => p.id === id);
              if (found) setValue('occupation', found.name, { shouldValidate: true });
            }}
          />
          <SelectField
            label="Monto de operación (rangos de $5,000 MXN)"
            placeholder={customer.operationAmountLabel ?? 'Selecciona tu límite de operación'}
            value={watch('idOperationAmount') || null}
            options={operationAmountOptions}
            loading={operationAmounts.isLoading}
            error={errors.idOperationAmount?.message}
            onSelect={(id) => {
              setValue('idOperationAmount', id, { shouldValidate: true, shouldTouch: true });
            }}
          />
          <Controller
            control={control}
            name="company"
            render={({ field }) => (
              <Input
                label="Empresa"
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
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={(txt) => field.onChange(sanitizeDecimalAmount(txt))}
                error={errors.monthlyIncome?.message}
              />
            )}
          />
        </Card>

        <Card style={styles.sectionCard}>
          <SectionHeader
            icon="id-card-outline"
            title="Catálogos de identidad"
            subtitle="Género, nacionalidad y estado civil"
          />
          <SelectField
            label="Género"
            placeholder={customer.genderName || 'Selecciona género'}
            value={watch('idGender') || null}
            options={genderOptions}
            loading={genders.isLoading}
            onSelect={(val) => setValue('idGender', val, { shouldValidate: true, shouldTouch: true })}
          />
          <SelectField
            label="Nacionalidad"
            placeholder={customer.nationalityName || 'Selecciona nacionalidad'}
            value={watch('idNationality') || null}
            options={nationalityOptions}
            loading={nationalities.isLoading}
            searchable
            onSelect={(val) =>
              setValue('idNationality', val, { shouldValidate: true, shouldTouch: true })
            }
          />
          <SelectField
            label="Estado civil"
            placeholder={customer.maritalStatusName || 'Selecciona estado civil'}
            value={watch('idMaritalStatus') || null}
            options={maritalOptions}
            loading={marital.isLoading}
            onSelect={(val) =>
              setValue('idMaritalStatus', val, { shouldValidate: true, shouldTouch: true })
            }
          />
        </Card>

        {serverError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{serverError}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="Guardar cambios"
            loading={isSubmitting}
            onPress={() => void handleSubmit(onSubmit)()}
          />
          <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.sectionTexts}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  backText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  headingBox: { gap: 4 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
  sectionCard: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTexts: { flex: 1, gap: 2 },
  sectionTitle: { ...typography.subheading, color: colors.text, fontWeight: '700' },
  sectionSubtitle: { ...typography.caption, color: colors.textMuted },
  rowPair: { flexDirection: 'row', gap: spacing.sm },
  halfCol: { flex: 1 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { ...typography.caption, color: colors.danger, fontWeight: '600' },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
