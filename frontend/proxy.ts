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

  // Unauthenticated → protect dashboard, onboarding, link-phone
  if (!user) {
    if (
      pathname.startsWith('/dashboard') ||
      pathname === '/onboarding' ||
      pathname === '/link-phone'
    ) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // Authenticated — do the business check once
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1);

  const hasVenue = !!(businesses && businesses.length > 0);

  // Already has phone linked → skip link-phone page
  if (pathname === '/link-phone' && user.phone) {
    return NextResponse.redirect(new URL(hasVenue ? '/dashboard' : '/onboarding', request.url));
  }

  // Already authed → redirect away from login
  if (pathname === '/login') {
    if (hasVenue) return NextResponse.redirect(new URL('/dashboard', request.url));
    // Phone user with no business → customer rewards
    if (user.phone) return NextResponse.redirect(new URL('/my-venues', request.url));
    // Google user with no business or phone → link phone first
    if (!user.phone) return NextResponse.redirect(new URL('/link-phone', request.url));
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Root "/" → send to right place
  if (pathname === '/') {
    if (hasVenue) return NextResponse.redirect(new URL('/dashboard', request.url));
    if (user.phone) return NextResponse.redirect(new URL('/my-venues', request.url));
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // No venue → must complete onboarding first
  if (!hasVenue && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Already has venue → skip onboarding
  if (hasVenue && pathname === '/onboarding') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
