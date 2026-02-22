'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CustomerVenue, CustomerReward, BusinessCustomer } from '@/lib/types';

const CUSTOMER_QUERY_KEY = 'customer';

export function useMyVenues() {
  return useQuery<CustomerVenue[]>({
    queryKey: [CUSTOMER_QUERY_KEY, 'venues'],
    queryFn: () => api.customers.getVenues() as Promise<CustomerVenue[]>,
    staleTime: 30_000,
  });
}

export function useBusinessCustomers(businessId: string | undefined) {
  return useQuery<BusinessCustomer[]>({
    queryKey: [CUSTOMER_QUERY_KEY, 'business-customers', businessId],
    queryFn: () => api.customers.getForBusiness(businessId!) as Promise<BusinessCustomer[]>,
    enabled: !!businessId,
    staleTime: 30_000,
  });
}

export function useMyRewardsForBusiness(
  businessId: string | undefined,
  phone: string | undefined,
) {
  return useQuery<CustomerReward[]>({
    queryKey: [CUSTOMER_QUERY_KEY, 'rewards', businessId, phone],
    queryFn: () =>
      api.customers.getRewardsForBusiness(businessId!, phone!) as Promise<CustomerReward[]>,
    enabled: !!businessId && !!phone,
    staleTime: 15_000,
  });
}
