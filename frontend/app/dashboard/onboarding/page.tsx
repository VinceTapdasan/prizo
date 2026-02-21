'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateBusiness } from '@/hooks/use-business';

export default function OnboardingPage() {
  const router = useRouter();
  const createBusiness = useCreateBusiness();
  const [form, setForm] = useState({ name: '', type: '', location: '' });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createBusiness.mutateAsync({
        name: form.name,
        type: form.type || undefined,
        location: form.location || undefined,
      });
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Set up your venue</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tell us about your business to get started with Prizo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="name">
              Venue name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="e.g. The Rusty Barrel"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="type">
              Type <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="type"
              type="text"
              placeholder="e.g. Bar, Restaurant, Cafe"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="location">
              Location <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="location"
              type="text"
              placeholder="e.g. 42 King St, Sydney"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={createBusiness.isPending || !form.name.trim()}
            className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {createBusiness.isPending ? 'Creating...' : 'Create venue'}
          </button>
        </form>
      </div>
    </div>
  );
}
