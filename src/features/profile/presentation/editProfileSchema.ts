import { z } from 'zod';

import { EMAIL_REGEX } from '@/features/auth/presentation/loginSchema';
import {
  INCOME_REGEX,
  NAME_REGEX,
  OPTIONAL_NAME_REGEX,
} from '@/features/auth/presentation/registerSchema';

export const editProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'El primer nombre debe tener entre 2 y 62 caracteres')
      .max(62, 'El primer nombre debe tener entre 2 y 62 caracteres')
      .regex(NAME_REGEX, 'El primer nombre contiene caracteres no válidos'),
    secondName: z
      .string()
      .trim()
      .max(62, 'El segundo nombre no puede superar 62 caracteres')
      .regex(OPTIONAL_NAME_REGEX, 'El segundo nombre debe tener entre 2 y 62 letras (o dejarse vacío)'),
    lastName: z
      .string()
      .trim()
      .min(2, 'El apellido paterno debe tener entre 2 y 62 caracteres')
      .max(62, 'El apellido paterno debe tener entre 2 y 62 caracteres')
      .regex(NAME_REGEX, 'El apellido paterno contiene caracteres no válidos'),
    secondLastName: z
      .string()
      .trim()
      .max(62, 'El apellido materno no puede superar 62 caracteres')
      .regex(
        OPTIONAL_NAME_REGEX,
        'El apellido materno debe tener entre 2 y 62 letras (o dejarse vacío)',
      ),
    email: z
      .string()
      .trim()
      .min(1, 'El correo electrónico es obligatorio')
      .max(100, 'El correo no puede superar 100 caracteres')
      .regex(EMAIL_REGEX, 'El formato del correo electrónico es inválido'),
    mobilePhone: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, 'El teléfono móvil debe tener exactamente 10 dígitos')
      .refine((v) => !/^0+$/.test(v), 'El teléfono no puede consistir únicamente de ceros'),
    alternativePhone: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || (/^[0-9]{10}$/.test(v) && !/^0+$/.test(v)),
        'El teléfono alternativo debe tener 10 dígitos válidos',
      ),
    stateCode: z.string().trim(),
    idMunicipality: z.number().int().min(0),
    street: z
      .string()
      .trim()
      .min(3, 'La calle debe tener entre 3 y 100 caracteres')
      .max(100, 'La calle no puede superar 100 caracteres'),
    exteriorNumber: z
      .string()
      .trim()
      .min(1, 'El número exterior es obligatorio')
      .max(10, 'El número exterior no puede superar 10 caracteres'),
    interiorNumber: z.string().trim().max(10, 'El número interior no puede superar 10 caracteres'),
    neighborhood: z
      .string()
      .trim()
      .min(2, 'La colonia debe tener entre 2 y 80 caracteres')
      .max(80, 'La colonia no puede superar 80 caracteres'),
    postalCode: z
      .string()
      .trim()
      .regex(/^[0-9]{5}$/, 'El código postal debe contener exactamente 5 dígitos'),
    idProfession: z.number().int().min(0),
    occupation: z.string().trim().max(80),
    idOperationAmount: z.number().int().min(0),
    company: z
      .string()
      .trim()
      .min(3, 'La empresa debe tener entre 3 y 100 caracteres')
      .max(100, 'La empresa no puede superar 100 caracteres'),
    monthlyIncome: z
      .string()
      .trim()
      .min(1, 'El ingreso mensual es obligatorio')
      .refine(
        (v) => INCOME_REGEX.test(v) && Number(v) >= 0.01,
        'El ingreso mensual debe ser mayor a cero (máximo 2 decimales)',
      ),
    idGender: z.number().int().min(0),
    idNationality: z.number().int().min(0),
    idMaritalStatus: z.number().int().min(0),
  })
  .superRefine((vals, ctx) => {
    if (vals.stateCode && vals.idMunicipality <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['idMunicipality'],
        message: 'Selecciona tu municipio o alcaldía',
      });
    }
    if (vals.idProfession <= 0 && vals.occupation.length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['idProfession'],
        message: 'Selecciona tu profesión u ocupación',
      });
    }
  });

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
