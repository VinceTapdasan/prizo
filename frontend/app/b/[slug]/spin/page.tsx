'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Sparkles, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useBusinessBySlug, useSpinStatus, useExecuteSpin } from '@/hooks/use-spins';
import type { SpinResult, RewardTier } from '@/lib/types';

type Phase = 'idle' | 'spinning' | 'result';

const tierGlow: Record<RewardTier, string> = {
  miss: 'shadow-[0_0_40px_8px_oklch(0.5_0_0_/_0.15)]',
  common: 'shadow-[0_0_40px_8px_oklch(0.6_0.15_145_/_0.3)]',
  uncommon: 'shadow-[0_0_40px_8px_oklch(0.6_0.15_240_/_0.3)]',
  rare: 'shadow-[0_0_40px_8px_oklch(0.6_0.15_300_/_0.35)]',
  epic: 'shadow-[0_0_40px_8px_oklch(0.75_0.15_75_/_0.4)]',
};

const tierLabel: Record<RewardTier, string> = {
  miss: 'Miss',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
};

const tierColors: Record<RewardTier, string> = {
  miss: 'bg-muted text-muted-foreground',
  common: 'bg-green-500/15 text-green-700 dark:text-green-400',
  uncommon: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  rare: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  epic: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

export default function SpinPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = createClient();

  const { data: business, isLoading: businessLoading } = useBusinessBySlug(params.slug);
  const { data: spinStatus, isLoading: statusLoading } = useSpinStatus(business?.id);
  const executeSpin = useExecuteSpin(business?.id);

  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<SpinResult | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.phone) {
        router.replace(`/b/${params.slug}`);
      } else {
        setAuthChecked(true);
      }
    });
  }, [params.slug, router, supabase.auth]);

  async function handleSpin() {
    if (phase !== 'idle' || !spinStatus?.available) return;
    setPhase('spinning');
    setResult(null);

    // Min spin animation time for UX
    const [spinResult] = await Promise.allSettled([
      executeSpin.mutateAsync(),
      new Promise((resolve) => setTimeout(resolve, 2200)),
    ]);

    if (spinResult.status === 'fulfilled') {
      setResult(spinResult.value);
      setPhase('result');
    } else {
      setPhase('idle');
    }
  }

  function handleReset() {
    setPhase('idle');
    setResult(null);
  }

  if (!authChecked || businessLoading || statusLoading) {
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

  const resultTier = result?.reward?.tier ?? 'miss';

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-semibold text-foreground">{business.name}</span>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {spinStatus && (
            <span className="font-mono font-medium text-foreground">
              {spinStatus.loyalty_points} pts
            </span>
          )}
          <Link
            href={`/b/${params.slug}/rewards`}
            className="flex items-center gap-0.5 text-xs hover:text-foreground"
          >
            Rewards <ChevronRight size={12} />
          </Link>
        </div>
      </header>

      {/* Main spin area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">

        {/* Spin token */}
        <div className="relative flex flex-col items-center gap-6">
          <SpinToken phase={phase} result={result} />

          {/* Result card */}
          {phase === 'result' && result && (
            <div
              className="animate-result-pop text-center"
              style={{ animation: 'result-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              {result.won && result.reward ? (
                <div className="space-y-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tierColors[result.reward.tier]}`}
                  >
                    <Sparkles size={13} strokeWidth={2} />
                    {tierLabel[result.reward.tier]}
                    {result.pity_triggered && ' (Guaranteed!)'}
                  </span>
                  <p className="text-lg font-semibold text-foreground">{result.reward.name}</p>
                  {result.reward.description && (
                    <p className="text-sm text-muted-foreground">{result.reward.description}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">Better luck next time</p>
                  {spinStatus && (
                    <p className="text-sm text-muted-foreground">
                      {spinStatus.pity_threshold - result.pity_counter} more{' '}
                      {spinStatus.pity_threshold - result.pity_counter === 1 ? 'spin' : 'spins'} until
                      guaranteed win
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Points earned */}
          {phase === 'result' && result && (
            <div
              className="flex items-center gap-2 text-sm"
              style={{ animation: 'result-pop 0.4s 0.15s cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              <span className="font-mono font-semibold text-foreground">
                +{result.points_earned} pts
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{result.total_points} total</span>
            </div>
          )}
        </div>

        {/* Spin button / status */}
        <div className="flex flex-col items-center gap-3">
          {phase === 'idle' && (
            <>
              {spinStatus?.available ? (
                <button
                  onClick={handleSpin}
                  className="relative h-14 w-48 overflow-hidden rounded-full bg-foreground text-sm font-semibold text-background shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95"
                >
                  Tap to Spin
                </button>
              ) : (
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium text-foreground">Already spun today</p>
                  <p className="text-xs text-muted-foreground">Come back tomorrow for your next spin</p>
                </div>
              )}

              {/* Pity progress */}
              {spinStatus && spinStatus.pity_counter > 0 && spinStatus.available && (
                <PityBar counter={spinStatus.pity_counter} threshold={spinStatus.pity_threshold} />
              )}
            </>
          )}

          {phase === 'spinning' && (
            <p className="animate-pulse text-sm text-muted-foreground">Spinning...</p>
          )}

          {phase === 'result' && (
            <div className="flex flex-col items-center gap-2">
              {result?.won && (
                <Link
                  href={`/b/${params.slug}/rewards`}
                  className="flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-all hover:scale-105 active:scale-95"
                >
                  View my rewards <ChevronRight size={14} />
                </Link>
              )}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={13} strokeWidth={1.5} />
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpinToken({ phase, result }: { phase: Phase; result: SpinResult | null }) {
  const size = 'h-52 w-52';
  const tier = result?.reward?.tier ?? 'miss';
  const glow = phase === 'result' ? tierGlow[tier] : '';

  return (
    <div
      className={`${size} rounded-full border-2 border-border bg-card transition-shadow duration-700 ${glow} flex items-center justify-center`}
      style={{
        animation:
          phase === 'spinning'
            ? 'spin-token 0.6s ease-in-out infinite'
            : phase === 'result'
              ? 'result-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'
              : phase === 'idle'
                ? 'token-idle 3s ease-in-out infinite'
                : undefined,
        perspective: '800px',
      }}
    >
      {phase === 'idle' && (
        <span className="select-none font-mono text-5xl font-bold text-muted-foreground/40">?</span>
      )}
      {phase === 'spinning' && (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      )}
      {phase === 'result' && result && (
        <div className="flex flex-col items-center gap-1 p-4 text-center">
          {result.won && result.reward ? (
            <>
              <Sparkles
                size={32}
                strokeWidth={1.5}
                className={
                  tier === 'epic'
                    ? 'text-amber-500'
                    : tier === 'rare'
                      ? 'text-purple-500'
                      : tier === 'uncommon'
                        ? 'text-blue-500'
                        : 'text-green-500'
                }
              />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {tierLabel[tier]}
              </span>
            </>
          ) : (
            <span className="text-4xl font-bold text-muted-foreground/30">—</span>
          )}
        </div>
      )}
    </div>
  );
}

function PityBar({ counter, threshold }: { counter: number; threshold: number }) {
  const pct = Math.min((counter / threshold) * 100, 100);
  return (
    <div className="w-48 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Pity</span>
        <span>{counter}/{threshold}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
