import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';

@Controller()
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Post('businesses/:id/rewards')
  @UseGuards(SupabaseAuthGuard)
  create(@Param('id') businessId: string, @Body() body: any) {
    return this.rewards.create(businessId, body);
  }

  @Get('businesses/:id/rewards')
  findByBusiness(@Param('id') businessId: string) {
    return this.rewards.findByBusiness(businessId);
  }

  @Patch('rewards/:id')
  @UseGuards(SupabaseAuthGuard)
  update(@Param('id') id: string, @Body() body: any) {
    return this.rewards.update(id, body);
  }

  @Delete('rewards/:id')
  @UseGuards(SupabaseAuthGuard)
  deactivate(@Param('id') id: string) {
    return this.rewards.deactivate(id);
  }
}
