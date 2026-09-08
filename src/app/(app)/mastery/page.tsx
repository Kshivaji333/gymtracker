'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { WEAPONS, TOTAL_TESTS } from '../../../lib/constants';

export default function MasteryPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase.auth]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('mastery')
        .select('test_id')
        .eq('user_id', userId);
      if (!cancelled && data) {
        setPassed(new Set(data.map(r => r.test_id)));
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId, supabase]);

  const toggleTest = useCallback(
    (testId: string) => {
      if (!userId) return;
      setPassed(prev => {
        const next = new Set(prev);
        if (next.has(testId)) {
          next.delete(testId);
          supabase.from('mastery').delete().eq('user_id', userId).eq('test_id', testId).then();
        } else {
          next.add(testId);
          supabase.from('mastery').insert({ user_id: userId, test_id: testId }).then();
        }
        return next;
      });
    },
    [userId, supabase],
  );

  const totalPassed = passed.size;
  const overallPct = (totalPassed / TOTAL_TESTS) * 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-5">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Mastery</h1>

      {/* Overall progress */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
            {totalPassed}<span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}> / {TOTAL_TESTS}</span>
          </span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {Math.round(overallPct)}% mastered
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${overallPct}%`,
              backgroundColor: overallPct === 100 ? 'rgb(34, 197, 94)' : 'rgb(245, 158, 11)',
            }}
          />
        </div>
      </div>

      {/* Weapons */}
      {WEAPONS.map(weapon => {
        const weaponPassed = weapon.tests.filter(t => passed.has(t.id)).length;
        const cleared = weaponPassed === 4;

        return (
          <section key={weapon.id} className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {weapon.id}. {weapon.name}
                {cleared && <span className="ml-2 text-success">✓ Clear</span>}
              </h2>
              <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {weaponPassed} / 4
              </span>
            </div>
            {/* Mini progress */}
            <div className="h-1.5 rounded-full overflow-hidden mx-1" style={{ background: 'var(--bg-input)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(weaponPassed / 4) * 100}%`,
                  backgroundColor: cleared ? 'rgb(34, 197, 94)' : 'rgb(245, 158, 11)',
                }}
              />
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)' }}>
              {weapon.tests.map((test, i) => {
                const checked = passed.has(test.id);
                return (
                  <button
                    key={test.id}
                    onClick={() => toggleTest(test.id)}
                    className={`tap-target w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                      i < weapon.tests.length - 1 ? 'border-b' : ''
                    }`}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        checked ? 'bg-success border-success' : ''
                      }`}
                      style={!checked ? { borderColor: 'var(--border)' } : undefined}
                    >
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <p className={`text-sm flex-1 ${checked ? 'line-through opacity-60' : ''}`} style={{ color: 'var(--text)' }}>
                      {test.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
