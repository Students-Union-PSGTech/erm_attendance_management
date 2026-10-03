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
