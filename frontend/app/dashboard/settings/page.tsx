'use client';

import { useState, useEffect } from 'react';
import { useMyBusiness, useUpdateBusiness } from '@/hooks/use-business';

export default function SettingsPage() {
  const { data: business, isLoading } = useMyBusiness();
  const update = useUpdateBusiness(business?.id ?? '');

  const [form, setForm] = useState({
    name: '',
    reset_time: '05:00',
    points_per_scan: 10,
    pity_threshold: 7,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name,
        reset_time: business.resetTime.slice(0, 5),
        points_per_scan: business.pointsPerScan,
        pity_threshold: business.pityThreshold,
      });
    }
  }, [business]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        name: form.name,
        reset_time: form.reset_time,
        points_per_scan: form.points_per_scan,
        pity_threshold: form.pity_threshold,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your venue, spin reset time, pity threshold, and points configuration.
          </p>
        </div>
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">No venue found. Please complete onboarding.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your venue, spin reset time, pity threshold, and points configuration.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        <Section title="Venue">
          <Field label="Venue name">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </Section>

        <Section title="Spin settings">
          <Field
            label="Daily reset time"
            hint="Spins reset at this time each day (local server time)"
          >
            <input
              type="time"
              value={form.reset_time}
              onChange={(e) => setForm((f) => ({ ...f, reset_time: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field
            label="Points per scan"
            hint="Loyalty points awarded to a customer on each visit"
          >
            <input
              type="number"
              min={1}
              max={1000}
              value={form.points_per_scan}
              onChange={(e) =>
                setForm((f) => ({ ...f, points_per_scan: Number(e.target.value) }))
              }
              className={inputClass}
            />
          </Field>

          <Field
            label="Pity threshold"
            hint="Guaranteed win after this many consecutive misses"
          >
            <input
              type="number"
              min={1}
              max={50}
              value={form.pity_threshold}
              onChange={(e) =>
                setForm((f) => ({ ...f, pity_threshold: Number(e.target.value) }))
              }
              className={inputClass}
            />
          </Field>
        </Section>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {update.isPending ? 'Saving...' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-muted-foreground">Saved</span>}
        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
