import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { type RegisterFormValues, registerSchema } from './registerSchema';

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
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
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
              placeholder="Ej. Alejandro"
              maxLength={50}
              value={field.value}
              onBlur={field.onBlur}
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
              placeholder="Ej. Hernández"
              maxLength={50}
              value={field.value}
              onBlur={field.onBlur}
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
              label="Fecha de nacimiento (AAAA-MM-DD)"
              placeholder="1995-05-15"
              maxLength={10}
              value={field.value}
              onBlur={field.onBlur}
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
              label="CURP (18 caracteres)"
              placeholder="HERA950515HDFRND01"
              autoCapitalize="characters"
              maxLength={18}
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={(txt) => field.onChange(txt.toUpperCase())}
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
              onChangeText={(txt) => field.onChange(txt.toUpperCase())}
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
            {errors.idGender?.message ? (
              <Text style={styles.errorText}>{errors.idGender.message}</Text>
            ) : null}
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
            {errors.idNationality?.message ? (
              <Text style={styles.errorText}>{errors.idNationality.message}</Text>
            ) : null}
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
            {errors.idMaritalStatus?.message ? (
              <Text style={styles.errorText}>{errors.idMaritalStatus.message}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.section}>2. Contacto y domicilio</Text>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              label="Correo electrónico"
              placeholder="nombre@correo.com"
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
              placeholder="5512345678"
              keyboardType="number-pad"
              maxLength={10}
              value={field.value}
              onBlur={field.onBlur}
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
              placeholder="Av. Paseo de la Reforma"
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
              placeholder="222"
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
              placeholder="06600"
              keyboardType="number-pad"
              maxLength={5}
              value={field.value}
              onBlur={field.onBlur}
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
                      setValue('idMunicipality', 0, { shouldValidate: true });
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.claveEntidad?.message ? (
              <Text style={styles.errorText}>{errors.claveEntidad.message}</Text>
            ) : null}
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
              placeholder="Ingeniero de Software"
              maxLength={80}
              value={field.value}
              onBlur={field.onBlur}
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
              placeholder="Tecnología Financiera SA"
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
              placeholder="25000.00"
              keyboardType="decimal-pad"
              maxLength={13}
              value={field.value}
              onBlur={field.onBlur}
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
              placeholder="Mín. 12 caracteres con mayúscula, número y especial"
              secureTextEntry
              maxLength={100}
              value={field.value}
              onBlur={field.onBlur}
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
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  card: { gap: spacing.md },
  section: {
    ...typography.subheading,
    color: colors.primary,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  chipsWrap: { gap: spacing.xs },
  chipLabel: { ...typography.caption, color: colors.text, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '700' },
  errorText: { ...typography.caption, color: colors.danger },
});
