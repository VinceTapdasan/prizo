'use client';

import { ScanLine, Users, Gift } from 'lucide-react';
import { useMyBusiness } from '@/hooks/use-business';
import { useAnalyticsOverview } from '@/hooks/use-analytics';

function StatRow({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
          <Icon size={15} strokeWidth={1.5} className="text-muted-foreground" />
        </div>
        <span className="text-sm text-foreground">{label}</span>
      </div>
      {isLoading ? (
        <div className="h-5 w-10 animate-pulse rounded bg-muted" />
      ) : (
        <span className="text-sm font-semibold text-foreground">{value ?? 0}</span>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: business, isLoading: businessLoading } = useMyBusiness();
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsOverview(business?.id);

  const isLoading = businessLoading || analyticsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Spin outcomes, reward distribution, and customer trends.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-xs">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Overview</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">All-time totals for your venue</p>
        </div>
        <div className="divide-y divide-border px-5">
          <StatRow
            label="Scans Today"
            value={analytics?.scans_today}
            icon={ScanLine}
            isLoading={isLoading}
          />
          <StatRow
            label="Total Customers"
            value={analytics?.total_customers}
            icon={Users}
            isLoading={isLoading}
          />
          <StatRow
            label="Total Redemptions"
            value={analytics?.total_redemptions}
            icon={Gift}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
