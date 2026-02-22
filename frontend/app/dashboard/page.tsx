'use client';

import { ScanLine, Users, Gift, Star } from 'lucide-react';
import { useMyBusiness } from '@/hooks/use-business';

const STAT_DEFS = [
  { label: 'Total Scans Today', icon: ScanLine, description: 'QR scans since midnight' },
  { label: 'Active Customers', icon: Users, description: 'Unique customers this month' },
  { label: 'Rewards Redeemed', icon: Gift, description: 'Claimed rewards this month' },
  { label: 'Points Issued', icon: Star, description: 'Total loyalty points issued' },
];

function StatCard({
  label,
  icon: Icon,
  description,
}: {
  label: string;
  icon: React.ElementType;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
          <Icon size={16} strokeWidth={1.5} className="text-muted-foreground" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">0</p>
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
  const { data: business, isLoading } = useMyBusiness();

  if (isLoading || !business) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{business.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_DEFS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Recent Activity</h2>
          <EmptyState message="No activity yet. Scans will appear here." />
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Reward Pool</h2>
          <EmptyState message="No rewards configured. Set up your reward pool." />
        </div>
      </div>
    </div>
  );
}
