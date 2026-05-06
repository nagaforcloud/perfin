'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createDb, users } from '@perfin/db';
import { env } from '@/lib/env';
import { hashPassword } from '@/lib/password';
import { signIn } from '@/lib/auth';

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const { db } = createDb(env.DATABASE_URL);

export type SignupState = { error?: string };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = schema.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) {
    return { error: 'Enter a valid email and an 8+ character password.' };
  }

  const { email, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    await db.insert(users).values({ email, passwordHash });
  } catch (err) {
    if (err instanceof Error && err.message.includes('users_email_unique')) {
      return { error: 'That email is already registered. Try logging in.' };
    }
    throw err;
  }

  await signIn('credentials', { email, password, redirect: false });
  redirect('/onboarding/welcome');
}
