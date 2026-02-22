import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import * as schema from '../db/schema';
import type { Reward } from '../db/schema';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class SpinsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async getSpinStatus(businessId: string, customerId: string) {
    const [business] = await this.drizzle.db
      .select({ resetTime: schema.businesses.resetTime, pityThreshold: schema.businesses.pityThreshold })
      .from(schema.businesses)
      .where(eq(schema.businesses.id, businessId))
      .limit(1);

    const [cb] = await this.drizzle.db
      .select({
        lastSpinAt: schema.customerBusiness.lastSpinAt,
        pityCounter: schema.customerBusiness.pityCounter,
        loyaltyPoints: schema.customerBusiness.loyaltyPoints,
      })
      .from(schema.customerBusiness)
      .where(
        and(
          eq(schema.customerBusiness.customerId, customerId),
          eq(schema.customerBusiness.businessId, businessId),
        ),
      )
      .limit(1);

    const available = this.isSpinAvailable(
      cb?.lastSpinAt ?? null,
      business?.resetTime ?? '05:00:00',
    );
    const pityCounter = cb?.pityCounter ?? 0;
    const pityThreshold = business?.pityThreshold ?? 7;

    return {
      available,
      pity_counter: pityCounter,
      pity_threshold: pityThreshold,
      spins_until_guaranteed: available ? Math.max(0, pityThreshold - pityCounter) : null,
      loyalty_points: cb?.loyaltyPoints ?? 0,
    };
  }

  async executeSpin(businessId: string, customerId: string) {
    // Check if this is the customer's first visit (before transaction creates the record)
    const [existingCb] = await this.drizzle.db
      .select({ id: schema.customerBusiness.id })
      .from(schema.customerBusiness)
      .where(
        and(
          eq(schema.customerBusiness.customerId, customerId),
          eq(schema.customerBusiness.businessId, businessId),
        ),
      )
      .limit(1);
    const isFirstVisit = !existingCb;

    const result = await this.drizzle.db.transaction(async (tx) => {
      // 1. Get business config
      const [business] = await tx
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.id, businessId))
        .limit(1);

      if (!business) throw new NotFoundException('Business not found');

      // 2. Get or create customer_business record
      await tx
        .insert(schema.customerBusiness)
        .values({ customerId, businessId, loyaltyPoints: 0, pityCounter: 0 })
        .onConflictDoNothing();

      const [cb] = await tx
        .select()
        .from(schema.customerBusiness)
        .where(
          and(
            eq(schema.customerBusiness.customerId, customerId),
            eq(schema.customerBusiness.businessId, businessId),
          ),
        )
        .limit(1);

      // 3. Check spin availability
      if (!this.isSpinAvailable(cb.lastSpinAt, business.resetTime)) {
        throw new BadRequestException('Spin not available yet');
      }

      // 4. Get active rewards
      const rewards = await tx
        .select()
        .from(schema.rewards)
        .where(
          and(
            eq(schema.rewards.businessId, businessId),
            eq(schema.rewards.isActive, true),
          ),
        );

      // 5. RNG with pity check
      const pityTriggered = cb.pityCounter >= business.pityThreshold && rewards.length > 0;
      let wonReward: Reward | null = null;

      if (pityTriggered) {
        wonReward = this.pickPityReward(rewards, business.pityMinTier);
      } else {
        wonReward = this.pickReward(rewards);
      }

      // 6. Record spin
      const now = new Date().toISOString();
      const [spin] = await tx
        .insert(schema.spins)
        .values({
          customerId,
          businessId,
          rewardId: wonReward?.id ?? null,
          spunAt: now,
        })
        .returning();

      // 7. Create customer_reward if won
      let customerRewardId: string | null = null;
      let customerRewardExpiresAt: string | null = null;
      if (wonReward) {
        const expiresInDays = wonReward.expiresInDays ?? 1;
        const expiresAt = new Date(
          Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
        ).toISOString();

        const [cr] = await tx.insert(schema.customerRewards).values({
          customerId,
          businessId,
          rewardId: wonReward.id,
          spinId: spin.id,
          status: 'unclaimed',
          expiresAt,
        }).returning();
        customerRewardId = cr.id;
        customerRewardExpiresAt = expiresAt;
      }

      // 8. Update customer_business — reset pity on win, increment on miss
      const newPityCounter = wonReward ? 0 : cb.pityCounter + 1;

      await tx
        .update(schema.customerBusiness)
        .set({
          loyaltyPoints: cb.loyaltyPoints + business.pointsPerScan,
          pityCounter: newPityCounter,
          lastSpinAt: now,
        })
        .where(
          and(
            eq(schema.customerBusiness.customerId, customerId),
            eq(schema.customerBusiness.businessId, businessId),
          ),
        );

      return {
        won: !!wonReward,
        reward: wonReward
          ? {
              id: wonReward.id,
              name: wonReward.name,
              description: wonReward.description,
              tier: wonReward.tier,
            }
          : null,
        customer_reward_id: customerRewardId,
        expires_at: customerRewardExpiresAt,
        pity_triggered: pityTriggered,
        points_earned: business.pointsPerScan,
        total_points: cb.loyaltyPoints + business.pointsPerScan,
        pity_counter: newPityCounter,
      };
    });

    // Log asynchronously — don't block the spin response
    this.activityLogs.logSpin(businessId, customerId, {
      won: result.won,
      tier: result.reward?.tier ?? null,
      reward_name: result.reward?.name ?? null,
      pity_triggered: result.pity_triggered,
      points_earned: result.points_earned,
      total_points: result.total_points,
      is_first_visit: isFirstVisit,
    }).catch(() => {
      // Non-fatal — log failure should not break the spin
    });

    return result;
  }

  private isSpinAvailable(lastSpinAt: string | null, resetTime: string): boolean {
    if (!lastSpinAt) return true;

    const now = new Date();
    const last = new Date(lastSpinAt);

    const [hours, minutes] = resetTime.split(':').map(Number);
    const reset = new Date(now);
    reset.setHours(hours, minutes, 0, 0);

    // If current time is before today's reset, reset was yesterday
    if (now < reset) {
      reset.setDate(reset.getDate() - 1);
    }

    return last < reset;
  }

  private pickReward(rewards: Reward[]): Reward | null {
    if (!rewards.length) return null;
    const roll = Math.random() * 100;
    let cursor = 0;
    for (const reward of rewards) {
      cursor += parseFloat(reward.probability);
      if (roll < cursor) return reward;
    }
    return null; // miss
  }

  private pickPityReward(rewards: Reward[], pityMinTier: string): Reward {
    const tierRank: Record<string, number> = {
      miss: 0,
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
    };
    const eligible = rewards.filter(
      (r) => (tierRank[r.tier] ?? 0) >= (tierRank[pityMinTier] ?? 1),
    );
    const pool = eligible.length > 0 ? eligible : rewards;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
