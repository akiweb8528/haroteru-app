import { getSession, signOut } from 'next-auth/react';
import { resolveServiceBaseUrl } from '@/lib/utils';

const API_URL =
  typeof window !== 'undefined'
    ? resolveServiceBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:8080')
    : resolveServiceBaseUrl(process.env.BACKEND_URL, 'http://localhost:8080');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly upgradeUrl?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = await getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.backendAccessToken) {
    headers.Authorization = `Bearer ${session.backendAccessToken}`;
  }

  let res: Response;

  try {
    res = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers });
  } catch {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    throw new ApiError(
      offline ? 'オフライン中です。通信が戻ってからもう一度お試しください。' : '通信に失敗しました。時間を空けてもう一度お試しください。',
      0,
      offline ? 'offline' : 'network_error',
    );
  }

  if (res.status === 401) {
    try {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('useGoogleAvatar', 'true');
      localStorage.setItem('taste', 'ossan');
      document.documentElement.classList.remove('dark');
    } catch {}
    await signOut({ callbackUrl: '/auth/signin' });
    throw new ApiError('Session expired', 401, 'unauthorized');
  }

  if (res.status === 204) {
    return null as T;
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(
      data.message || 'An unexpected error occurred',
      res.status,
      data.error || 'unknown_error',
      data.upgrade_url,
    );
  }

  return data as T;
}
