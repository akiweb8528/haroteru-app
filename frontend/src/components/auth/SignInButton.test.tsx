import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInButton } from './SignInButton';

const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn }));
vi.mock('@/components/navigation/OfflineAwareLink', () => ({ OfflineAwareLink: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));

describe('Google サインインの callbackUrl', () => {
  beforeEach(() => vi.clearAllMocks());
  it('直接呼び出しても正規化後の危険なパスを渡さない', () => {
    render(<SignInButton callbackUrl="/.//evil.com" />);
    fireEvent.click(screen.getByRole('button'));
    expect(mocks.signIn).toHaveBeenCalledWith('google', { callbackUrl: '/subscriptions' });
  });
  it('compact 導線でもアプリ内の戻り先だけを渡す', () => {
    render(<SignInButton callbackUrl="/.//evil.com" compact />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/auth/signin?callbackUrl=%2Fsubscriptions');
  });
});
