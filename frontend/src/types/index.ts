export type SubscriptionTier = 'free' | 'pro';
export type ReviewPriority = 'low' | 'medium' | 'high';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionCategory =
  | 'video'
  | 'music'
  | 'productivity'
  | 'learning'
  | 'shopping'
  | 'lifestyle'
  | 'utilities'
  | 'other';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  tier: SubscriptionTier;
}

export interface DashboardSummary {
  monthlyEstimate: number;
  yearlyEstimate: number;
  subscriptionCount: number;
  lockedCount: number;
  reviewCount: number;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  theme: 'light' | 'dark';
  useGoogleAvatar: boolean;
  taste: 'ossan' | 'simple';
  summary: DashboardSummary;
}

export interface TrackedSubscription {
  id: string;
  userId: string;
  name: string;
  amountYen: number;
  billingCycle: BillingCycle;
  category?: SubscriptionCategory;
  reviewPriority: ReviewPriority;
  locked: boolean;
  billingDay?: number;
  note: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: DashboardSummary;
}

export interface SubscriptionListResponse {
  data: TrackedSubscription[];
  meta: ListMeta;
}

export interface CreateTrackedSubscriptionInput {
  name: string;
  amountYen: number;
  billingCycle: BillingCycle;
  category?: SubscriptionCategory;
  reviewPriority: ReviewPriority;
  locked?: boolean;
  billingDay?: number;
  note?: string;
}

export interface UpdateTrackedSubscriptionInput {
  name?: string;
  amountYen?: number;
  billingCycle?: BillingCycle;
  category?: SubscriptionCategory;
  clearCategory?: boolean;
  reviewPriority?: ReviewPriority;
  locked?: boolean;
  billingDay?: number;
  clearBillingDay?: boolean;
  note?: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: { field: string; message: string }[];
}

import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    backendAccessToken: string;
    error?: string;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      tier: SubscriptionTier;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    backendAccessToken?: string;
    backendRefreshToken?: string;
    accessTokenExpires?: number;
    user?: User;
    error?: string;
  }
}
