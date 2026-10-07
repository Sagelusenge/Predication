import { z } from 'zod';

const password = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(200)
  .regex(/[A-Z]/, 'Une majuscule est requise.')
  .regex(/[a-z]/, 'Une minuscule est requise.')
  .regex(/[0-9]/, 'Un chiffre est requis.');

export const loginSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(500),
  password,
});

export const acceptInvitationSchema = resetPasswordSchema;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: password,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(500).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
