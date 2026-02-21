import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('customers/me/businesses/:businessId')
  getLoyalty(@Param('businessId') businessId: string, @Req() req: any) {
    return this.customers.getLoyaltyForBusiness(req.user.id, businessId);
  }

  @Get('customers/me/rewards')
  getAllRewards(@Req() req: any) {
    return this.customers.getAllRewards(req.user.id);
  }

  @Post('customer-rewards/:id/redeem')
  redeem(@Param('id') id: string, @Req() req: any) {
    return this.customers.redeemReward(id, req.user.id);
  }
}
