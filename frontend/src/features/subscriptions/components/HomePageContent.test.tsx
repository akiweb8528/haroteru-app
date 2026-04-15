import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HomePageContent } from './HomePageContent';

const mockUseSession = vi.fn();
const mockReplace = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock('@/components/layout/AuthenticatedAppShell', () => ({
  AuthenticatedAppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="authenticated-shell">{children}</div>,
}));

vi.mock('@/components/layout/GuestAppShell', () => ({
  GuestAppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="guest-shell">{children}</div>,
}));

vi.mock('@/features/subscriptions/components/GuestLandingHero', () => ({
  GuestLandingHero: () => <div data-testid="guest-hero" />,
}));

vi.mock('@/features/subscriptions/components/SubscriptionDashboard', () => ({
  SubscriptionDashboard: ({ isGuest }: { isGuest?: boolean }) => (
    <div data-testid={isGuest ? 'guest-dashboard' : 'dashboard'} />
  ),
}));

describe('HomePageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未認証時はゲストのホームを表示する', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<HomePageContent />);

    expect(screen.getByTestId('guest-shell')).toBeInTheDocument();
    expect(screen.getByTestId('guest-hero')).toBeInTheDocument();
    expect(screen.getByTestId('guest-dashboard')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('認証済みなら /subscriptions に置き換える', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          tier: 'free',
        },
      },
      status: 'authenticated',
    });

    render(<HomePageContent />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/subscriptions');
    });
    expect(screen.queryByTestId('guest-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});
