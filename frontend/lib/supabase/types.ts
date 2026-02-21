export type RewardTier = 'miss' | 'common' | 'uncommon' | 'rare' | 'epic';
export type RewardStatus = 'unclaimed' | 'redeemed' | 'expired';
export type UserRole = 'business_owner' | 'customer';

export interface Profile {
  id: string;
  role: UserRole;
  created_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  type: string | null;
  location: string | null;
  reset_time: string;
  qr_active: boolean;
  points_per_scan: number;
  pity_threshold: number;
  pity_min_tier: RewardTier;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string | null;
  phone_number: string;
  created_at: string;
}

export interface CustomerBusiness {
  id: string;
  customer_id: string;
  business_id: string;
  loyalty_points: number;
  pity_counter: number;
  last_spin_at: string | null;
  created_at: string;
}

export interface Reward {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  tier: RewardTier;
  probability: number;
  stock: number | null;
  redeemed_count: number;
  is_active: boolean;
  expires_in_days: number | null;
  created_at: string;
}

export interface Spin {
  id: string;
  customer_id: string;
  business_id: string;
  reward_id: string | null;
  spun_at: string;
  created_at: string;
}

export interface CustomerReward {
  id: string;
  customer_id: string;
  business_id: string;
  reward_id: string;
  spin_id: string;
  status: RewardStatus;
  redeemed_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface MilestoneReward {
  id: string;
  business_id: string;
  points_required: number;
  reward_name: string;
  reward_description: string | null;
  is_active: boolean;
  created_at: string;
}
