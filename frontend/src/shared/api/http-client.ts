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
    public readonly definitivelyRejected = (status === 422 && code === 'validation_error') || (status === 404 && code === 'subscription_not_found'),
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiRequestOptions = RequestInit & { expectedUserId?: string };

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { expectedUserId, ...requestOptions } = options;
  const session = await getSession();
  if (expectedUserId && (session?.user?.id !== expectedUserId || !session.backendAccessToken)) {
    throw new ApiError('ログイン状態が変わりました。変更はこの端末に保存されています。', 401, 'session_changed');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.backendAccessToken) {
    headers.Authorization = `Bearer ${session.backendAccessToken}`;
  }

  const timeout = AbortSignal.timeout(15_000);
  const signal = requestOptions.signal ? AbortSignal.any([requestOptions.signal, timeout]) : timeout;
  let res: Response;

  try {
    res = await fetch(`${API_URL}/api/v1${path}`, { ...requestOptions, headers, signal });
  } catch {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    throw new ApiError(
      offline ? 'オフライン中です。通信が戻ってからもう一度お試しください。' : '通信に失敗しました。時間を空けてもう一度お試しください。',
      0,
      timeout.aborted ? 'timeout' : signal.aborted ? 'aborted' : offline ? 'offline' : 'network_error',
    );
  }

  if (res.status === 401) {
    if (expectedUserId) {
      throw new ApiError('ログイン状態を確認できませんでした。変更はこの端末に保存されています。', 401, 'unauthorized');
    }
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
      expectedUserId && path.startsWith('/sync/') && res.status === 404 && data.error !== 'subscription_not_found'
        ? '同期先の準備が整っていません。変更はこの端末に保存されています。時間を空けて再試行してください。'
        : data.message || 'An unexpected error occurred',
      res.status,
      data.error || 'unknown_error',
      data.upgrade_url,
    );
  }

  return data as T;
}
