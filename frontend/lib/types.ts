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
  pity_triggered: boolean;
  points_earned: number;
  total_points: number;
  pity_counter: number;
}
