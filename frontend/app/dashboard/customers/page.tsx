'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
} from 'lucide-react';
import { useMyBusiness } from '@/hooks/use-business';
import { useBusinessCustomers } from '@/hooks/use-customer';
import type { BusinessCustomer, BusinessCustomerReward, RewardTier, RewardStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

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

const statusConfig: Record<
  RewardStatus,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  unclaimed: {
    label: 'Unclaimed',
    classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    icon: <Clock size={10} />,
  },
  redeemed: {
    label: 'Claimed',
    classes: 'bg-green-500/10 text-green-700 dark:text-green-400',
    icon: <CheckCircle2 size={10} />,
  },
  expired: {
    label: 'Expired',
    classes: 'bg-muted text-muted-foreground',
    icon: <XCircle size={10} />,
  },
};

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return phone.slice(0, 6) + ' *** ' + phone.slice(-4);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

function RewardRow({ reward }: { reward: BusinessCustomerReward }) {
  const sc = statusConfig[reward.status];
  return (
    <li className="flex items-center gap-2 py-1.5">
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
          tierColors[reward.rewardTier],
        )}
      >
        <Sparkles size={9} />
        {tierLabel[reward.rewardTier]}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
          sc.classes,
        )}
      >
        {sc.icon}
        {sc.label}
      </span>
      <span className="min-w-0 truncate text-xs text-foreground">{reward.rewardName}</span>
      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
        {reward.status === 'redeemed' && reward.redeemedAt
          ? formatDate(reward.redeemedAt)
          : formatDate(reward.expiresAt)}
      </span>
    </li>
  );
}

function CustomerCard({ customer }: { customer: BusinessCustomer }) {
  const [expanded, setExpanded] = useState(false);
  const hasRewards = customer.rewards.length > 0;
  const hasUnclaimed = customer.unclaimed_count > 0;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-xs',
        hasUnclaimed ? 'border-amber-500/40' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm font-medium text-foreground">
              {maskPhone(customer.phone_number)}
            </p>
            <span className="text-xs font-medium text-muted-foreground">
              {customer.loyalty_points} pts
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {customer.last_spin_at
              ? `Last spin ${formatRelative(customer.last_spin_at)}`
              : 'No spins yet'}
          </p>
          {hasRewards && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {customer.unclaimed_count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  <Clock size={10} />
                  {customer.unclaimed_count} unclaimed
                </span>
              )}
              {customer.redeemed_count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">
                  <CheckCircle2 size={10} />
                  {customer.redeemed_count} claimed
                </span>
              )}
              {customer.expired_count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  <XCircle size={10} />
                  {customer.expired_count} expired
                </span>
              )}
            </div>
          )}
        </div>
        {hasRewards && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={expanded ? 'Collapse rewards' : 'Expand rewards'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {expanded && hasRewards && (
        <div className="border-t border-border px-4 pb-3">
          <ul className="divide-y divide-border">
            {customer.rewards.map((r) => (
              <RewardRow key={r.id} reward={r} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const { data: business, isLoading: businessLoading } = useMyBusiness();
  const { data: customers, isLoading: customersLoading } = useBusinessCustomers(business?.id);

  if (businessLoading || !business) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const totalUnclaimed = customers?.reduce((sum, c) => sum + c.unclaimed_count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Customers</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          View and manage your customer loyalty activity.
        </p>
      </div>

      {customersLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !customers || customers.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border">
          <Users size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No customers yet</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {customers.length} customer{customers.length !== 1 ? 's' : ''}
            </p>
            {totalUnclaimed > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Clock size={11} />
                {totalUnclaimed} unclaimed reward{totalUnclaimed !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {customers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
