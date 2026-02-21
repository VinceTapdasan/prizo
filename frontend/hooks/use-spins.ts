'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PublicBusiness, SpinStatus, SpinResult } from '@/lib/types';

export function useBusinessBySlug(slug: string) {
  return useQuery<PublicBusiness>({
    queryKey: ['business-public', slug],
    queryFn: () => api.businesses.getBySlug(slug) as Promise<PublicBusiness>,
    enabled: !!slug,
  });
}

export function useSpinStatus(businessId: string | undefined) {
  return useQuery<SpinStatus>({
    queryKey: ['spin-status', businessId],
    queryFn: () => api.spins.getStatus(businessId!) as Promise<SpinStatus>,
    enabled: !!businessId,
    refetchOnWindowFocus: false,
  });
}

export function useExecuteSpin(businessId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.spins.execute(businessId!) as Promise<SpinResult>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spin-status', businessId] });
    },
  });
}
