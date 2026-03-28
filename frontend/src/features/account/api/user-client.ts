import type { MeResponse } from '@/types';
import { apiRequest } from '@/shared/api/http-client';
import type { CopyTaste } from '@/lib/taste';

export const userApi = {
  me(): Promise<MeResponse> {
    return apiRequest<MeResponse>('/users/me');
  },

  updatePreferences(input: { theme?: 'light' | 'dark'; useGoogleAvatar?: boolean; taste?: CopyTaste }): Promise<MeResponse> {
    return apiRequest<MeResponse>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteAccount(): Promise<void> {
    return apiRequest<void>('/users/me', { method: 'DELETE' });
  },
};
