import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, desc, lt } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import * as schema from '../db/schema';

@Injectable()
export class CustomersService {
  constructor(private readonly drizzle: DrizzleService) {}

  async checkPhone(phone: string): Promise<{ exists: boolean; has_password: boolean }> {
    const [customer] = await this.drizzle.db
      .select({ id: schema.customers.id, hasPassword: schema.customers.hasPassword })
      .from(schema.customers)
      .where(eq(schema.customers.phoneNumber, phone))
      .limit(1);
    return { exists: !!customer, has_password: customer?.hasPassword ?? false };
  }

  async setPasswordFlag(phone: string): Promise<void> {
    await this.drizzle.db
      .update(schema.customers)
      .set({ hasPassword: true })
      .where(eq(schema.customers.phoneNumber, phone));
  }

  async findOrCreateByPhone(phone: string, userId?: string) {
    const [existing] = await this.drizzle.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.phoneNumber, phone))
      .limit(1);

    if (existing) {
      if (userId && !existing.userId) {
        const [updated] = await this.drizzle.db
          .update(schema.customers)
          .set({ userId })
          .where(eq(schema.customers.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }

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

  async getVenuesForCustomer(userId: string) {
    const rows = await this.drizzle.db
      .select({
        businessId: schema.businesses.id,
        businessName: schema.businesses.name,
        businessSlug: schema.businesses.slug,
        businessType: schema.businesses.type,
        loyaltyPoints: schema.customerBusiness.loyaltyPoints,
        pityCounter: schema.customerBusiness.pityCounter,
        pityThreshold: schema.businesses.pityThreshold,
        lastSpinAt: schema.customerBusiness.lastSpinAt,
        resetTime: schema.businesses.resetTime,
      })
      .from(schema.customerBusiness)
      .innerJoin(schema.customers, eq(schema.customerBusiness.customerId, schema.customers.id))
      .innerJoin(schema.businesses, eq(schema.customerBusiness.businessId, schema.businesses.id))
      .where(eq(schema.customers.userId, userId))
      .orderBy(desc(schema.customerBusiness.lastSpinAt));

    return rows.map((row) => {
      const spinAvailable = this.isSpinAvailable(row.lastSpinAt, row.resetTime);
      const spinsUntilGuaranteed = spinAvailable
        ? Math.max(0, row.pityThreshold - row.pityCounter)
        : null;
      return {
        business_id: row.businessId,
        business_name: row.businessName,
        business_slug: row.businessSlug,
        business_type: row.businessType,
        loyalty_points: row.loyaltyPoints,
        pity_counter: row.pityCounter,
        pity_threshold: row.pityThreshold,
        spin_available: spinAvailable,
        spins_until_guaranteed: spinsUntilGuaranteed,
        last_spin_at: row.lastSpinAt,
      };
    });
  }

  private isSpinAvailable(lastSpinAt: string | null, resetTime: string): boolean {
    if (!lastSpinAt) return true;
    const now = new Date();
    const last = new Date(lastSpinAt);
    const [hours, minutes] = resetTime.split(':').map(Number);
    const reset = new Date(now);
    reset.setHours(hours, minutes, 0, 0);
    if (now < reset) reset.setDate(reset.getDate() - 1);
    return last < reset;
  }

  async getRewardsForBusiness(customerId: string, businessId: string) {
    const now = new Date().toISOString();
    await this.drizzle.db
      .update(schema.customerRewards)
      .set({ status: 'expired' })
      .where(
        and(
          eq(schema.customerRewards.customerId, customerId),
          eq(schema.customerRewards.businessId, businessId),
          eq(schema.customerRewards.status, 'unclaimed'),
          lt(schema.customerRewards.expiresAt, now),
        ),
      );

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
  }

  async getCustomersWithRewardsForBusiness(businessId: string, ownerId: string) {
    const [business] = await this.drizzle.db
      .select({ id: schema.businesses.id })
      .from(schema.businesses)
      .where(and(eq(schema.businesses.id, businessId), eq(schema.businesses.ownerId, ownerId)))
      .limit(1);

    if (!business) throw new ForbiddenException('Not your business');

    const now = new Date().toISOString();
    await this.drizzle.db
      .update(schema.customerRewards)
      .set({ status: 'expired' })
      .where(
        and(
          eq(schema.customerRewards.businessId, businessId),
          eq(schema.customerRewards.status, 'unclaimed'),
          lt(schema.customerRewards.expiresAt, now),
        ),
      );

    const customers = await this.drizzle.db
      .select({
        customerId: schema.customers.id,
        phoneNumber: schema.customers.phoneNumber,
        loyaltyPoints: schema.customerBusiness.loyaltyPoints,
        pityCounter: schema.customerBusiness.pityCounter,
        lastSpinAt: schema.customerBusiness.lastSpinAt,
      })
      .from(schema.customerBusiness)
      .innerJoin(schema.customers, eq(schema.customerBusiness.customerId, schema.customers.id))
      .where(eq(schema.customerBusiness.businessId, businessId))
      .orderBy(desc(schema.customerBusiness.loyaltyPoints));

    const rewards = await this.drizzle.db
      .select({
        id: schema.customerRewards.id,
        customerId: schema.customerRewards.customerId,
        status: schema.customerRewards.status,
        redeemedAt: schema.customerRewards.redeemedAt,
        expiresAt: schema.customerRewards.expiresAt,
        createdAt: schema.customerRewards.createdAt,
        rewardName: schema.rewards.name,
        rewardTier: schema.rewards.tier,
      })
      .from(schema.customerRewards)
      .innerJoin(schema.rewards, eq(schema.customerRewards.rewardId, schema.rewards.id))
      .where(eq(schema.customerRewards.businessId, businessId))
      .orderBy(desc(schema.customerRewards.createdAt));

    const rewardsByCustomer = new Map<string, typeof rewards>();
    for (const reward of rewards) {
      const existing = rewardsByCustomer.get(reward.customerId) ?? [];
      existing.push(reward);
      rewardsByCustomer.set(reward.customerId, existing);
    }

    return customers.map((c) => {
      const cr = rewardsByCustomer.get(c.customerId) ?? [];
      return {
        id: c.customerId,
        phone_number: c.phoneNumber,
        loyalty_points: c.loyaltyPoints,
        pity_counter: c.pityCounter,
        last_spin_at: c.lastSpinAt,
        unclaimed_count: cr.filter((r) => r.status === 'unclaimed').length,
        redeemed_count: cr.filter((r) => r.status === 'redeemed').length,
        expired_count: cr.filter((r) => r.status === 'expired').length,
        rewards: cr,
      };
    });
  }
}
