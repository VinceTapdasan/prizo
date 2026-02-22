'use client';

import { ScanLine, Users, Gift } from 'lucide-react';
import { useMyBusiness } from '@/hooks/use-business';
import { useAnalyticsOverview } from '@/hooks/use-analytics';
import { useRewards } from '@/hooks/use-rewards';

function StatCard({
  label,
  icon: Icon,
  description,
  value,
  isLoading,
}: {
  label: string;
  icon: React.ElementType;
  description: string;
  value: number | undefined;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
          <Icon size={16} strokeWidth={1.5} className="text-muted-foreground" />
        </div>
      </div>
      {isLoading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      ) : (
        <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data: business, isLoading: businessLoading } = useMyBusiness();
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsOverview(business?.id);
  const { data: rewards } = useRewards(business?.id);

  if (businessLoading || !business) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Scans Today',
      icon: ScanLine,
      description: 'QR scans since midnight',
      value: analytics?.scans_today,
    },
    {
      label: 'Total Customers',
      icon: Users,
      description: 'Unique customers who have visited',
      value: analytics?.total_customers,
    },
    {
      label: 'Rewards Redeemed',
      icon: Gift,
      description: 'Total claimed rewards all-time',
      value: analytics?.total_redemptions,
    },
  ];

  const activeRewards = rewards?.filter((r) => r.isActive) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{business.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} isLoading={analyticsLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Reward Pool</h2>
          {activeRewards.length === 0 ? (
            <EmptyState message="No rewards configured. Set up your reward pool." />
          ) : (
            <ul className="divide-y divide-border">
              {activeRewards.map((reward) => (
                <li key={reward.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{reward.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{reward.tier}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{reward.probability}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Business Info</h2>
          <dl className="space-y-2.5">
            <div className="flex justify-between">
              <dt className="text-xs text-muted-foreground">Type</dt>
              <dd className="text-xs font-medium text-foreground capitalize">
                {business.type ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-muted-foreground">Points per scan</dt>
              <dd className="text-xs font-medium text-foreground">{business.pointsPerScan}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-muted-foreground">Pity threshold</dt>
              <dd className="text-xs font-medium text-foreground">{business.pityThreshold} spins</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-muted-foreground">Reset time</dt>
              <dd className="text-xs font-medium text-foreground">{business.resetTime}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
