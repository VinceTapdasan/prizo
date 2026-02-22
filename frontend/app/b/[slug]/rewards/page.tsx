'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useBusinessBySlug } from '@/hooks/use-spins';
import { useMyRewardsForBusiness } from '@/hooks/use-customer';
import type { CustomerReward, RewardTier } from '@/lib/types';

const PHONE_KEY = 'prizo_phone';

const tierColors: Record<RewardTier, string> = {
  miss: 'bg-muted text-muted-foreground',
  common: 'bg-green-500/15 text-green-700 dark:text-green-400',
  uncommon: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  rare: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  epic: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

const tierLabel: Record<RewardTier, string> = {
  miss: 'Miss',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatExpiry(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  if (h < 1) return `Expires in ${m}m`;
  if (h < 24) return `Expires in ${h}h ${m}m`;
  const days = Math.ceil(h / 24);
  return `Expires in ${days} day${days > 1 ? 's' : ''}`;
}

export default function CustomerRewardsPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);

  const { data: business, isLoading: businessLoading } = useBusinessBySlug(params.slug);
  const { data: rewards, isLoading: rewardsLoading } = useMyRewardsForBusiness(
    business?.id,
    phone ?? undefined,
  );

  useEffect(() => {
    const stored = localStorage.getItem(PHONE_KEY);
    if (stored) {
      setPhone(stored);
    } else {
      router.replace(`/b/${params.slug}/spin`);
    }
  }, [params.slug, router]);

  if (businessLoading || !phone) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Venue not found.</p>
      </div>
    );
  }

  const unclaimed = rewards?.filter((r) => r.status === 'unclaimed') ?? [];
  const redeemed = rewards?.filter((r) => r.status === 'redeemed') ?? [];
  const expired = rewards?.filter((r) => r.status === 'expired') ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="font-semibold text-foreground">{business.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{phone}</span>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <h1 className="text-lg font-semibold text-foreground">My rewards</h1>

        {rewardsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : rewards?.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No rewards yet — spin to win!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Unclaimed */}
            {unclaimed.length > 0 && (
              <section className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles size={12} />
                  Unclaimed · {unclaimed.length}
                </h2>
                <div className="space-y-2">
                  {unclaimed.map((r) => (
                    <RewardCard
                      key={r.id}
                      reward={r}
                      action={
                        <button
                          onClick={() => router.push(`/b/${params.slug}/spin`)}
                          className="shrink-0 rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:opacity-80"
                        >
                          Claim
                        </button>
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Redeemed */}
            {redeemed.length > 0 && (
              <section className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <CheckCircle2 size={12} />
                  Claimed · {redeemed.length}
                </h2>
                <div className="space-y-2">
                  {redeemed.map((r) => (
                    <RewardCard key={r.id} reward={r} dimmed />
                  ))}
                </div>
              </section>
            )}

            {/* Expired */}
            {expired.length > 0 && (
              <section className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <XCircle size={12} />
                  Expired · {expired.length}
                </h2>
                <div className="space-y-2">
                  {expired.map((r) => (
                    <RewardCard key={r.id} reward={r} dimmed />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RewardCard({
  reward,
  action,
  dimmed = false,
}: {
  reward: CustomerReward;
  action?: React.ReactNode;
  dimmed?: boolean;
}) {
  const statusConfig = {
    unclaimed: {
      label: 'Unclaimed',
      icon: <Clock size={11} />,
      classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    redeemed: {
      label: 'Claimed',
      icon: <CheckCircle2 size={11} />,
      classes: 'bg-green-500/10 text-green-700 dark:text-green-400',
    },
    expired: {
      label: 'Expired',
      icon: <XCircle size={11} />,
      classes: 'bg-muted text-muted-foreground',
    },
  };

  const sc = statusConfig[reward.status];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 ${dimmed ? 'opacity-50' : ''}`}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierColors[reward.rewardTier]}`}
          >
            <Sparkles size={9} />
            {tierLabel[reward.rewardTier]}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.classes}`}
          >
            {sc.icon}
            {sc.label}
          </span>
        </div>
        <p className="truncate text-sm font-medium text-foreground">{reward.rewardName}</p>
        <p className="text-xs text-muted-foreground">
          {reward.status === 'unclaimed'
            ? formatExpiry(reward.expiresAt)
            : reward.status === 'redeemed' && reward.redeemedAt
              ? `Claimed ${formatDate(reward.redeemedAt)}`
              : `Expired ${formatDate(reward.expiresAt)}`}
        </p>
      </div>
      {action}
    </div>
  );
}
