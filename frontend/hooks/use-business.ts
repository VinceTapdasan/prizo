'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Business } from '@/lib/types';

export function useMyBusinesses() {
  return useQuery<Business[]>({
    queryKey: ['businesses', 'me'],
    queryFn: () => api.businesses.getOwned() as Promise<Business[]>,
  });
}

export function useMyBusiness() {
  const query = useMyBusinesses();
  return {
    ...query,
    data: query.data?.[0] ?? null,
  };
}

export function useCreateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; type?: string; location?: string }) =>
      api.businesses.create(body) as Promise<Business>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses', 'me'] }),
  });
}

export function useUpdateBusiness(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.businesses.update(id, body) as Promise<Business>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses', 'me'] }),
  });
}

export function useRegenerateQr(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.businesses.regenerateQr(id) as Promise<Business>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses', 'me'] }),
  });
}
