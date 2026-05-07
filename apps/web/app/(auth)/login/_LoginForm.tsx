'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Tile, Field, Input } from '@perfin/ui';
import { loginAction, type LoginState } from './actions';

const initial: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? 'Logging in…' : 'Log in'}
    </Button>
  );
}

export default function LoginForm() {
  const [state, action] = useFormState(loginAction, initial);

  return (
    <Tile variant="hero" className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="text-sm text-text-muted">Log in to continue.</p>
      </header>
      <form action={action} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" error={state.error}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton />
      </form>
    </Tile>
  );
}
