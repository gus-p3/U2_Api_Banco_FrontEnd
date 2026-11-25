import { z } from 'zod';

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]+$/;

/** Reglas idénticas al backend (AuthRequest), evaluadas en tiempo real. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio')
    .max(100, 'Máximo 100 caracteres')
    .regex(EMAIL_REGEX, 'Ingresa un correo electrónico con formato válido'),
  password: z
    .string()
    .min(12, 'La contraseña debe tener al menos 12 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .regex(
      PASSWORD_REGEX,
      'Debe incluir mayúscula, minúscula, número y carácter especial (@$!%*?&.#_-), sin espacios',
    ),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
