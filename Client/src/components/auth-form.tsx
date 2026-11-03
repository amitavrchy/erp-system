'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useDispatch } from 'react-redux';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api, setToken, errorMessage } from '@/lib/api';
import { session, activeOrg, type Dispatch } from '@/store';
import type { Me } from '@/lib/types';
import { Button } from './ui';
import { SessionBoundary } from './session-boundary';
const schema = z.object({
  email: z.email('Enter a valid email').optional(),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  name: z.string().optional(),
  organization: z.string().optional(),
});
type AuthProps = { mode: 'login' | 'register' | 'invite'; token?: string };
export function AuthForm(props: AuthProps) {
  return (
    <SessionBoundary>
      <AuthFields {...props} />
    </SessionBoundary>
  );
}
function AuthFields({ mode, token }: AuthProps) {
  const router = useRouter();
  const dispatch = useDispatch<Dispatch>();
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSubmitting, setSubmitting] = useState(false);
  const signup = mode === 'register';
  const invite = mode === 'invite';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    // Read native input values at submission, including browser/password-manager autofill.
    const result = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    setError('');
    setErrors({});
    if (!result.success) {
      setErrors(z.flattenError(result.error).fieldErrors);
      return;
    }
    const v = result.data;
    setSubmitting(true);
    try {
      const body = invite
        ? { token, name: v.name, password: v.password }
        : signup
          ? { ...v }
          : { email: v.email, password: v.password };
      const r = await api.post<{ accessToken: string }>(
        `/auth/${invite ? 'accept-invite' : mode}`,
        body,
      );
      setToken(r.data.accessToken);
      const me = await api.get<Me>('/me');
      dispatch(session(me.data));
      dispatch(activeOrg(me.data.activeOrgId));
      router.push('/app');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-mark">l</span>ledgerflow
        </Link>
        <h1>
          A clear head.
          <br />A connected business.
        </h1>
        <p>Everything your team needs to turn everyday operations into forward momentum.</p>
        <div className="auth-quote">
          <ShieldCheck size={25} />
          <p style={{ marginTop: 12 }}>Your workspace. Your team. Your data.</p>
          <p style={{ marginTop: 6 }}>
            Secure access, clear permissions and a history of every important change.
          </p>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <p className="eyebrow">WELCOME TO LEDGERFLOW</p>
          <h1>{invite ? 'Join your team' : signup ? 'Find your flow.' : 'Welcome back.'}</h1>
          <p className="muted">
            {invite
              ? 'Accept your invitation. Existing users should use their account password.'
              : signup
                ? 'Create a workspace for your next chapter.'
                : 'Your business is right where you left it.'}
          </p>
          <form onSubmit={submit}>
            {error && (
              <div className="form-alert" role="alert">
                {error}
              </div>
            )}
            {(signup || invite) && (
              <label>
                Your name
                <input autoComplete="name" required minLength={2} maxLength={100} name="name" />
              </label>
            )}
            {!invite && (
              <label>
                Work email
                <input
                  type="email"
                  required
                  name="email"
                  autoComplete={signup ? 'email' : 'username'}
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'auth-email-error' : undefined}
                  placeholder="you@company.com"
                />
                {errors.email && (
                  <span id="auth-email-error" className="field-error">
                    {errors.email[0]}
                  </span>
                )}
              </label>
            )}
            {signup && (
              <label>
                Workspace name
                <input
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Acme Studio"
                  name="organization"
                />
              </label>
            )}
            <label>
              Password
              <input
                type="password"
                name="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete={signup || invite ? 'new-password' : 'current-password'}
                placeholder="At least 10 characters"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'auth-password-error' : undefined}
              />
              {errors.password && (
                <span id="auth-password-error" className="field-error">
                  {errors.password[0]}
                </span>
              )}
            </label>
            <Button type="submit" variant="primary" busy={isSubmitting}>
              {invite ? 'Join workspace' : signup ? 'Create workspace' : 'Sign in'}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="muted auth-switch">
            {signup ? 'Already have an account?' : 'New to Ledgerflow?'}{' '}
            <Link className="link" href={signup ? '/login' : '/register'}>
              {signup ? 'Sign in' : 'Create a workspace'}
            </Link>
          </p>
          <p className="muted auth-switch">
            <Link href="/">← Back to Ledgerflow</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
