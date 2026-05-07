import Link from 'next/link';
import { GoogleButton } from '@/components/auth/GoogleButton';
import LoginForm from './_LoginForm';
import { env } from '@/lib/env';

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  const googleEnabled = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
  const errorMessage = errorBanner(sp.error);

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="text-sm text-negative bg-negative-soft border border-negative rounded-md p-3">
          {errorMessage}
        </div>
      )}
      {googleEnabled && (
        <>
          <GoogleButton callbackUrl="/app" />
          <div className="flex items-center gap-2 text-xs text-text-subtle">
            <span className="flex-1 border-t border-border" />
            <span>or</span>
            <span className="flex-1 border-t border-border" />
          </div>
        </>
      )}
      <LoginForm />
      <p className="text-sm text-text-muted text-center">
        New here? <Link className="text-accent" href="/signup">Create an account</Link>
      </p>
    </div>
  );
}

function errorBanner(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case 'OAuthSignin':
    case 'OAuthCallback': return 'Sign-in was cancelled or failed. Please try again.';
    case 'AccessDenied':  return "We couldn't verify your Google email. Try a different account.";
    case 'OAuthAccountNotLinked': return 'That email is already registered with a password. Sign in with email + password instead.';
    default: return 'Something went wrong. Please try again.';
  }
}
