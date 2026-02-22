'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminBusiness, AdminActivityLog, AdminFrequency } from '@/lib/types';

const ADMIN_KEY = 'admin';

export function useAdminBusinesses(enabled = true) {
  return useQuery<AdminBusiness[]>({
    queryKey: [ADMIN_KEY, 'businesses'],
    queryFn: () => api.admin.getBusinesses() as Promise<AdminBusiness[]>,
    enabled,
    staleTime: 60_000,
  });
}

export function useAdminActivityLogs(limit = 50, enabled = true) {
  return useQuery<AdminActivityLog[]>({
    queryKey: [ADMIN_KEY, 'activity-logs', limit],
    queryFn: () => api.admin.getActivityLogs(limit) as Promise<AdminActivityLog[]>,
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminFrequency(businessId: string | null) {
  return useQuery<AdminFrequency>({
    queryKey: [ADMIN_KEY, 'frequency', businessId],
    queryFn: () => api.admin.getFrequency(businessId!) as Promise<AdminFrequency>,
    enabled: !!businessId,
    staleTime: 60_000,
  });
}
