'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Reward } from '@/lib/types';

export function useRewards(businessId: string | undefined) {
  return useQuery<Reward[]>({
    queryKey: ['rewards', businessId],
    queryFn: () => api.rewards.list(businessId!) as Promise<Reward[]>,
    enabled: !!businessId,
  });
}

export function useCreateReward(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.rewards.create(businessId, body) as Promise<Reward>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rewards', businessId] }),
  });
}

export function useUpdateReward(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.rewards.update(id, body) as Promise<Reward>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rewards', businessId] }),
  });
}

export function useDeactivateReward(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.rewards.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rewards', businessId] }),
  });
}
