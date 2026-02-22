'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const PHONE_KEY = 'prizo_phone';
const OTP_ENABLED = process.env.NEXT_PUBLIC_OTP_ENABLED !== '0';

function toPHE164(local: string): string {
  const digits = local.replace(/\D/g, '');
  if (digits.startsWith('63')) return '+' + digits;
  if (digits.startsWith('0')) return '+63' + digits.slice(1);
  return '+63' + digits;
}

// Phases:
// phone      → user enters number
// checking   → detecting if account exists
// otp-send   → sending OTP (no account, or user chose OTP)
// otp-verify → verifying OTP code
// password   → password login (has account, default)
// set-pass   → post-OTP password setup (new user or no password yet)
type Phase = 'phone' | 'checking' | 'otp-send' | 'otp-verify' | 'password' | 'set-pass';

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>('phone');
  const [localPhone, setLocalPhone] = useState('');
  const [e164Phone, setE164Phone] = useState('');
  const [hasExistingPassword, setHasExistingPassword] = useState(false);

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savePasswordError, setSavePasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.phone) router.replace('/my-venues');
    });
  }, [router, supabase.auth]);

  useEffect(() => {
    const stored = localStorage.getItem(PHONE_KEY);
    if (stored) {
      const local = stored.startsWith('+63') ? stored.slice(3) : stored;
      setLocalPhone(local);
    }
  }, []);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const phone = toPHE164(localPhone);
    setE164Phone(phone);

    if (!OTP_ENABLED) {
      localStorage.setItem(PHONE_KEY, phone);
      router.replace('/my-venues');
      return;
    }

    setPhase('checking');

    try {
      const { has_password } = await api.customers.checkPhone(phone);
      setHasExistingPassword(has_password);

      if (has_password) {
        // Has account → show password by default
        setPhase('password');
      } else {
        // No account or no password → OTP first
        await sendOtp(phone);
      }
    } catch (err: unknown) {
      setPhase('phone');
      toast.error(err instanceof Error ? err.message : 'Could not reach server. Try again.');
    }
  }

  async function sendOtp(phone: string) {
    setPhase('otp-send');
    setSendingOtp(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      localStorage.setItem(PHONE_KEY, phone);
      setPhase('otp-verify');
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : 'Failed to send code');
      setPhase('otp-verify');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setVerifyingOtp(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: e164Phone,
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      // OTP verified → if no password yet, prompt setup; otherwise go to account
      if (hasExistingPassword) {
        router.replace('/my-venues');
      } else {
        setPhase('set-pass');
      }
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        phone: e164Phone,
        password,
      });
      if (error) throw error;
      router.replace('/my-venues');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setSavePasswordError(null);
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      // Mark in DB
      await api.customers.setPasswordFlag().catch(() => {});
      setPasswordSaved(true);
      setTimeout(() => router.replace('/my-venues'), 1200);
    } catch (err: unknown) {
      setSavePasswordError(err instanceof Error ? err.message : 'Failed to save password');
    } finally {
      setSavingPassword(false);
    }
  }

  // ── Checking ───────────────────────────────────────────────────────────────
  if (phase === 'checking' || phase === 'otp-send') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="text-sm text-muted-foreground">
            {phase === 'checking' ? 'Checking account...' : 'Sending code...'}
          </p>
        </div>
      </PageShell>
    );
  }

  // ── Phone entry ────────────────────────────────────────────────────────────
  if (phase === 'phone') {
    return (
      <PageShell>
        <div className="space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">My account</h1>
            <p className="text-sm text-muted-foreground">
              View your rewards and loyalty points across all venues
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
                disabled={localPhone.replace(/\D/g, '').length < 9}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                Continue
              </button>
            </form>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── OTP verify ─────────────────────────────────────────────────────────────
  if (phase === 'otp-verify') {
    return (
      <PageShell>
        <div className="space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Enter the code</h1>
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
                disabled={verifyingOtp || otp.length < 6}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {verifyingOtp ? 'Verifying...' : 'Verify'}
              </button>
            </form>
            <div className="mt-3 border-t border-border pt-3 space-y-2">
              <button
                type="button"
                onClick={() => sendOtp(e164Phone)}
                disabled={sendingOtp}
                className="w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setPhase('phone'); setOtp(''); setOtpError(null); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different number
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Password login (has account) ───────────────────────────────────────────
  if (phase === 'password') {
    return (
      <PageShell>
        <div className="space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Signing in as <span className="font-medium text-foreground">{e164Phone}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Your password"
                  autoFocus
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
              {passwordError && <ErrorMsg>{passwordError}</ErrorMsg>}
              <button
                type="submit"
                disabled={loggingIn || password.length < 1}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {loggingIn ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <div className="mt-3 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => { setHasExistingPassword(false); sendOtp(e164Phone); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Use OTP instead
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Set password (post-OTP, new users only) ────────────────────────────────
  if (phase === 'set-pass') {
    return (
      <PageShell>
        <div className="space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Set a password</h1>
            <p className="text-sm text-muted-foreground">
              Skip OTP next time — use a password to sign in faster.
            </p>
            <p className="text-xs text-muted-foreground">Optional. You can always use OTP.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            {passwordSaved ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle size={16} />
                Password saved — taking you to your account...
              </div>
            ) : (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Choose a password (min 6 chars)"
                    autoFocus
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
                {savePasswordError && <ErrorMsg>{savePasswordError}</ErrorMsg>}
                <button
                  type="submit"
                  disabled={savingPassword || newPassword.length < 6}
                  className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {savingPassword ? 'Saving...' : 'Save password'}
                </button>
                <button
                  type="button"
                  onClick={() => router.replace('/my-venues')}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </button>
              </form>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  return null;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
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
