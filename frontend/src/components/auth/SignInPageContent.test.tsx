// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInPageContent } from './SignInPageContent';

const mocks = vi.hoisted(() => ({ session: vi.fn(), params: vi.fn(), replace: vi.fn() }));
vi.mock('next-auth/react', () => ({ useSession: mocks.session }));
vi.mock('next/navigation', () => ({ useSearchParams: mocks.params }));
vi.mock('react', async (load) => ({ ...await load<typeof import('react')>(), useEffect: (effect: () => void) => effect() }));
vi.mock('@/components/auth/SignInButton', () => ({ SignInButton: () => null }));
vi.mock('@/components/auth/DevSignInForm', () => ({ DevSignInForm: () => null }));
vi.mock('@/components/layout/BrandLogo', () => ({ BrandLogo: () => null }));
vi.mock('@/components/navigation/OfflineAwareLink', () => ({ OfflineAwareLink: () => null }));

describe('サインイン済みの遷移', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { location: { replace: mocks.replace } });
    mocks.session.mockReturnValue({ status: 'authenticated', data: { user: { id: 'user-1' } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['/.//evil.com', '/%2e//evil.com', '//evil.com'])('callbackUrl が %s でもアプリ内に戻る', (callbackUrl) => {
    mocks.params.mockReturnValue(new URLSearchParams({ callbackUrl }));
    SignInPageContent({ devAuthEnabled: false });
    expect(mocks.replace).toHaveBeenCalledWith('/subscriptions');
  });

  it('安全な callbackUrl の query と hash を保持する', () => {
    mocks.params.mockReturnValue(new URLSearchParams({ callbackUrl: '/settings?tab=profile#avatar' }));
    SignInPageContent({ devAuthEnabled: false });
    expect(mocks.replace).toHaveBeenCalledWith('/settings?tab=profile#avatar');
  });

  it('認証に失敗したセッションでは遷移しない', () => {
    mocks.session.mockReturnValue({ status: 'authenticated', data: { error: 'BackendAuthError' } });
    mocks.params.mockReturnValue(new URLSearchParams({ callbackUrl: '/subscriptions' }));
    SignInPageContent({ devAuthEnabled: false });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
