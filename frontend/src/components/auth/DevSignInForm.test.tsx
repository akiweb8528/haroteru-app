import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevSignInForm } from './DevSignInForm';
import { DEV_AUTH_NETWORK_ERROR } from '@/lib/auth-errors';

const mockSignIn = vi.fn();

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

describe('DevSignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('検証用認証にも安全な callbackUrl だけを渡す', async () => {
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin', url: null });
    render(<DevSignInForm callbackUrl="/.//evil.com" />);
    fireEvent.change(screen.getByPlaceholderText('検証コード'), { target: { value: 'code' } });
    fireEvent.click(screen.getByRole('button', { name: '検証用でサインイン' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('dev', {
      callbackUrl: '/subscriptions', redirect: false, verificationCode: 'code',
    }));
  });

  it('signIn が reject しても送信状態のまま固まらない', async () => {
    mockSignIn.mockRejectedValue(new Error('network error'));

    render(<DevSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('検証コード'), {
      target: { value: 'bad-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '検証用でサインイン' }));

    await waitFor(() => {
      expect(screen.getByText('ネットワークエラーで検証用サインインに失敗しました。少し待ってからもう一度お試しください。')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '検証用でサインイン' })).not.toBeDisabled();
  });

  it('url が返らない失敗でも送信状態を解除する', async () => {
    mockSignIn.mockResolvedValue({ error: undefined, url: null });

    render(<DevSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('検証コード'), {
      target: { value: 'bad-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '検証用でサインイン' }));

    await waitFor(() => {
      expect(screen.getByText('検証用サインインに失敗しました。コードを確認してください。')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '検証用でサインイン' })).not.toBeDisabled();
  });

  it('ネットワーク系エラーコードでは専用メッセージを表示する', async () => {
    mockSignIn.mockResolvedValue({ error: DEV_AUTH_NETWORK_ERROR, url: null });

    render(<DevSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('検証コード'), {
      target: { value: 'bad-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '検証用でサインイン' }));

    await waitFor(() => {
      expect(screen.getByText('ネットワークエラーで検証用サインインに失敗しました。少し待ってからもう一度お試しください。')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '検証用でサインイン' })).not.toBeDisabled();
  });
});
