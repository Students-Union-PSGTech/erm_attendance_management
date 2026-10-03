import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export const credentialUpdateSchema = z
  .object({
    username: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9._-]+$/).optional(),
    password: z.string().min(6).max(128).optional(),
  })
  .refine((v) => v.username || v.password, { message: 'Provide username and/or password' });

// PATCH /auth/me/credentials: any logged-in user changes their own login
export const ownCredentialUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    username: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9._-]+$/, 'Use only a-z, 0-9, . _ -').optional(),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(128).optional(),
  })
  .refine((v) => v.username || v.newPassword, { message: 'Provide a new username and/or password' });