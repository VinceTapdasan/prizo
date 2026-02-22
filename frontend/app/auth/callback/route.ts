import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const role = searchParams.get('role');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Provision role via backend if this is a business owner login
      // Backend uses service role key — frontend never holds it
      if (role === 'business_owner') {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/provision`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: 'business_owner' }),
          });
        } catch {
          // Non-fatal — user can still proceed, role will be set on next login
        }
      }

      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', data.user.id)
        .limit(1);

      const hasVenue = businesses && businesses.length > 0;

      if (!hasVenue) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
