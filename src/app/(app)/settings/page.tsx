'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Settings } from '../../../lib/types';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [kcalTarget, setKcalTarget] = useState('2850');
  const [proteinTarget, setProteinTarget] = useState('110');
  const [bodyweightKg, setBodyweightKg] = useState('');

  // Theme
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return 'system';
  });

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    setTheme(t);
    if (t === 'system') {
      localStorage.removeItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      localStorage.setItem('theme', t);
      document.documentElement.classList.toggle('dark', t === 'dark');
    }
  };

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const s = structuredClone(data) as Settings;
        setSettings(s);
        setKcalTarget(String(s.kcal_target));
        setProteinTarget(String(s.protein_target));
        setBodyweightKg(s.bodyweight_kg != null ? String(s.bodyweight_kg) : '');
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!settings) return;
      setSaving(true);
      setSaved(false);

      await supabase
        .from('settings')
        .update({
          kcal_target: Number(kcalTarget),
          protein_target: Number(proteinTarget),
          bodyweight_kg: bodyweightKg ? Number(bodyweightKg) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', settings.user_id);

      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    [settings, kcalTarget, proteinTarget, bodyweightKg, supabase],
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-5">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Settings</h1>

      <form onSubmit={handleSave} className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--bg-card)' }}>
        <div className="space-y-1.5">
          <label htmlFor="kcal" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Daily calorie target
          </label>
          <input
            id="kcal"
            type="number"
            value={kcalTarget}
            onChange={e => setKcalTarget(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
            style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="protein" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Daily protein target (g)
          </label>
          <input
            id="protein"
            type="number"
            value={proteinTarget}
            onChange={e => setProteinTarget(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
            style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bw" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Bodyweight (kg)
          </label>
          <input
            id="bw"
            type="number"
            step="0.1"
            value={bodyweightKg}
            onChange={e => setBodyweightKg(e.target.value)}
            placeholder="—"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 tabular-nums"
            style={{ background: 'var(--bg-input)', color: 'var(--text)', '--tw-ring-color': 'var(--ring)' } as React.CSSProperties}
          />
        </div>

        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          2850 kcal / 110 g is set for 50 kg — raise it as bodyweight goes up.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="tap-target w-full rounded-xl bg-primary-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-600 active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </form>

      {/* Theme */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Appearance</h2>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map(t => (
            <button
              key={t}
              onClick={() => applyTheme(t)}
              className={`tap-target flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                theme === t ? 'bg-primary-500 text-white' : ''
              }`}
              style={theme !== t ? { background: 'var(--bg-input)', color: 'var(--text-secondary)' } : undefined}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="tap-target w-full rounded-xl py-3 text-sm font-semibold text-danger border border-danger/30 transition-all hover:bg-danger/10 active:scale-[0.98]"
      >
        Sign out
      </button>
    </div>
  );
}
