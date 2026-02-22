import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';

@Controller()
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // ── Public endpoints ──────────────────────────────────────────────────────

  @Get('customers/check')
  async checkPhone(@Query('phone') phone: string) {
    if (!phone) throw new BadRequestException('phone is required');
    return this.customers.checkPhone(phone);
  }

  @Get('businesses/:businessId/customers')
  @UseGuards(SupabaseAuthGuard)
  async getCustomersForBusiness(@Param('businessId') businessId: string, @Req() req: any) {
    return this.customers.getCustomersWithRewardsForBusiness(businessId, req.user.id);
  }

  @Get('businesses/:businessId/customer-rewards')
  async getRewardsForBusiness(
    @Param('businessId') businessId: string,
    @Query('phone') phone: string,
  ) {
    if (!phone) throw new BadRequestException('phone is required');
    const customer = await this.customers.findOrCreateByPhone(phone);
    return this.customers.getRewardsForBusiness(customer.id, businessId);
  }

  // ── Authenticated endpoints ───────────────────────────────────────────────

  @Get('customers/me/venues')
  @UseGuards(SupabaseAuthGuard)
  getVenues(@Req() req: any) {
    return this.customers.getVenuesForCustomer(req.user.id);
  }

  @Get('customers/me/businesses/:businessId')
  @UseGuards(SupabaseAuthGuard)
  async getLoyalty(@Param('businessId') businessId: string, @Req() req: any) {
    if (!req.user.phone) throw new ForbiddenException('Phone auth required');
    const customer = await this.customers.findOrCreateByPhone(req.user.phone, req.user.id);
    return this.customers.getLoyaltyForBusiness(customer.id, businessId);
  }

  @Get('customers/me/rewards')
  @UseGuards(SupabaseAuthGuard)
  async getAllRewards(@Req() req: any) {
    if (!req.user.phone) throw new ForbiddenException('Phone auth required');
    const customer = await this.customers.findOrCreateByPhone(req.user.phone, req.user.id);
    return this.customers.getAllRewards(customer.id);
  }

  @Post('customers/me/set-password-flag')
  @UseGuards(SupabaseAuthGuard)
  async setPasswordFlag(@Req() req: any) {
    if (!req.user.phone) throw new ForbiddenException('Phone auth required');
    await this.customers.setPasswordFlag(req.user.phone);
    return { ok: true };
  }

  @Post('customer-rewards/:id/redeem')
  @UseGuards(SupabaseAuthGuard)
  async redeem(@Param('id') id: string, @Req() req: any) {
    if (!req.user.phone) throw new ForbiddenException('Phone auth required');
    const customer = await this.customers.findOrCreateByPhone(req.user.phone, req.user.id);
    return this.customers.redeemReward(id, customer.id);
  }
}
