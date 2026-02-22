import { Injectable } from '@nestjs/common';
import { eq, desc, count, sql } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import * as schema from '../db/schema';

@Injectable()
export class AdminService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getAllBusinessesWithStats() {
    const businesses = await this.drizzle.db.select().from(schema.businesses);

    const stats = await Promise.all(
      businesses.map(async (b) => {
        const [[totalCustomers], [totalSpins], [returningCustomers]] = await Promise.all([
          this.drizzle.db
            .select({ count: count() })
            .from(schema.customerBusiness)
            .where(eq(schema.customerBusiness.businessId, b.id)),

          this.drizzle.db
            .select({ count: count() })
            .from(schema.spins)
            .where(eq(schema.spins.businessId, b.id)),

          // Returning = customers with more than 1 spin at this business
          this.drizzle.db
            .select({ count: sql<number>`count(*)` })
            .from(
              this.drizzle.db
                .select({ customerId: schema.spins.customerId, spinCount: count().as('spin_count') })
                .from(schema.spins)
                .where(eq(schema.spins.businessId, b.id))
                .groupBy(schema.spins.customerId)
                .as('per_customer'),
            )
            .where(sql`spin_count > 1`),
        ]);

        const [lastSpin] = await this.drizzle.db
          .select({ spunAt: schema.spins.spunAt })
          .from(schema.spins)
          .where(eq(schema.spins.businessId, b.id))
          .orderBy(desc(schema.spins.spunAt))
          .limit(1);

        const total = Number(totalCustomers?.count ?? 0);
        const returning = Number(returningCustomers?.count ?? 0);

        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          type: b.type,
          total_customers: total,
          total_spins: Number(totalSpins?.count ?? 0),
          returning_customers: returning,
          return_rate_pct: total > 0 ? Math.round((returning / total) * 100) : 0,
          last_active: lastSpin?.spunAt ?? null,
          created_at: b.createdAt,
        };
      }),
    );

    return stats.sort((a, b) => {
      if (!a.last_active && !b.last_active) return 0;
      if (!a.last_active) return 1;
      if (!b.last_active) return -1;
      return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
    });
  }

  async getRecentActivityLogs(limit = 50) {
    const logs = await this.drizzle.db
      .select({
        id: schema.activityLogs.id,
        actionType: schema.activityLogs.actionType,
        details: schema.activityLogs.details,
        createdAt: schema.activityLogs.createdAt,
        businessName: schema.businesses.name,
        businessSlug: schema.businesses.slug,
        phoneNumber: schema.customers.phoneNumber,
      })
      .from(schema.activityLogs)
      .innerJoin(schema.businesses, eq(schema.activityLogs.businessId, schema.businesses.id))
      .leftJoin(schema.customers, eq(schema.activityLogs.customerId, schema.customers.id))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);

    return logs.map((log) => ({
      ...log,
      // Mask phone: show last 4 digits only
      phoneNumber: log.phoneNumber ? this.maskPhone(log.phoneNumber) : null,
    }));
  }

  async getBusinessFrequency(businessId: string) {
    const [totalCustomers] = await this.drizzle.db
      .select({ count: count() })
      .from(schema.customerBusiness)
      .where(eq(schema.customerBusiness.businessId, businessId));

    const [totalSpins] = await this.drizzle.db
      .select({ count: count() })
      .from(schema.spins)
      .where(eq(schema.spins.businessId, businessId));

    // New = first spin at this business (is_first_visit in activity log)
    const [newCustomers] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.activityLogs)
      .where(
        sql`business_id = ${businessId} AND action_type = 'SPIN' AND (details->>'is_first_visit')::boolean = true`,
      );

    // Recent activity: last 30 days spin count per day
    const dailySpins = await this.drizzle.db
      .select({
        date: sql<string>`date_trunc('day', spun_at)::date::text`,
        count: count(),
      })
      .from(schema.spins)
      .where(
        sql`business_id = ${businessId} AND spun_at >= NOW() - INTERVAL '30 days'`,
      )
      .groupBy(sql`date_trunc('day', spun_at)`)
      .orderBy(sql`date_trunc('day', spun_at)`);

    const total = Number(totalCustomers?.count ?? 0);
    const newCount = Number(newCustomers?.count ?? 0);
    const returning = total - newCount;

    return {
      total_customers: total,
      total_spins: Number(totalSpins?.count ?? 0),
      new_customers: newCount,
      returning_customers: returning > 0 ? returning : 0,
      return_rate_pct: total > 0 ? Math.round(((returning > 0 ? returning : 0) / total) * 100) : 0,
      daily_spins: dailySpins.map((d) => ({ date: d.date, count: Number(d.count) })),
    };
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 4) return '****';
    return '***-***-' + phone.slice(-4);
  }
}
