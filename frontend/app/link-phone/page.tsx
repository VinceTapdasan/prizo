'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const PHONE_KEY = 'prizo_phone';
const OTP_ENABLED = process.env.NEXT_PUBLIC_OTP_ENABLED !== '0';

function toPHE164(local: string): string {
  const digits = local.replace(/\D/g, '');
  if (digits.startsWith('63')) return '+' + digits;
  if (digits.startsWith('0')) return '+63' + digits.slice(1);
  return '+63' + digits;
}

type Phase = 'phone' | 'sending' | 'otp' | 'done';

export default function LinkPhonePage() {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>('phone');
  const [localPhone, setLocalPhone] = useState('');
  const [e164Phone, setE164Phone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const phone = toPHE164(localPhone);
    setE164Phone(phone);

    if (!OTP_ENABLED) {
      localStorage.setItem(PHONE_KEY, phone);
      setPhase('done');
      setTimeout(() => router.replace('/dashboard'), 1200);
      return;
    }

    setPhase('sending');
    setSendingOtp(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone });
      if (error) throw error;
      localStorage.setItem(PHONE_KEY, phone);
      setPhase('otp');
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : 'Failed to send code');
      setPhase('otp');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: e164Phone,
        token: otp,
        type: 'phone_change',
      });
      if (error) throw error;
      setPhase('done');
      setTimeout(() => router.replace('/dashboard'), 1200);
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setVerifying(false);
    }
  }

  if (phase === 'sending') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="text-sm text-muted-foreground">Sending code...</p>
        </div>
      </Shell>
    );
  }

  if (phase === 'done') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10 text-green-600 dark:text-green-400">
          <CheckCircle size={32} />
          <p className="text-sm font-medium">Phone linked — taking you to your dashboard...</p>
        </div>
      </Shell>
    );
  }

  if (phase === 'otp') {
    return (
      <Shell>
        <div className="space-y-8">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">Prizo</p>
            <h1 className="text-2xl font-semibold text-foreground">Verify your number</h1>
            <p className="text-sm text-muted-foreground">
              Sent to <span className="font-medium text-foreground">{e164Phone}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                placeholder="000000"
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {otpError && <ErrorMsg>{otpError}</ErrorMsg>}
              <button
                type="submit"
                disabled={verifying || otp.length < 6}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
            </form>
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => { setPhase('phone'); setOtp(''); setOtpError(null); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different number
              </button>
              <button
                type="button"
                onClick={() => router.replace('/dashboard')}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">Prizo</p>
          <h1 className="text-2xl font-semibold text-foreground">Link your phone</h1>
          <p className="text-sm text-muted-foreground">
            Add a phone number to access your loyalty rewards and spin history.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Phone number</label>
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
            </div>
            <button
              type="submit"
              disabled={sendingOtp || localPhone.replace(/\D/g, '').length < 9}
              className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              Send code
            </button>
          </form>
          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => router.replace('/dashboard')}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">{children}</div>
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
