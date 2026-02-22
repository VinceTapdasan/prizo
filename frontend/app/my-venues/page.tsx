'use client';

import Link from 'next/link';
import { MapPin, Star, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMyVenues } from '@/hooks/use-customer';
import type { CustomerVenue } from '@/lib/types';

export default function MyVenuesPage() {
  const { data: venues, isLoading } = useMyVenues();

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Prizo
        </p>
        <h1 className="mt-0.5 text-lg font-semibold text-foreground">Your Venues</h1>
      </header>

      <main className="px-4 py-4">
        {isLoading ? (
          <VenueListSkeleton />
        ) : !venues || venues.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {venues.map((venue) => (
              <VenueCard key={venue.business_id} venue={venue} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function VenueCard({ venue }: { venue: CustomerVenue }) {
  const pityPct = Math.min((venue.pity_counter / venue.pity_threshold) * 100, 100);
  const showPity = venue.pity_counter > 0;

  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-xs">
      {/* Top row: name + spin badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{venue.business_name}</p>
          {venue.business_type && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={10} strokeWidth={1.5} />
              <span className="capitalize">{venue.business_type}</span>
            </p>
          )}
        </div>

        <SpinBadge available={venue.spin_available} />
      </div>

      {/* Points */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Star size={11} strokeWidth={1.5} />
        <span>
          <span className="font-semibold text-foreground">{venue.loyalty_points}</span> pts
        </span>
      </div>

      {/* Pity bar */}
      {showPity && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Pity progress</span>
            <span>
              {venue.pity_counter}/{venue.pity_threshold}
              {venue.spins_until_guaranteed !== null && venue.spins_until_guaranteed > 0 && (
                <span className="ml-1 text-foreground">
                  · {venue.spins_until_guaranteed} until guaranteed
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-500"
              style={{ width: `${pityPct}%` }}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-4">
        <Link
          href={`/b/${venue.business_slug}/spin`}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-opacity',
            venue.spin_available
              ? 'bg-foreground text-background hover:opacity-80'
              : 'border border-border bg-transparent text-muted-foreground',
          )}
        >
          {venue.spin_available ? (
            <>
              <Zap size={13} strokeWidth={2} />
              Spin now
            </>
          ) : (
            <>
              Come back tomorrow
              <ChevronRight size={13} strokeWidth={1.5} />
            </>
          )}
        </Link>
      </div>
    </li>
  );
}

function SpinBadge({ available }: { available: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        available
          ? 'bg-green-500/15 text-green-700 dark:text-green-400'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {available ? 'Spin ready' : 'Spun today'}
    </span>
  );
}

function VenueListSkeleton() {
  return (
    <ul className="space-y-3">
      {[1, 2, 3].map((i) => (
        <li key={i} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="mt-3 h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-muted" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Zap size={24} strokeWidth={1.5} className="text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground">No venues yet</p>
      <p className="mt-1 max-w-[220px] text-sm text-muted-foreground">
        Scan a QR code at a participating venue to get started.
      </p>
    </div>
  );
}
