import { createClient } from './supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const api = {
  businesses: {
    create: (body: { name: string; type?: string; location?: string }) =>
      apiFetch('/businesses', { method: 'POST', body: JSON.stringify(body) }),
    getOwned: () => apiFetch('/businesses/me'),
    getBySlug: (slug: string) => apiFetch(`/businesses/${slug}`),
    update: (id: string, body: Record<string, unknown>) =>
      apiFetch(`/businesses/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    regenerateQr: (id: string) =>
      apiFetch(`/businesses/${id}/regenerate-qr`, { method: 'POST' }),
  },
  rewards: {
    list: (businessId: string) => apiFetch(`/businesses/${businessId}/rewards`),
    create: (businessId: string, body: Record<string, unknown>) =>
      apiFetch(`/businesses/${businessId}/rewards`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Record<string, unknown>) =>
      apiFetch(`/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deactivate: (id: string) => apiFetch(`/rewards/${id}`, { method: 'DELETE' }),
  },
  spins: {
    getStatus: (businessId: string, phone: string) =>
      apiFetch(`/businesses/${businessId}/spin-status?phone=${encodeURIComponent(phone)}`),
    execute: (businessId: string, phone: string) =>
      apiFetch(`/businesses/${businessId}/spin`, { method: 'POST', body: JSON.stringify({ phone }) }),
  },
  customers: {
    checkPhone: (phone: string) =>
      apiFetch<{ exists: boolean; has_password: boolean }>(
        `/customers/check?phone=${encodeURIComponent(phone)}`,
      ),
    setPasswordFlag: () => apiFetch('/customers/me/set-password-flag', { method: 'POST' }),
    getVenues: () => apiFetch('/customers/me/venues'),
    getAllRewards: () => apiFetch('/customers/me/rewards'),
    getRewardsForBusiness: (businessId: string, phone: string) =>
      apiFetch(
        `/businesses/${businessId}/customer-rewards?phone=${encodeURIComponent(phone)}`,
      ),
    getForBusiness: (businessId: string) =>
      apiFetch(`/businesses/${businessId}/customers`),
    redeemReward: (id: string) =>
      apiFetch(`/customer-rewards/${id}/redeem`, { method: 'POST' }),
    redeemRewardPublic: (id: string, phone: string) =>
      apiFetch(`/customer-rewards/${id}/redeem-public`, {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
  },
  admin: {
    getBusinesses: () => apiFetch('/admin/businesses'),
    getActivityLogs: (limit?: number) =>
      apiFetch(`/admin/activity-logs${limit ? `?limit=${limit}` : ''}`),
    getFrequency: (businessId: string) =>
      apiFetch(`/admin/businesses/${businessId}/frequency`),
  },
  analytics: {
    getOverview: (businessId: string) =>
      apiFetch(`/businesses/${businessId}/analytics`),
  },
};
