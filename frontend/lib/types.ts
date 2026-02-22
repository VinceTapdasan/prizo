export type RewardTier = 'miss' | 'common' | 'uncommon' | 'rare' | 'epic';
export type RewardStatus = 'unclaimed' | 'redeemed' | 'expired';
export type UserRole = 'business_owner' | 'customer';

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  type: string | null;
  location: string | null;
  resetTime: string;
  qrActive: boolean;
  pointsPerScan: number;
  pityThreshold: number;
  pityMinTier: RewardTier;
  createdAt: string;
  updatedAt: string;
}

export interface Reward {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  tier: RewardTier;
  probability: string; // numeric from postgres, returned as string
  stock: number | null;
  redeemedCount: number;
  isActive: boolean;
  expiresInDays: number | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  userId: string | null;
  phoneNumber: string;
  createdAt: string;
}

export interface CustomerBusiness {
  id: string;
  customerId: string;
  businessId: string;
  loyaltyPoints: number;
  pityCounter: number;
  lastSpinAt: string | null;
  createdAt: string;
}

export interface PublicBusiness {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  location: string | null;
  qrActive: boolean;
}

export interface SpinStatus {
  available: boolean;
  pity_counter: number;
  pity_threshold: number;
  spins_until_guaranteed: number | null;
  loyalty_points: number;
}

export interface SpinResult {
  won: boolean;
  reward: {
    id: string;
    name: string;
    description: string | null;
    tier: RewardTier;
  } | null;
  customer_reward_id: string | null;
  expires_at: string | null;
  pity_triggered: boolean;
  points_earned: number;
  total_points: number;
  pity_counter: number;
}

export interface CustomerVenue {
  business_id: string;
  business_name: string;
  business_slug: string;
  business_type: string | null;
  loyalty_points: number;
  pity_counter: number;
  pity_threshold: number;
  spin_available: boolean;
  spins_until_guaranteed: number | null;
  last_spin_at: string | null;
}

export interface AdminBusiness {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  total_customers: number;
  total_spins: number;
  returning_customers: number;
  return_rate_pct: number;
  last_active: string | null;
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  actionType: string;
  details: Record<string, unknown>;
  createdAt: string;
  businessName: string;
  businessSlug: string;
  phoneNumber: string | null;
}

export interface AdminFrequency {
  total_customers: number;
  total_spins: number;
  new_customers: number;
  returning_customers: number;
  return_rate_pct: number;
  daily_spins: { date: string; count: number }[];
}

export interface BusinessCustomerReward {
  id: string;
  customerId: string;
  status: RewardStatus;
  redeemedAt: string | null;
  expiresAt: string;
  createdAt: string;
  rewardName: string;
  rewardTier: RewardTier;
}

export interface BusinessCustomer {
  id: string;
  phone_number: string;
  loyalty_points: number;
  pity_counter: number;
  last_spin_at: string | null;
  unclaimed_count: number;
  redeemed_count: number;
  expired_count: number;
  rewards: BusinessCustomerReward[];
}

export interface CustomerReward {
  id: string;
  status: RewardStatus;
  redeemedAt: string | null;
  expiresAt: string;
  createdAt: string;
  rewardName: string;
  rewardTier: RewardTier;
  rewardDescription: string | null;
}

export interface AnalyticsOverview {
  scans_today: number;
  total_customers: number;
  total_redemptions: number;
}
