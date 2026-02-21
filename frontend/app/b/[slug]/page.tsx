'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MapPin, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useBusinessBySlug } from '@/hooks/use-spins';

export default function CustomerLandingPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { data: business, isLoading: businessLoading } = useBusinessBySlug(params.slug);

  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Redirect if already authenticated as customer
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.phone) {
        router.replace(`/b/${params.slug}/spin`);
      }
    });
  }, [params.slug, router, supabase.auth]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      router.push(`/b/${params.slug}/spin`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setVerifying(false);
    }
  }

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
        <p className="text-center text-muted-foreground">This venue could not be found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Business identity */}
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Store size={28} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{business.name}</h1>
          {(business.type || business.location) && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              {business.location && <MapPin size={12} strokeWidth={1.5} />}
              <span>
                {[business.type, business.location].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* Auth form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1">
                <h2 className="font-medium text-foreground">Enter your phone</h2>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll send a verification code to spin the wheel.
                </p>
              </div>
              <div className="space-y-1.5">
                <input
                  type="tel"
                  required
                  placeholder="+61 412 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">Include your country code (e.g. +61)</p>
              </div>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button
                type="submit"
                disabled={sending || !phone.trim()}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {sending ? 'Sending...' : 'Send code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1">
                <h2 className="font-medium text-foreground">Enter the code</h2>
                <p className="text-sm text-muted-foreground">
                  Sent to <span className="font-medium text-foreground">{phone}</span>
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button
                type="submit"
                disabled={verifying || otp.length < 6}
                className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {verifying ? 'Verifying...' : 'Verify & spin'}
              </button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtp(''); setError(null); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>
  );
}
