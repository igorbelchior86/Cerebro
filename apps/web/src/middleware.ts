// ─────────────────────────────────────────────────────────────
// Next.js Edge Middleware — route guard & i18n
// Runs on every request BEFORE rendering.
// Redirects to /login when no valid session cookie is present.
// Routes to proper locale using next-intl.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

// Routes that do NOT require auth
const PUBLIC_PATHS = ['/login', '/register', '/accept-invite'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bypass auth and i18n for Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logos') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Determine if the current path is public
  const isPublicPath = PUBLIC_PATHS.some((p) =>
    pathname === p ||
    pathname.startsWith(`${p}/`) ||
    routing.locales.some(loc => pathname === `/${loc}${p}` || pathname.startsWith(`/${loc}${p}/`))
  );

  const token = req.cookies.get('pb_session')?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const { payload } = await jwtVerify(
          token,
          new TextEncoder().encode(secret),
        );
        // Only allow full sessions (not mfa-pending)
        if ((payload as any).scope === 'full') {
          isAuthenticated = true;
        }
      }
    } catch {
      // Token invalid
    }
  }

  if (!isPublicPath && !isAuthenticated) {
    // Redirect unauthenticated users to login page
    // Using i18n logic: redirect to the locale login
    const isPt = pathname.startsWith('/pt');
    const loginPath = isPt ? '/pt/login' : '/en/login';
    const loginUrl = new URL(loginPath, req.url);
    loginUrl.searchParams.set('next', req.nextUrl.pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('pb_session');
    return response;
  }

  // 2. Run i18n middleware for standard locale negotiation & redirection
  return handleI18nRouting(req);
}

export const config = {
  // Run on all paths except API routes and static assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
