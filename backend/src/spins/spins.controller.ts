import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { SpinsService } from './spins.service';
import { CustomersService } from '../customers/customers.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';

@Controller('businesses/:businessId')
@UseGuards(SupabaseAuthGuard)
export class SpinsController {
  constructor(
    private readonly spins: SpinsService,
    private readonly customers: CustomersService,
  ) {}

  @Get('spin-status')
  async getSpinStatus(@Param('businessId') businessId: string, @Req() req: any) {
    if (!req.user.phone) throw new ForbiddenException('Customer phone auth required');
    const customer = await this.customers.findOrCreateByPhone(req.user.phone, req.user.id);
    return this.spins.getSpinStatus(businessId, customer.id);
  }

  @Post('spin')
  async executeSpin(@Param('businessId') businessId: string, @Req() req: any) {
    if (!req.user.phone) throw new ForbiddenException('Customer phone auth required');
    const customer = await this.customers.findOrCreateByPhone(req.user.phone, req.user.id);
    return this.spins.executeSpin(businessId, customer.id);
  }
}
