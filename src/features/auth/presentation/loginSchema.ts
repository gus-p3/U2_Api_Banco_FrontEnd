import { z } from 'zod';

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]+$/;

/** Espejo 1 a 1 de AuthRequest (backend): mismas reglas y mensajes, evaluadas en tiempo real. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio')
    .max(100, 'El email no puede superar los 100 caracteres')
    .regex(EMAIL_REGEX, 'El formato del correo electrónico es inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria')
    .min(12, 'La contraseña debe tener entre 12 y 100 caracteres')
    .max(100, 'La contraseña debe tener entre 12 y 100 caracteres')
    .regex(
      PASSWORD_REGEX,
      'La contraseña debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial',
    ),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
