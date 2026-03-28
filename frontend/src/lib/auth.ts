import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { JWT } from 'next-auth/jwt';
import { resolveServiceBaseUrl } from './utils';

const BACKEND_URL = resolveServiceBaseUrl(process.env.BACKEND_URL, 'http://localhost:8080');

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.id_token) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: account.id_token }),
          });

          if (!res.ok) {
            throw new Error(`Backend auth failed: ${res.status}`);
          }

          const data = await res.json();
          token.backendAccessToken = data.access_token;
          token.backendRefreshToken = data.refresh_token;
          token.user = data.user;
          token.accessTokenExpires = Date.now() + 14 * 60 * 1000;
          token.error = undefined;
        } catch (err) {
          console.error('[NextAuth] Backend auth error:', err);
          token.error = 'BackendAuthError';
        }
        return token;
      }

      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (token.user) {
        session.user = {
          ...session.user,
          id: token.user.id,
          tier: token.user.tier,
        };
      }
      session.backendAccessToken = token.backendAccessToken ?? '';
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token.backendRefreshToken }),
    });

    if (!res.ok) throw new Error('Refresh request failed');

    const data = await res.json();

    return {
      ...token,
      backendAccessToken: data.access_token,
      accessTokenExpires: Date.now() + 14 * 60 * 1000,
      error: undefined,
    };
  } catch (err) {
    console.error('[NextAuth] Token refresh error:', err);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}
