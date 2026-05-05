'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { signIn } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) return { error: 'Enter a valid email and password.' };

  try {
    await signIn('credentials', { ...parsed.data, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return { error: 'Wrong email or password.' };
    throw err;
  }

  redirect('/app');
}
