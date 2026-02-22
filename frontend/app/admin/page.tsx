'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAdminBusinesses, useAdminActivityLogs, useAdminFrequency } from '@/hooks/use-admin';
import type { AdminBusiness } from '@/lib/types';

export default function AdminPage() {
  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        const role = session?.user?.app_metadata?.role;
        setIsSuperadmin(role === 'superadmin');
      });
  }, []);

  if (isSuperadmin === null) {
    return <PageShell><Spinner /></PageShell>;
  }

  if (!isSuperadmin) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-lg font-semibold text-foreground">Access denied</p>
          <p className="mt-1 text-sm text-muted-foreground">This page is restricted.</p>
        </div>
      </PageShell>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const [selectedBusiness, setSelectedBusiness] = useState<AdminBusiness | null>(null);
  const { data: businesses, isLoading: businessesLoading } = useAdminBusinesses();
  const { data: logs, isLoading: logsLoading } = useAdminActivityLogs(50);
  const { data: frequency } = useAdminFrequency(selectedBusiness?.id ?? null);

  return (
    <PageShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Superadmin
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-foreground">Prizo Admin</h1>
        </div>

        {/* Businesses table */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Businesses</h2>

          {businessesLoading ? (
            <TableSkeleton rows={3} cols={6} />
          ) : !businesses || businesses.length === 0 ? (
            <EmptyState message="No businesses registered yet." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <Th>Venue</Th>
                    <Th>Type</Th>
                    <Th align="right">Customers</Th>
                    <Th align="right">Spins</Th>
                    <Th align="right">Return rate</Th>
                    <Th>Last active</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {businesses.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBusiness(b.id === selectedBusiness?.id ? null : b)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/30',
                        selectedBusiness?.id === b.id && 'bg-muted/50',
                      )}
                    >
                      <Td>
                        <span className="font-medium text-foreground">{b.name}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{b.slug}</span>
                      </Td>
                      <Td>{b.type ?? '—'}</Td>
                      <Td align="right">{b.total_customers}</Td>
                      <Td align="right">{b.total_spins}</Td>
                      <Td align="right">
                        <ReturnBadge pct={b.return_rate_pct} />
                      </Td>
                      <Td>{b.last_active ? formatDate(b.last_active) : 'Never'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Frequency panel — shown when a business is selected */}
        {selectedBusiness && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Frequency — {selectedBusiness.name}
            </h2>
            {frequency ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total customers" value={frequency.total_customers} />
                <StatCard label="New customers" value={frequency.new_customers} />
                <StatCard label="Returning" value={frequency.returning_customers} />
                <StatCard label="Return rate" value={`${frequency.return_rate_pct}%`} />
              </div>
            ) : (
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
            )}
          </section>
        )}

        {/* Activity log */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>

          {logsLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !logs || logs.length === 0 ? (
            <EmptyState message="No activity logged yet." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <Th>Time</Th>
                    <Th>Venue</Th>
                    <Th>Action</Th>
                    <Th>Customer</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <Td>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </span>
                      </Td>
                      <Td>{log.businessName}</Td>
                      <Td>
                        <ActionBadge type={log.actionType} />
                      </Td>
                      <Td>
                        <span className="font-mono text-xs">{log.phoneNumber ?? '—'}</span>
                      </Td>
                      <Td>
                        <LogDetails details={log.details} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-xs font-semibold text-muted-foreground',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-sm text-foreground',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </td>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ReturnBadge({ pct }: { pct: number }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
        pct >= 50
          ? 'bg-green-500/15 text-green-700 dark:text-green-400'
          : pct >= 20
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {pct}%
    </span>
  );
}

function ActionBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        type === 'SPIN'
          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
          : 'bg-green-500/15 text-green-700 dark:text-green-400',
      )}
    >
      {type}
    </span>
  );
}

function LogDetails({ details }: { details: Record<string, unknown> }) {
  if (details.action_type === 'SPIN' || 'won' in details) {
    const won = details.won as boolean;
    const tier = details.tier as string | null;
    const rewardName = details.reward_name as string | null;
    const pts = details.points_earned as number;
    const firstVisit = details.is_first_visit as boolean;

    return (
      <span className="text-xs text-muted-foreground">
        {won ? (
          <span className="font-medium text-foreground">
            Won: {rewardName ?? tier}
          </span>
        ) : (
          'Miss'
        )}
        {' · '}+{pts} pts
        {firstVisit && (
          <span className="ml-1.5 rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-400">
            NEW
          </span>
        )}
      </span>
    );
  }

  if ('reward_name' in details) {
    return (
      <span className="text-xs text-muted-foreground">
        Redeemed: {details.reward_name as string}
      </span>
    );
  }

  return <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(details)}</span>;
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn('flex gap-4 px-4 py-3', i === 0 && 'bg-muted/40')}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 flex-1 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
