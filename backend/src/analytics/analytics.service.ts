import { Injectable } from '@nestjs/common';
import { eq, and, gte, count } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import * as schema from '../db/schema';

@Injectable()
export class AnalyticsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getOverview(businessId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [[scansToday], [totalCustomers], [redemptions]] = await Promise.all([
      this.drizzle.db
        .select({ count: count() })
        .from(schema.spins)
        .where(
          and(
            eq(schema.spins.businessId, businessId),
            gte(schema.spins.spunAt, todayStart.toISOString()),
          ),
        ),

      this.drizzle.db
        .select({ count: count() })
        .from(schema.customerBusiness)
        .where(eq(schema.customerBusiness.businessId, businessId)),

      this.drizzle.db
        .select({ count: count() })
        .from(schema.customerRewards)
        .where(
          and(
            eq(schema.customerRewards.businessId, businessId),
            eq(schema.customerRewards.status, 'redeemed'),
          ),
        ),
    ]);

    return {
      scans_today: Number(scansToday?.count ?? 0),
      total_customers: Number(totalCustomers?.count ?? 0),
      total_redemptions: Number(redemptions?.count ?? 0),
    };
  }
}
