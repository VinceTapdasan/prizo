import { Module } from '@nestjs/common';
import { SpinsController } from './spins.controller';
import { SpinsService } from './spins.service';
import { CustomersModule } from '../customers/customers.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [CustomersModule, ActivityLogsModule],
  controllers: [SpinsController],
  providers: [SpinsService],
  exports: [SpinsService],
})
export class SpinsModule {}
