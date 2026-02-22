'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const PHONE_KEY = 'prizo_phone';

function toPHE164(local: string): string {
  const digits = local.replace(/\D/g, '');
  if (digits.startsWith('63')) return '+' + digits;
  if (digits.startsWith('0')) return '+63' + digits.slice(1);
  return '+63' + digits;
}

type Phase = 'phone' | 'checking' | 'otp-send' | 'otp-verify' | 'password' | 'set-pass';

export default function LoginPage() {
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

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) redirectAfterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redirectAfterAuth() {
    try {
      const businesses = (await api.businesses.getOwned()) as { id: string }[];
      if (businesses && businesses.length > 0) {
        router.replace('/dashboard');
      } else {
        router.replace('/my-venues');
      }
    } catch {
      // Fall back to customer view if business check fails
      router.replace('/my-venues');
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const phone = toPHE164(localPhone);
    setE164Phone(phone);
    setPhase('checking');
    try {
      const { has_password } = await api.customers.checkPhone(phone);
      setHasExistingPassword(has_password);
      if (has_password) {
        setPhase('password');
      } else {
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
      if (hasExistingPassword) {
        await redirectAfterAuth();
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
      await redirectAfterAuth();
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
      await api.customers.setPasswordFlag().catch(() => {});
      setPasswordSaved(true);
      setTimeout(() => redirectAfterAuth(), 1200);
    } catch (err: unknown) {
      setSavePasswordError(err instanceof Error ? err.message : 'Failed to save password');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleError(null);
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?role=business_owner`,
      },
    });
    if (error) {
      setGoogleError(error.message);
      setGoogleLoading(false);
    }
  }

  if (phase === 'checking' || phase === 'otp-send') {
    return (
      <div className="w-full max-w-sm space-y-8">
        <PageHeader />
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="text-sm text-muted-foreground">
            {phase === 'checking' ? 'Checking account...' : 'Sending code...'}
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'phone') {
    return (
      <div className="w-full max-w-sm space-y-8">
        <PageHeader />
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

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {googleError && <ErrorMsg>{googleError}</ErrorMsg>}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'otp-verify') {
    return (
      <div className="w-full max-w-sm space-y-8">
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
          <div className="mt-3 space-y-2 border-t border-border pt-3">
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
              onClick={() => {
                setPhase('phone');
                setOtp('');
                setOtpError(null);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Use a different number
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'password') {
    return (
      <div className="w-full max-w-sm space-y-8">
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
              onClick={() => {
                setHasExistingPassword(false);
                sendOtp(e164Phone);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Use OTP instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'set-pass') {
    return (
      <div className="w-full max-w-sm space-y-8">
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
              Password saved — signing you in...
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
                onClick={() => redirectAfterAuth()}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function PageHeader() {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-primary">Prizo</p>
      <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Manage your venue, or check your loyalty rewards.
      </p>
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>
  );
}
