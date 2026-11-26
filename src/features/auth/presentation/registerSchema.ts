import { z } from 'zod';

import { validateAdultBirthDate } from '@/core/validation/validators';

import { EMAIL_REGEX, PASSWORD_REGEX } from './loginSchema';

/**
 * Espejo 1 a 1 de ClientOnboardingRequest (backend): mismas reglas, longitudes, patrones y mensajes.
 * La mayoría de edad la valida el backend en ClientServiceImpl (INVALID_AGE); aquí se replica.
 */
export const NAME_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{2,50}$/;
export const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9][0-9]$/;
export const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
export const INCOME_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

const requiredText = (required: string, max: number, maxMsg: string) =>
  z.string().trim().min(1, required).max(max, maxMsg);

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .min(2, 'El nombre debe tener entre 2 y 50 caracteres')
    .max(50, 'El nombre debe tener entre 2 y 50 caracteres')
    .regex(NAME_REGEX, 'El nombre contiene caracteres no válidos'),
  lastName: z
    .string()
    .trim()
    .min(1, 'El apellido paterno es obligatorio')
    .min(2, 'El apellido paterno debe tener entre 2 y 50 caracteres')
    .max(50, 'El apellido paterno debe tener entre 2 y 50 caracteres')
    .regex(NAME_REGEX, 'El apellido paterno contiene caracteres no válidos'),
  birthDate: z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      const err = validateAdultBirthDate(val);
      if (err) ctx.addIssue({ code: 'custom', message: err });
    }),
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'La CURP es obligatoria')
    .length(18, 'La CURP debe tener exactamente 18 caracteres')
    .regex(CURP_REGEX, 'El formato de la CURP es inválido'),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'El RFC es obligatorio')
    .min(12, 'El RFC debe tener 12 o 13 caracteres')
    .max(13, 'El RFC debe tener 12 o 13 caracteres')
    .regex(RFC_REGEX, 'El formato del RFC es inválido'),
  idGender: z.number().int().positive('El identificador del género debe ser positivo'),
  idNationality: z.number().int().positive('El identificador de la nacionalidad debe ser positivo'),
  idMaritalStatus: z.number().int().positive('El identificador del estado civil debe ser positivo'),
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio')
    .max(100, 'El email no puede superar los 100 caracteres')
    .regex(EMAIL_REGEX, 'El formato del correo electrónico es inválido'),
  mobilePhone: z
    .string()
    .trim()
    .min(1, 'El teléfono móvil es obligatorio')
    .regex(/^[0-9]{10}$/, 'El teléfono móvil debe contener exactamente 10 dígitos numéricos'),
  street: requiredText('La calle es obligatoria', 100, 'La calle no puede superar los 100 caracteres'),
  exteriorNumber: requiredText(
    'El número exterior es obligatorio',
    10,
    'El número exterior no puede superar los 10 caracteres',
  ),
  neighborhood: requiredText(
    'La colonia es obligatoria',
    80,
    'La colonia no puede superar los 80 caracteres',
  ),
  claveEntidad: z
    .string()
    .trim()
    .regex(/^[0-9]{2}$/, "La clave de entidad debe tener 2 dígitos numéricos (ej. '09')"),
  idMunicipality: z.number().int().positive('El identificador del municipio debe ser positivo'),
  postalCode: z
    .string()
    .trim()
    .min(1, 'El código postal es obligatorio')
    .regex(/^[0-9]{5}$/, 'El código postal debe contener exactamente 5 dígitos numéricos'),
  occupation: requiredText(
    'La ocupación es obligatoria',
    80,
    'La ocupación no puede superar los 80 caracteres',
  ),
  company: requiredText(
    'La empresa es obligatoria',
    100,
    'La empresa no puede superar los 100 caracteres',
  ),
  monthlyIncome: z
    .string()
    .trim()
    .min(1, 'El ingreso mensual es obligatorio')
    .regex(INCOME_REGEX, 'El ingreso mensual admite máximo 10 enteros y 2 decimales')
    .refine((v) => Number(v) >= 0.01, 'El ingreso mensual debe ser mayor a cero'),
  password: z
    .string()
    .min(1, 'La contraseña de acceso es obligatoria')
    .min(12, 'La contraseña debe tener entre 12 y 100 caracteres')
    .max(100, 'La contraseña debe tener entre 12 y 100 caracteres')
    .regex(
      PASSWORD_REGEX,
      'La contraseña debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial',
    ),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
