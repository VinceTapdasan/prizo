'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChevronRight, Sparkles, RotateCcw, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useBusinessBySlug, useSpinStatus, useExecuteSpin } from '@/hooks/use-spins';
import { api } from '@/lib/api';
import type { SpinResult, RewardTier } from '@/lib/types';

const PHONE_KEY = 'prizo_phone';

function toPHE164(local: string): string {
  const digits = local.replace(/\D/g, '');
  if (digits.startsWith('63')) return '+' + digits;
  if (digits.startsWith('0')) return '+63' + digits.slice(1);
  return '+63' + digits;
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

type Phase =
  | 'phone-entry'
  | 'idle'
  | 'spinning'
  | 'result'
  | 'claiming'
  | 'set-password'
  | 'claimed';

// What we discovered when the user clicks "Claim reward"
type ClaimStatus =
  | 'checking'      // detecting session + account
  | 'auto-claiming' // already logged in, claiming automatically
  | 'otp-only'      // no account — OTP required, no toggle
  | 'has-account';  // has password — show password (default) + OTP option

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
  const supabase = createClient();

  const { data: business, isLoading: businessLoading } = useBusinessBySlug(params.slug);

  const [phone, setPhone] = useState<string | null>(null);
  const [localPhone, setLocalPhone] = useState('');
  const [phase, setPhase] = useState<Phase>('phone-entry');
  const [result, setResult] = useState<SpinResult | null>(null);

  // Claim state machine
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('checking');
  const [claimMethod, setClaimMethod] = useState<'otp' | 'password'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Post-OTP password setup
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const { data: spinStatus, isLoading: statusLoading } = useSpinStatus(
    business?.id,
    phone ?? undefined,
  );
  const executeSpin = useExecuteSpin(business?.id, phone ?? undefined);

  useEffect(() => {
    const stored = localStorage.getItem(PHONE_KEY);
    if (stored) {
      setPhone(stored);
      setPhase('idle');
    }
  }, []);

  function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const e164 = toPHE164(localPhone);
    localStorage.setItem(PHONE_KEY, e164);
    setPhone(e164);
    setPhase('idle');
  }

  async function handleSpin() {
    if (phase !== 'idle' || !spinStatus?.available) return;
    setPhase('spinning');
    setResult(null);

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

  function resetClaimState() {
    setClaimStatus('checking');
    setOtpSent(false);
    setOtp('');
    setPassword('');
    setClaimError(null);
  }

  function handleReset() {
    setPhase('idle');
    setResult(null);
    resetClaimState();
  }

  async function handleStartClaim() {
    if (!phone || !result?.customer_reward_id) return;

    resetClaimState();
    setPhase('claiming');

    // 1. Check if already logged in with this phone
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.phone === phone) {
      setClaimStatus('auto-claiming');
      try {
        await api.customers.redeemReward(result.customer_reward_id);
        setPhase('claimed');
      } catch (err: unknown) {
        setClaimError(err instanceof Error ? err.message : 'Failed to claim');
        setClaimStatus('otp-only');
        await doSendOtp(phone);
      }
      return;
    }

    // 2. Check if they have an account
    const { has_password } = await api.customers.checkPhone(phone);

    if (has_password) {
      setClaimStatus('has-account');
      setClaimMethod('password');
    } else {
      // No account — OTP only, auto-send
      setClaimStatus('otp-only');
      await doSendOtp(phone);
    }
  }

  async function doSendOtp(phoneNum: string) {
    setSendingOtp(true);
    setOtpSent(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: phoneNum });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleSwitchToOtp() {
    setClaimMethod('otp');
    setClaimError(null);
    setOtpSent(false);
    if (phone) await doSendOtp(phone);
  }

  async function handleOtpClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !result?.customer_reward_id) return;
    setClaimError(null);
    setVerifying(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });
      if (otpError) throw otpError;
      await api.customers.redeemReward(result.customer_reward_id);
      // After OTP claim: if no account, prompt password setup; else skip to claimed
      if (claimStatus === 'otp-only') {
        setPhase('set-password');
      } else {
        setPhase('claimed');
      }
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setVerifying(false);
    }
  }

  async function handlePasswordClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !result?.customer_reward_id) return;
    setClaimError(null);
    setVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ phone, password });
      if (error) throw error;
      await api.customers.redeemReward(result.customer_reward_id);
      setPhase('claimed');
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await api.customers.setPasswordFlag().catch(() => {});
      setPasswordSaved(true);
      setTimeout(() => setPhase('claimed'), 1200);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to save password');
    } finally {
      setSavingPassword(false);
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (businessLoading) {
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

  // ── Phase: phone entry ─────────────────────────────────────────────────────
  if (phase === 'phone-entry') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold text-foreground">{business.name}</h1>
            <p className="text-sm text-muted-foreground">Enter your number to spin</p>
          </div>
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="flex overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
              <div className="flex shrink-0 items-center gap-2 border-r border-border bg-muted px-3 py-2.5">
                <PHFlag />
                <span className="text-sm font-medium text-foreground">+63</span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                required
                placeholder="9XX XXX XXXX"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value.replace(/[^\d]/g, ''))}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={localPhone.replace(/\D/g, '').length < 9}
              className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Phase: claiming ────────────────────────────────────────────────────────
  if (phase === 'claiming') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-4">
          {/* Won reward summary */}
          {result?.reward && (
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tierColors[result.reward.tier]}`}
              >
                <Sparkles size={13} strokeWidth={2} />
                {tierLabel[result.reward.tier]}
              </span>
              <p className="mt-2 font-semibold text-foreground">{result.reward.name}</p>
              {result.expires_at && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {formatExpiry(result.expires_at)}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            {/* Checking / auto-claiming loader */}
            {(claimStatus === 'checking' || claimStatus === 'auto-claiming') && (
              <div className="flex items-center justify-center py-4 gap-2.5">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                <span className="text-sm text-muted-foreground">
                  {claimStatus === 'auto-claiming' ? 'Claiming your reward...' : 'Checking...'}
                </span>
              </div>
            )}

            {/* OTP only (no account) — no toggle */}
            {claimStatus === 'otp-only' && (
              <>
                <div>
                  <h2 className="font-medium text-foreground">Verify to claim</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Confirm it&apos;s your number to receive this reward
                  </p>
                </div>
                {sendingOtp ? (
                  <div className="flex items-center justify-center py-3 gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                    <span className="text-sm text-muted-foreground">Sending code...</span>
                  </div>
                ) : otpSent ? (
                  <form onSubmit={handleOtpClaim} className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Code sent to <span className="font-medium text-foreground">{phone}</span>
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {claimError && <ErrorMsg>{claimError}</ErrorMsg>}
                    <button
                      type="submit"
                      disabled={verifying || otp.length < 6}
                      className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      {verifying ? 'Claiming...' : 'Verify & claim'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {claimError && <ErrorMsg>{claimError}</ErrorMsg>}
                    <button
                      onClick={() => phone && doSendOtp(phone)}
                      className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
                    >
                      Resend code
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Has account — password default + OTP toggle */}
            {claimStatus === 'has-account' && (
              <>
                <div>
                  <h2 className="font-medium text-foreground">Verify to claim</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Claiming as <span className="font-medium text-foreground">{phone}</span>
                  </p>
                </div>

                {/* Method toggle */}
                <div className="flex rounded-lg border border-border p-0.5 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => { setClaimMethod('password'); setClaimError(null); }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${claimMethod === 'password' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (claimMethod !== 'otp') handleSwitchToOtp(); }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${claimMethod === 'otp' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Use OTP instead
                  </button>
                </div>

                {/* Password form */}
                {claimMethod === 'password' && (
                  <form onSubmit={handlePasswordClaim} className="space-y-3">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoFocus
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {claimError && <ErrorMsg>{claimError}</ErrorMsg>}
                    <button
                      type="submit"
                      disabled={verifying || password.length < 1}
                      className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      {verifying ? 'Claiming...' : 'Claim reward'}
                    </button>
                  </form>
                )}

                {/* OTP form (switched from password) */}
                {claimMethod === 'otp' && (
                  sendingOtp ? (
                    <div className="flex items-center justify-center py-3 gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                      <span className="text-sm text-muted-foreground">Sending code...</span>
                    </div>
                  ) : otpSent ? (
                    <form onSubmit={handleOtpClaim} className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Code sent to <span className="font-medium text-foreground">{phone}</span>
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        autoFocus
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      {claimError && <ErrorMsg>{claimError}</ErrorMsg>}
                      <button
                        type="submit"
                        disabled={verifying || otp.length < 6}
                        className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                      >
                        {verifying ? 'Claiming...' : 'Verify & claim'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      {claimError && <ErrorMsg>{claimError}</ErrorMsg>}
                      <button
                        onClick={() => phone && doSendOtp(phone)}
                        className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background hover:opacity-80"
                      >
                        Resend code
                      </button>
                    </div>
                  )
                )}
              </>
            )}

            {phase === 'claiming' && claimStatus !== 'checking' && claimStatus !== 'auto-claiming' && (
              <button
                type="button"
                onClick={() => setPhase('result')}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: set password (post-OTP, no account) ────────────────────────────
  if (phase === 'set-password') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle size={44} strokeWidth={1.5} className="text-green-500" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Reward claimed!</h2>
              {result?.reward && (
                <p className="text-sm text-muted-foreground">{result.reward.name}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            {passwordSaved ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle size={16} />
                Password saved!
              </div>
            ) : (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-medium text-foreground">
                    Set a password{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Skip OTP next time — use a password to claim faster
                  </p>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Choose a password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {passwordError && <ErrorMsg>{passwordError}</ErrorMsg>}
                <button
                  type="submit"
                  disabled={savingPassword || newPassword.length < 6}
                  className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {savingPassword ? 'Saving...' : 'Save password'}
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('claimed')}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: claimed ─────────────────────────────────────────────────────────
  if (phase === 'claimed') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 text-center">
          <CheckCircle size={52} strokeWidth={1.5} className="mx-auto text-green-500" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">Reward claimed!</h2>
            {result?.reward && (
              <p className="mt-1 text-sm text-muted-foreground">{result.reward.name}</p>
            )}
          </div>
          <button
            onClick={() => { setPhase('idle'); setResult(null); resetClaimState(); }}
            className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-80"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: idle / spinning / result ───────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-semibold text-foreground">{business.name}</span>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {spinStatus && (
            <span className="font-mono font-medium text-foreground">
              {spinStatus.loyalty_points} pts
            </span>
          )}
          <button
            onClick={() => {
              localStorage.removeItem(PHONE_KEY);
              setPhone(null);
              setPhase('phone-entry');
              setLocalPhone('');
            }}
            className="flex items-center gap-0.5 text-xs hover:text-foreground"
          >
            {phone} <ChevronRight size={12} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
        <div className="relative flex flex-col items-center gap-6">
          <SpinToken phase={phase} result={result} />

          {phase === 'result' && result && (
            <div
              className="text-center"
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
                  {result.expires_at && (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {formatExpiry(result.expires_at)} — claim before it&apos;s gone
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">Better luck next time</p>
                  {spinStatus && (
                    <p className="text-sm text-muted-foreground">
                      {spinStatus.pity_threshold - result.pity_counter} more{' '}
                      {spinStatus.pity_threshold - result.pity_counter === 1 ? 'spin' : 'spins'}{' '}
                      until guaranteed win
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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

        <div className="flex flex-col items-center gap-3">
          {phase === 'idle' && (
            <>
              {statusLoading ? (
                <div className="h-14 w-48 animate-pulse rounded-full bg-muted" />
              ) : spinStatus?.available ? (
                <button
                  onClick={handleSpin}
                  className="relative h-14 w-48 overflow-hidden rounded-full bg-foreground text-sm font-semibold text-background shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95"
                >
                  Tap to Spin
                </button>
              ) : (
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium text-foreground">Already spun today</p>
                  <p className="text-xs text-muted-foreground">
                    Come back tomorrow for your next spin
                  </p>
                </div>
              )}
              {spinStatus && spinStatus.pity_counter > 0 && spinStatus.available && (
                <PityBar
                  counter={spinStatus.pity_counter}
                  threshold={spinStatus.pity_threshold}
                />
              )}
            </>
          )}

          {phase === 'spinning' && (
            <p className="animate-pulse text-sm text-muted-foreground">Spinning...</p>
          )}

          {phase === 'result' && (
            <div className="flex flex-col items-center gap-2">
              {result?.won && result?.customer_reward_id && (
                <button
                  onClick={handleStartClaim}
                  className="flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-all hover:scale-105 active:scale-95"
                >
                  Claim reward <ChevronRight size={14} />
                </button>
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

function PHFlag() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-label="Philippine flag">
      <rect width="20" height="7" fill="#0038A8" />
      <rect y="7" width="20" height="7" fill="#CE1126" />
      <polygon points="0,0 10,7 0,14" fill="white" />
      <circle cx="4.2" cy="7" r="1.4" fill="#FCD116" />
    </svg>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>
  );
}
