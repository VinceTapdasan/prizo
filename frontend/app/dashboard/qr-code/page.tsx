'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, RefreshCw } from 'lucide-react';
import { useMyBusiness, useRegenerateQr } from '@/hooks/use-business';

export default function QrCodePage() {
  const { data: business, isLoading } = useMyBusiness();
  const regenerate = useRegenerateQr(business?.id ?? '');
  const [confirming, setConfirming] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const qrUrl = business ? `${appUrl}/b/${business.slug}` : '';

  function handleDownload() {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${business?.slug ?? 'prizo'}-qr.png`;
    a.click();
  }

  async function handleRegenerate() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    await regenerate.mutateAsync();
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="h-80 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <p className="text-sm text-muted-foreground">No venue found. Please complete onboarding.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader />

      <div className="max-w-sm space-y-5 rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-center" ref={canvasRef}>
          <div className="rounded-md bg-white p-3">
            <QRCodeCanvas
              value={qrUrl}
              size={220}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
            />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Scan URL</p>
          <p className="break-all font-mono text-xs text-foreground">{qrUrl}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Download size={14} strokeWidth={1.5} />
            Download PNG
          </button>

          <button
            onClick={handleRegenerate}
            disabled={regenerate.isPending}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
              confirming
                ? 'bg-destructive text-white hover:bg-destructive/80'
                : 'border border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            <RefreshCw size={14} strokeWidth={1.5} className={regenerate.isPending ? 'animate-spin' : ''} />
            {confirming ? 'Confirm regenerate' : 'Regenerate QR'}
          </button>
        </div>

        {confirming && (
          <p className="text-xs text-muted-foreground">
            This will invalidate your current QR code. Any printed QR codes will stop working.{' '}
            <button
              onClick={() => setConfirming(false)}
              className="underline hover:text-foreground"
            >
              Cancel
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">QR Code</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Download or regenerate your venue QR code.
      </p>
    </div>
  );
}
