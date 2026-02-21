import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { RewardsModule } from './rewards/rewards.module';
import { SpinsModule } from './spins/spins.module';
import { CustomersModule } from './customers/customers.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    SupabaseModule,
    AuthModule,
    BusinessesModule,
    RewardsModule,
    SpinsModule,
    CustomersModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
