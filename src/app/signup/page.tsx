'use client';

import { useState, FormEvent } from 'react';
import { createClient } from '../../lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, redirect to home
    // Otherwise show confirmation message
    setSuccess(true);
    setLoading(false);

    // Try to sign in immediately (works if email confirmation is off)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError) {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 mb-2">
            <svg className="w-7 h-7 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Create account</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Start tracking your nutrition</p>
        </div>

        {success ? (
          <div className="rounded-xl px-4 py-5 text-center space-y-2 bg-success/10 border border-success/20">
            <p className="text-success font-medium">Account created!</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Check your email for a confirmation link, then{' '}
              <Link href="/login" className="font-medium text-primary-500 hover:text-primary-400">sign in</Link>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm bg-danger/10 text-danger border border-danger/20">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all focus:ring-2"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', borderColor: 'var(--border)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all focus:ring-2"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', borderColor: 'var(--border)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="tap-target w-full rounded-xl bg-primary-500 py-3.5 text-base font-semibold text-white transition-all hover:bg-primary-600 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Sign up'}
            </button>
          </form>
        )}

        <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary-500 hover:text-primary-400 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
