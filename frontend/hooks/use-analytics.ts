'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AnalyticsOverview } from '@/lib/types';

const ANALYTICS_QUERY_KEY = 'analytics';

export function useAnalyticsOverview(businessId: string | undefined) {
  return useQuery<AnalyticsOverview>({
    queryKey: [ANALYTICS_QUERY_KEY, 'overview', businessId],
    queryFn: () => api.analytics.getOverview(businessId!) as Promise<AnalyticsOverview>,
    enabled: !!businessId,
    staleTime: 60_000, // 1 min — analytics don't need to be real-time
  });
}
