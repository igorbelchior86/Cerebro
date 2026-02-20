// ─────────────────────────────────────────────────────────────
// Next.js Edge Middleware — route guard
// Runs on every request BEFORE rendering.
// Redirects to /login when no valid session cookie is present.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that do NOT require auth
const PUBLIC_PATHS = ['/login', '/register', '/accept-invite'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logos') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('pb_session')?.value;

  if (!token) {
    return redirectToLogin(req);
  }

  try {
    const secret = process.env.JWT_SECRET;
    console.log('[middleware] Path:', pathname, 'Secret set:', !!secret);
    if (!secret) {
      console.error('[middleware] JWT_SECRET not set. Env keys:', Object.keys(process.env).filter(k => k.includes('JWT') || k.includes('SECRET')));
      return redirectToLogin(req);
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );

    // Only allow full sessions (not mfa-pending)
    if ((payload as any).scope !== 'full') {
      return redirectToLogin(req);
    }

    return NextResponse.next();
  } catch {
    // Token invalid or expired — clear cookie and redirect
    const response = redirectToLogin(req);
    response.cookies.delete('pb_session');
    return response;
  }
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on all paths except API routes and static assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
