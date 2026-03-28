import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    if (!token) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    if (token.error === 'RefreshAccessTokenError') {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('error', 'SessionExpired');
      return NextResponse.redirect(signInUrl);
    }

    if (token.error === 'BackendAuthError') {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('error', 'BackendAuthError');
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true,
    },
  },
);

export const config = {
  matcher: ['/subscriptions/:path*', '/settings/:path*', '/settings'],
};
