'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button, Tile, Field, Input } from '@perfin/ui';
import { signupAction, type SignupState } from './actions';

const initial: SignupState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? 'Creating account…' : 'Create account'}
    </Button>
  );
}

export default function SignupForm() {
  const [state, action] = useFormState(signupAction, initial);

  return (
    <Tile variant="hero" className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Create your Perfin account</h1>
        <p className="text-sm text-text-muted">It's free. No card required.</p>
      </header>
      <form action={action} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint="At least 8 characters."
          error={state.error}
        >
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton />
      </form>
    </Tile>
  );
}
