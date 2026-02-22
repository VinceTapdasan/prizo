import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated → login
  if (!user && (pathname.startsWith('/dashboard') || pathname === '/onboarding')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Already authed → skip login page
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (user) {
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    const hasVenue = businesses && businesses.length > 0;

    // Root "/" → send authenticated users to the right place
    if (pathname === '/') {
      return NextResponse.redirect(
        new URL(hasVenue ? '/dashboard' : '/onboarding', request.url),
      );
    }

    // No venue → must complete onboarding first
    if (!hasVenue && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // Already has venue → skip onboarding
    if (hasVenue && pathname === '/onboarding') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
