'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useMyBusiness } from '@/hooks/use-business';
import { useRewards, useCreateReward, useUpdateReward, useDeactivateReward } from '@/hooks/use-rewards';
import type { Reward, RewardTier } from '@/lib/types';

const TIERS: RewardTier[] = ['miss', 'common', 'uncommon', 'rare', 'epic'];

const tierStyles: Record<RewardTier, string> = {
  miss: 'bg-muted text-muted-foreground',
  common: 'bg-green-500/10 text-green-700 dark:text-green-400',
  uncommon: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  rare: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  epic: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

type FormState = {
  name: string;
  description: string;
  tier: RewardTier;
  probability: string;
  stock: string;
  expires_in_days: string;
};

const defaultForm: FormState = {
  name: '',
  description: '',
  tier: 'common',
  probability: '10',
  stock: '',
  expires_in_days: '',
};

function rewardToForm(r: Reward): FormState {
  return {
    name: r.name,
    description: r.description ?? '',
    tier: r.tier,
    probability: r.probability,
    stock: r.stock != null ? String(r.stock) : '',
    expires_in_days: r.expiresInDays != null ? String(r.expiresInDays) : '',
  };
}

export default function RewardsPage() {
  const { data: business } = useMyBusiness();
  const { data: rewards, isLoading } = useRewards(business?.id);
  const createReward = useCreateReward(business?.id ?? '');
  const updateReward = useUpdateReward(business?.id ?? '');
  const deactivateReward = useDeactivateReward(business?.id ?? '');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(defaultForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(reward: Reward) {
    setEditing(reward);
    setForm(rewardToForm(reward));
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const body = {
      name: form.name,
      description: form.description || undefined,
      tier: form.tier,
      probability: parseFloat(form.probability),
      stock: form.stock ? parseInt(form.stock) : undefined,
      expires_in_days: form.expires_in_days ? parseInt(form.expires_in_days) : undefined,
    };

    try {
      if (editing) {
        await updateReward.mutateAsync({ id: editing.id, ...body });
      } else {
        await createReward.mutateAsync(body);
      }
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  const isPending = createReward.isPending || updateReward.isPending;
  const activeRewards = rewards?.filter((r) => r.isActive) ?? [];
  const inactiveRewards = rewards?.filter((r) => !r.isActive) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Rewards</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Configure your reward pool, tiers, and probabilities.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          <Plus size={14} strokeWidth={2} />
          Add reward
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && !rewards?.length && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No rewards yet.</p>
          <button onClick={openAdd} className="text-sm font-medium text-foreground underline">
            Add your first reward
          </button>
        </div>
      )}

      {activeRewards.length > 0 && (
        <RewardTable
          title="Active"
          rewards={activeRewards}
          onEdit={openEdit}
          onDeactivate={(id) => deactivateReward.mutate(id)}
        />
      )}

      {inactiveRewards.length > 0 && (
        <RewardTable
          title="Inactive"
          rewards={inactiveRewards}
          onEdit={openEdit}
          onDeactivate={(id) => deactivateReward.mutate(id)}
          dimmed
        />
      )}

      {modalOpen && (
        <Modal onClose={closeModal}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {editing ? 'Edit reward' : 'Add reward'}
            </h2>
            <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Name">
              <input
                type="text"
                required
                placeholder="e.g. Free Coffee"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </FormField>

            <FormField label="Description (optional)">
              <textarea
                rows={2}
                placeholder="Short description customers will see"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={`${inputClass} resize-none`}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tier">
                <select
                  value={form.tier}
                  onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as RewardTier }))}
                  className={inputClass}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Probability (%)">
                <input
                  type="number"
                  required
                  min={0.01}
                  max={100}
                  step={0.01}
                  value={form.probability}
                  onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
                  className={inputClass}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Stock (optional)">
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  className={inputClass}
                />
              </FormField>

              <FormField label="Expires in days (optional)">
                <input
                  type="number"
                  min={1}
                  placeholder="Never"
                  value={form.expires_in_days}
                  onChange={(e) => setForm((f) => ({ ...f, expires_in_days: e.target.value }))}
                  className={inputClass}
                />
              </FormField>
            </div>

            {formError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {isPending ? 'Saving...' : editing ? 'Save changes' : 'Add reward'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function RewardTable({
  title,
  rewards,
  onEdit,
  onDeactivate,
  dimmed,
}: {
  title: string;
  rewards: Reward[];
  onEdit: (r: Reward) => void;
  onDeactivate: (id: string) => void;
  dimmed?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card shadow-xs ${dimmed ? 'opacity-60' : ''}`}>
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Tier</th>
              <th className="px-4 py-2.5 font-medium">Probability</th>
              <th className="px-4 py-2.5 font-medium">Stock</th>
              <th className="px-4 py-2.5 font-medium">Expires</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rewards.map((r) => (
              <tr key={r.id} className="text-sm">
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{r.name}</span>
                  {r.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <TierBadge tier={r.tier} />
                </td>
                <td className="px-4 py-3 font-mono text-foreground">
                  {parseFloat(r.probability).toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.stock != null ? r.stock : '∞'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.expiresInDays != null ? `${r.expiresInDays}d` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(r)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                    </button>
                    {r.isActive && (
                      <button
                        onClick={() => onDeactivate(r.id)}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Deactivate"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: RewardTier }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tierStyles[tier]}`}
    >
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-xl bg-card p-5 shadow-xl sm:rounded-xl">
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
