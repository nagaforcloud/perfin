import type { Account, Profile } from 'next-auth';

export interface SignInCallbackDeps {
  findUser: (email: string) => Promise<{ id: number } | null>;
  insertUser: (email: string) => Promise<void>;
}

export function makeSignInCallback(deps: SignInCallbackDeps) {
  return async function signIn(params: { account: Account | null; profile?: Profile }) {
    if (params.account?.provider !== 'google') return true;

    const email = params.profile?.email;
    if (!email) return false;

    const emailVerified = (params.profile as { email_verified?: boolean } | undefined)?.email_verified;
    if (emailVerified === false) return false;

    const lower = email.toLowerCase();
    const existing = await deps.findUser(lower);
    if (!existing) await deps.insertUser(lower);
    return true;
  };
}
