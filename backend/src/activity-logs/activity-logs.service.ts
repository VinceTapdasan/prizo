import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import * as schema from '../db/schema';

export interface SpinLogDetails {
  won: boolean;
  tier: string | null;
  reward_name: string | null;
  pity_triggered: boolean;
  points_earned: number;
  total_points: number;
  is_first_visit: boolean;
}

@Injectable()
export class ActivityLogsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async logSpin(
    businessId: string,
    customerId: string,
    details: SpinLogDetails,
  ) {
    await this.drizzle.db.insert(schema.activityLogs).values({
      businessId,
      customerId,
      actionType: 'SPIN',
      details,
    });
  }

  async logRedeem(businessId: string, customerId: string, rewardName: string) {
    await this.drizzle.db.insert(schema.activityLogs).values({
      businessId,
      customerId,
      actionType: 'REDEEM',
      details: { reward_name: rewardName },
    });
  }
}
