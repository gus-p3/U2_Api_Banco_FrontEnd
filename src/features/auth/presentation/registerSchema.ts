import { z } from 'zod';

import { validateAdultBirthDate } from '@/core/validation/validators';

import { EMAIL_REGEX, PASSWORD_REGEX } from './loginSchema';

const PERSON_NAME_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9][0-9]$/;
const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
const SAFE_ADDRESS_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,#\-/()ºª]+$/;
const EXTERIOR_NUM_REGEX = /^[A-Za-z0-9 #\-/]{1,10}$/;
const WORK_TEXT_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,&\-/()]+$/;

/** Esquema completo de onboarding bancario alineado 1 a 1 con ClientOnboardingRequest del backend. */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(PERSON_NAME_REGEX, 'Solo letras y espacios simples (sin números ni símbolos)'),
  lastName: z
    .string()
    .trim()
    .min(2, 'El apellido paterno debe tener al menos 2 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(PERSON_NAME_REGEX, 'Solo letras y espacios simples (sin números ni símbolos)'),
  birthDate: z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      const err = validateAdultBirthDate(val);
      if (err) {
        ctx.addIssue({ code: 'custom', message: err });
      }
    }),
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .length(18, 'La CURP debe tener exactamente 18 caracteres')
    .regex(CURP_REGEX, 'Formato oficial de CURP inválido'),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .min(12, 'El RFC debe tener 12 o 13 caracteres')
    .max(13, 'El RFC debe tener 12 o 13 caracteres')
    .regex(RFC_REGEX, 'Formato oficial de RFC inválido (12 o 13 caracteres)'),
  idGender: z.number().int().positive('Selecciona un género'),
  idNationality: z.number().int().positive('Selecciona tu nacionalidad'),
  idMaritalStatus: z.number().int().positive('Selecciona tu estado civil'),
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio')
    .max(100, 'Máximo 100 caracteres')
    .regex(EMAIL_REGEX, 'Ingresa un correo electrónico válido'),
  mobilePhone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'Ingresa exactamente 10 dígitos numéricos')
    .refine((v) => !/^0+$/.test(v), 'El teléfono no puede consistir únicamente de ceros'),
  street: z
    .string()
    .trim()
    .min(3, 'La calle debe tener al menos 3 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .regex(SAFE_ADDRESS_REGEX, 'La calle contiene caracteres no permitidos'),
  exteriorNumber: z
    .string()
    .trim()
    .min(1, 'El número exterior es obligatorio')
    .max(10, 'Máximo 10 caracteres')
    .regex(EXTERIOR_NUM_REGEX, 'Usa solo letras, números, # o guiones (ej. 124-B o S/N)'),
  neighborhood: z
    .string()
    .trim()
    .min(2, 'La colonia debe tener al menos 2 caracteres')
    .max(80, 'Máximo 80 caracteres')
    .regex(SAFE_ADDRESS_REGEX, 'La colonia contiene caracteres no permitidos'),
  claveEntidad: z
    .string()
    .trim()
    .regex(/^[0-9]{2}$/, 'Selecciona un estado válido'),
  idMunicipality: z.number().int().positive('Selecciona un municipio o alcaldía'),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, 'El código postal debe tener exactamente 5 dígitos numéricos')
    .refine((v) => v !== '00000', 'Ingresa un código postal válido'),
  occupation: z
    .string()
    .trim()
    .min(3, 'La ocupación debe tener al menos 3 caracteres')
    .max(80, 'Máximo 80 caracteres')
    .regex(WORK_TEXT_REGEX, 'La ocupación contiene caracteres no permitidos'),
  company: z
    .string()
    .trim()
    .min(3, 'La empresa debe tener al menos 3 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .regex(WORK_TEXT_REGEX, 'El nombre de la empresa contiene caracteres no permitidos'),
  monthlyIncome: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ingresa un monto válido con máximo 2 decimales')
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0.01 && n <= 99_999_999.99;
    }, 'El ingreso mensual debe ser mayor a $0.00'),
  password: z
    .string()
    .min(12, 'Mínimo 12 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .regex(
      PASSWORD_REGEX,
      'Incluye mayúscula, minúscula, número y carácter especial (@$!%*?&.#_-), sin espacios',
    ),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
