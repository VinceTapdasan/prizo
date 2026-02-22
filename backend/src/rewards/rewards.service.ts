import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import * as schema from '../db/schema';

@Injectable()
export class RewardsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(
    businessId: string,
    dto: {
      name: string;
      description?: string;
      tier: 'miss' | 'common' | 'uncommon' | 'rare' | 'epic';
      probability: number;
      stock?: number;
      expires_in_days?: number;
    },
  ) {
    const [reward] = await this.drizzle.db
      .insert(schema.rewards)
      .values({
        businessId,
        name: dto.name,
        description: dto.description,
        tier: dto.tier,
        probability: String(dto.probability),
        stock: dto.stock,
        expiresInDays: dto.expires_in_days,
      })
      .returning();
    return reward;
  }

  async findByBusiness(businessId: string) {
    return this.drizzle.db
      .select()
      .from(schema.rewards)
      .where(eq(schema.rewards.businessId, businessId));
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      description: string;
      probability: number;
      stock: number | null;
      is_active: boolean;
      expires_in_days: number | null;
    }>,
  ) {
    const [updated] = await this.drizzle.db
      .update(schema.rewards)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.probability !== undefined && {
          probability: String(dto.probability),
        }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.is_active !== undefined && { isActive: dto.is_active }),
        ...(dto.expires_in_days !== undefined && {
          expiresInDays: dto.expires_in_days,
        }),
      })
      .where(eq(schema.rewards.id, id))
      .returning();

    if (!updated) throw new NotFoundException('Reward not found');
    return updated;
  }

  async deactivate(id: string) {
    const [updated] = await this.drizzle.db
      .update(schema.rewards)
      .set({ isActive: false })
      .where(eq(schema.rewards.id, id))
      .returning();

    if (!updated) throw new NotFoundException('Reward not found');
    return updated;
  }
}
