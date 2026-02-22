import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomersService } from './customers.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';

interface AuthedRequest {
  user: {
    id: string;
    phone?: string;
  };
}

@Controller()
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly config: ConfigService,
  ) {}

  // ── Public endpoints ──────────────────────────────────────────────────────

  @Get('customers/check')
  checkPhone(@Query('phone') phone: string) {
    if (!phone) throw new BadRequestException('phone is required');
    return this.customers.checkPhone(phone);
  }

  @Get('businesses/:businessId/customers')
  @UseGuards(SupabaseAuthGuard)
  getCustomersForBusiness(
    @Param('businessId') businessId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.customers.getCustomersWithRewardsForBusiness(
      businessId,
      req.user.id,
    );
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
  getVenues(@Req() req: AuthedRequest) {
    return this.customers.getVenuesForCustomer(req.user.id);
  }

  @Get('customers/me/businesses/:businessId')
  @UseGuards(SupabaseAuthGuard)
  async getLoyalty(
    @Param('businessId') businessId: string,
    @Req() req: AuthedRequest,
  ) {
    if (!req.user.phone) throw new ForbiddenException('Phone auth required');
    const customer = await this.customers.findOrCreateByPhone(
      req.user.phone,
      req.user.id,
    );
    return this.customers.getLoyaltyForBusiness(customer.id, businessId);
  }

  @Get('customers/me/rewards')
  @UseGuards(SupabaseAuthGuard)
  async getAllRewards(@Req() req: AuthedRequest) {
    if (!req.user.phone) throw new ForbiddenException('Phone auth required');
    const customer = await this.customers.findOrCreateByPhone(
      req.user.phone,
      req.user.id,
    );
    return this.customers.getAllRewards(customer.id);
  }

  @Post('customers/me/set-password-flag')
  @UseGuards(SupabaseAuthGuard)
  async setPasswordFlag(@Req() req: AuthedRequest) {
    if (!req.user.phone) throw new ForbiddenException('Phone auth required');
    await this.customers.setPasswordFlag(req.user.phone);
    return { ok: true };
  }

  @Post('customer-rewards/:id/redeem')
  @UseGuards(SupabaseAuthGuard)
  async redeem(@Param('id') id: string, @Req() req: AuthedRequest) {
    if (!req.user.phone) throw new ForbiddenException('Phone auth required');
    const customer = await this.customers.findOrCreateByPhone(
      req.user.phone,
      req.user.id,
    );
    return this.customers.redeemReward(id, customer.id);
  }

  @Post('customer-rewards/:id/redeem-public')
  async redeemPublic(@Param('id') id: string, @Body() body: { phone: string }) {
    if (this.config.get('OTP_ENABLED') !== '0') {
      throw new ForbiddenException('Public redemption is disabled');
    }
    if (!body.phone) throw new BadRequestException('phone is required');
    const customer = await this.customers.findOrCreateByPhone(body.phone);
    return this.customers.redeemReward(id, customer.id);
  }
}
