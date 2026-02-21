import { Module } from '@nestjs/common';
import { SpinsController } from './spins.controller';
import { SpinsService } from './spins.service';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  controllers: [SpinsController],
  providers: [SpinsService],
  exports: [SpinsService],
})
export class SpinsModule {}
