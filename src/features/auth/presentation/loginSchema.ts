import { z } from 'zod';

/** Reglas idénticas al backend (AuthRequest). */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo es obligatorio')
    .max(100, 'Máximo 100 caracteres')
    .regex(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/, 'Ingresa un correo válido'),
  password: z
    .string()
    .min(12, 'Mínimo 12 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]+$/,
      'Debe incluir mayúscula, minúscula, número y un carácter especial',
    ),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
