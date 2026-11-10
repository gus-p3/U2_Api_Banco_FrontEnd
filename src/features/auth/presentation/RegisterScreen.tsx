import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

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
import { Button, Card, Input, Screen } from '@/shared/ui';

import { signInWithPassword } from './authActions';

const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().trim().min(2, 'Mínimo 2 caracteres'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{4}[0-9]{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9][0-9]$/,
      'CURP inválida (18 caracteres)',
    ),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/, 'RFC inválido (12 o 13 caracteres)'),
  idGender: z.number().positive('Selecciona un género'),
  idNationality: z.number().positive('Selecciona nacionalidad'),
  idMaritalStatus: z.number().positive('Selecciona estado civil'),
  email: z.string().trim().email('Correo inválido'),
  mobilePhone: z.string().regex(/^[0-9]{10}$/, '10 dígitos numéricos'),
  street: z.string().trim().min(2, 'Calle obligatoria'),
  exteriorNumber: z.string().trim().min(1, 'Número exterior obligatorio'),
  neighborhood: z.string().trim().min(2, 'Colonia obligatoria'),
  claveEntidad: z.string().regex(/^[0-9]{2}$/, 'Selecciona un estado'),
  idMunicipality: z.number().positive('Selecciona un municipio'),
  postalCode: z.string().regex(/^[0-9]{5}$/, '5 dígitos numéricos'),
  occupation: z.string().trim().min(2, 'Ocupación obligatoria'),
  company: z.string().trim().min(2, 'Empresa obligatoria'),
  monthlyIncome: z.string().refine((v) => Number(v) > 0, 'Mayor a 0'),
  password: z
    .string()
    .min(12, 'Mínimo 12 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]+$/,
      'Incluye mayúscula, minúscula, número y especial',
    ),
});

type FormValues = z.infer<typeof schema>;

export function RegisterScreen() {
  const router = useRouter();
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      lastName: '',
      birthDate: '1995-05-15',
      curp: '',
      rfc: '',
      idGender: 1,
      idNationality: 1,
      idMaritalStatus: 1,
      email: '',
      mobilePhone: '',
      street: '',
      exteriorNumber: '',
      neighborhood: '',
      claveEntidad: '09',
      idMunicipality: 0,
      postalCode: '',
      occupation: '',
      company: '',
      monthlyIncome: '25000',
      password: '',
    },
  });

  const selectedState = watch('claveEntidad');
  const municipalities = useMunicipalities(selectedState);

  const onSubmit = async (v: FormValues) => {
    setServerError(null);
    try {
      const body = {
        name: v.name,
        lastName: v.lastName,
        birthDate: v.birthDate,
        curp: v.curp.toUpperCase(),
        rfc: v.rfc.toUpperCase(),
        idGender: v.idGender,
        idNationality: v.idNationality,
        idMaritalStatus: v.idMaritalStatus,
        email: v.email,
        mobilePhone: v.mobilePhone,
        street: v.street,
        exteriorNumber: v.exteriorNumber,
        neighborhood: v.neighborhood,
        idMunicipality: v.idMunicipality,
        claveEntidad: v.claveEntidad,
        postalCode: v.postalCode,
        occupation: v.occupation,
        company: v.company,
        monthlyIncome: Number(v.monthlyIncome),
        initialBalance: 1000,
        password: v.password,
      };
      await http.post('/v1/clientes', body, { skipAuth: true });
      await signInWithPassword(v.email, v.password);
    } catch (e) {
      setServerError(toAppError(e).message);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Apertura de cuenta</Text>
      <Text style={styles.subtitle}>Completa tus datos para crear tu cuenta bancaria digital</Text>

      <Card style={styles.card}>
        <Text style={styles.section}>1. Datos personales</Text>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              label="Nombre(s)"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="lastName"
          render={({ field }) => (
            <Input
              label="Apellido paterno"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.lastName?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <Input
              label="Fecha de nacimiento (YYYY-MM-DD)"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.birthDate?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="curp"
          render={({ field }) => (
            <Input
              label="CURP"
              autoCapitalize="characters"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.curp?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="rfc"
          render={({ field }) => (
            <Input
              label="RFC"
              autoCapitalize="characters"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.rfc?.message}
            />
          )}
        />

        {genders.data?.length ? (
          <View style={styles.chipsWrap}>
            <Text style={styles.chipLabel}>Género</Text>
            <View style={styles.chips}>
              {genders.data.map((g) => {
                const active = watch('idGender') === g.id;
                return (
                  <Pressable
                    key={g.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setValue('idGender', g.id, { shouldValidate: true })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{g.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {nationalities.data?.length ? (
          <View style={styles.chipsWrap}>
            <Text style={styles.chipLabel}>Nacionalidad</Text>
            <View style={styles.chips}>
              {nationalities.data.slice(0, 4).map((n) => {
                const active = watch('idNationality') === n.id;
                return (
                  <Pressable
                    key={n.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setValue('idNationality', n.id, { shouldValidate: true })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{n.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {marital.data?.length ? (
          <View style={styles.chipsWrap}>
            <Text style={styles.chipLabel}>Estado civil</Text>
            <View style={styles.chips}>
              {marital.data.map((m) => {
                const active = watch('idMaritalStatus') === m.id;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setValue('idMaritalStatus', m.id, { shouldValidate: true })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Text style={styles.section}>2. Contacto y domicilio</Text>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              label="Correo electrónico"
              keyboardType="email-address"
              value={field.value}
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
              keyboardType="phone-pad"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.mobilePhone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="street"
          render={({ field }) => (
            <Input
              label="Calle"
              value={field.value}
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
              value={field.value}
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
              value={field.value}
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
              label="Código postal"
              keyboardType="number-pad"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.postalCode?.message}
            />
          )}
        />

        {states.data?.length ? (
          <View style={styles.chipsWrap}>
            <Text style={styles.chipLabel}>Estado</Text>
            <View style={styles.chips}>
              {states.data.slice(0, 8).map((s) => {
                const active = selectedState === s.code;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      setValue('claveEntidad', s.code, { shouldValidate: true });
                      setValue('idMunicipality', 0);
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {municipalities.data?.length ? (
          <View style={styles.chipsWrap}>
            <Text style={styles.chipLabel}>Municipio / Alcaldía</Text>
            <View style={styles.chips}>
              {municipalities.data.slice(0, 8).map((m) => {
                const active = watch('idMunicipality') === m.id;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setValue('idMunicipality', m.id, { shouldValidate: true })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.idMunicipality?.message ? (
              <Text style={styles.errorText}>{errors.idMunicipality.message}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.section}>3. Empleo y seguridad</Text>
        <Controller
          control={control}
          name="occupation"
          render={({ field }) => (
            <Input
              label="Ocupación"
              value={field.value}
              onChangeText={field.onChange}
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
              value={field.value}
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
              onChangeText={field.onChange}
              error={errors.monthlyIncome?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Input
              label="Contraseña de acceso"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={errors.password?.message}
            />
          )}
        />

        {serverError ? <Text style={styles.errorText}>{serverError}</Text> : null}

        <Button
          title="Abrir cuenta"
          loading={isSubmitting}
          onPress={() => void handleSubmit(onSubmit)()}
        />
        <Button title="Volver a iniciar sesión" variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.primary },
  subtitle: { ...typography.body, color: colors.textMuted },
  card: { gap: spacing.md },
  section: { ...typography.subheading, color: colors.primary, marginTop: spacing.sm },
  chipsWrap: { gap: spacing.xs },
  chipLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
  errorText: { ...typography.caption, color: colors.danger },
});
