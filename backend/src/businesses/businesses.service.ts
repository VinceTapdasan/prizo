import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import * as schema from '../db/schema';

@Injectable()
export class BusinessesService {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(
    ownerId: string,
    dto: { name: string; type?: string; location?: string },
  ) {
    const slug = this.generateSlug(dto.name);

    try {
      const [business] = await this.drizzle.db
        .insert(schema.businesses)
        .values({
          ownerId,
          name: dto.name,
          slug,
          type: dto.type,
          location: dto.location,
        })
        .returning();
      return business;
    } catch (e: any) {
      if (e?.code === '23505')
        throw new ConflictException('Slug already taken');
      throw e;
    }
  }

  async findBySlug(slug: string) {
    const [business] = await this.drizzle.db
      .select({
        id: schema.businesses.id,
        name: schema.businesses.name,
        slug: schema.businesses.slug,
        type: schema.businesses.type,
        location: schema.businesses.location,
        qrActive: schema.businesses.qrActive,
      })
      .from(schema.businesses)
      .where(
        and(
          eq(schema.businesses.slug, slug),
          eq(schema.businesses.qrActive, true),
        ),
      )
      .limit(1);

    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async findByOwner(ownerId: string) {
    return this.drizzle.db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.ownerId, ownerId));
  }

  async update(
    id: string,
    ownerId: string,
    dto: Partial<{
      name: string;
      reset_time: string;
      points_per_scan: number;
      pity_threshold: number;
      pity_min_tier: string;
    }>,
  ) {
    const [updated] = await this.drizzle.db
      .update(schema.businesses)
      .set({
        ...(dto.name && { name: dto.name }),
        ...(dto.reset_time && { resetTime: dto.reset_time }),
        ...(dto.points_per_scan && { pointsPerScan: dto.points_per_scan }),
        ...(dto.pity_threshold && { pityThreshold: dto.pity_threshold }),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.businesses.id, id),
          eq(schema.businesses.ownerId, ownerId),
        ),
      )
      .returning();

    if (!updated) throw new NotFoundException('Business not found');
    return updated;
  }

  async regenerateQr(id: string, ownerId: string) {
    const newSlug = this.generateSlug(`venue-${Date.now()}`);

    const [updated] = await this.drizzle.db
      .update(schema.businesses)
      .set({ slug: newSlug, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(schema.businesses.id, id),
          eq(schema.businesses.ownerId, ownerId),
        ),
      )
      .returning();

    if (!updated) throw new NotFoundException('Business not found');
    return updated;
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const suffix = Math.random().toString(36).slice(2, 7);
    return `${base}-${suffix}`;
  }
}
