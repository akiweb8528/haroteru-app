import type { MeResponse } from '@/types';
import { apiRequest } from '@/shared/api/http-client';

export const userApi = {
  me(): Promise<MeResponse> {
    return apiRequest<MeResponse>('/users/me');
  },

  updatePreferences(input: { theme?: 'light' | 'dark'; useGoogleAvatar?: boolean }): Promise<MeResponse> {
    return apiRequest<MeResponse>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteAccount(): Promise<void> {
    return apiRequest<void>('/users/me', { method: 'DELETE' });
  },
};
