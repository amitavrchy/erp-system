'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch } from 'react-redux';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api, setToken, errorMessage } from '@/lib/api';
import { session, activeOrg, type Dispatch } from '@/store';
import type { Me } from '@/lib/types';
import { Button } from './ui';
const schema = z.object({
  email: z.email('Enter a valid email').optional(),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  name: z.string().optional(),
  organization: z.string().optional(),
});
type Values = z.infer<typeof schema>;
export function AuthForm({
  mode,
  token,
}: {
  mode: 'login' | 'register' | 'invite';
  token?: string;
}) {
  const router = useRouter();
  const dispatch = useDispatch<Dispatch>();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const signup = mode === 'register';
  const invite = mode === 'invite';
  async function submit(v: Values) {
    setError('');
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
          <form onSubmit={handleSubmit(submit)}>
            {error && (
              <div className="form-alert" role="alert">
                {error}
              </div>
            )}
            {(signup || invite) && (
              <label>
                Your name
                <input
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  {...register('name')}
                />
              </label>
            )}
            {!invite && (
              <label>
                Work email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  {...register('email')}
                />
                {errors.email && <span className="field-error">{errors.email.message}</span>}
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
                  {...register('organization')}
                />
              </label>
            )}
            <label>
              Password
              <input
                type="password"
                autoComplete={signup || invite ? 'new-password' : 'current-password'}
                placeholder="At least 10 characters"
                {...register('password')}
              />
              {errors.password && <span className="field-error">{errors.password.message}</span>}
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
