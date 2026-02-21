import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import * as schema from '../db/schema';

@Injectable()
export class CustomersService {
  constructor(private readonly drizzle: DrizzleService) {}

  async findOrCreateByPhone(phone: string, userId?: string) {
    const [existing] = await this.drizzle.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.phoneNumber, phone))
      .limit(1);

    if (existing) return existing;

    const [created] = await this.drizzle.db
      .insert(schema.customers)
      .values({ phoneNumber: phone, userId: userId ?? null })
      .returning();

    return created;
  }

  async getLoyaltyForBusiness(customerId: string, businessId: string) {
    const [cb] = await this.drizzle.db
      .select({
        loyaltyPoints: schema.customerBusiness.loyaltyPoints,
        pityCounter: schema.customerBusiness.pityCounter,
        lastSpinAt: schema.customerBusiness.lastSpinAt,
      })
      .from(schema.customerBusiness)
      .where(
        and(
          eq(schema.customerBusiness.customerId, customerId),
          eq(schema.customerBusiness.businessId, businessId),
        ),
      )
      .limit(1);

    const rewards = await this.drizzle.db
      .select({
        id: schema.customerRewards.id,
        status: schema.customerRewards.status,
        redeemedAt: schema.customerRewards.redeemedAt,
        expiresAt: schema.customerRewards.expiresAt,
        createdAt: schema.customerRewards.createdAt,
        rewardName: schema.rewards.name,
        rewardTier: schema.rewards.tier,
        rewardDescription: schema.rewards.description,
      })
      .from(schema.customerRewards)
      .innerJoin(schema.rewards, eq(schema.customerRewards.rewardId, schema.rewards.id))
      .where(
        and(
          eq(schema.customerRewards.customerId, customerId),
          eq(schema.customerRewards.businessId, businessId),
        ),
      )
      .orderBy(desc(schema.customerRewards.createdAt));

    return {
      loyalty_points: cb?.loyaltyPoints ?? 0,
      pity_counter: cb?.pityCounter ?? 0,
      last_spin_at: cb?.lastSpinAt ?? null,
      rewards,
    };
  }

  async getAllRewards(customerId: string) {
    return this.drizzle.db
      .select({
        id: schema.customerRewards.id,
        status: schema.customerRewards.status,
        redeemedAt: schema.customerRewards.redeemedAt,
        expiresAt: schema.customerRewards.expiresAt,
        createdAt: schema.customerRewards.createdAt,
        rewardName: schema.rewards.name,
        rewardTier: schema.rewards.tier,
        rewardDescription: schema.rewards.description,
        businessName: schema.businesses.name,
        businessSlug: schema.businesses.slug,
      })
      .from(schema.customerRewards)
      .innerJoin(schema.rewards, eq(schema.customerRewards.rewardId, schema.rewards.id))
      .innerJoin(schema.businesses, eq(schema.customerRewards.businessId, schema.businesses.id))
      .where(eq(schema.customerRewards.customerId, customerId))
      .orderBy(desc(schema.customerRewards.createdAt));
  }

  async redeemReward(rewardId: string, customerId: string) {
    const [reward] = await this.drizzle.db
      .select()
      .from(schema.customerRewards)
      .where(
        and(
          eq(schema.customerRewards.id, rewardId),
          eq(schema.customerRewards.customerId, customerId),
          eq(schema.customerRewards.status, 'unclaimed'),
        ),
      )
      .limit(1);

    if (!reward) throw new NotFoundException('Reward not found or already redeemed');

    if (new Date(reward.expiresAt) < new Date()) {
      await this.drizzle.db
        .update(schema.customerRewards)
        .set({ status: 'expired' })
        .where(eq(schema.customerRewards.id, rewardId));
      throw new NotFoundException('Reward has expired');
    }

    const [updated] = await this.drizzle.db
      .update(schema.customerRewards)
      .set({ status: 'redeemed', redeemedAt: new Date().toISOString() })
      .where(eq(schema.customerRewards.id, rewardId))
      .returning();

    return updated;
  }

  async getCustomersForBusiness(businessId: string) {
    return this.drizzle.db
      .select({
        id: schema.customerBusiness.id,
        loyaltyPoints: schema.customerBusiness.loyaltyPoints,
        pityCounter: schema.customerBusiness.pityCounter,
        lastSpinAt: schema.customerBusiness.lastSpinAt,
        createdAt: schema.customerBusiness.createdAt,
        phoneNumber: schema.customers.phoneNumber,
        customerCreatedAt: schema.customers.createdAt,
      })
      .from(schema.customerBusiness)
      .innerJoin(schema.customers, eq(schema.customerBusiness.customerId, schema.customers.id))
      .where(eq(schema.customerBusiness.businessId, businessId))
      .orderBy(desc(schema.customerBusiness.loyaltyPoints));
  }
}
