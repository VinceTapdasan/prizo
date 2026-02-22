'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function BusinessLandingPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/b/${params.slug}/spin`);
  }, [params.slug, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
    </div>
  );
}
