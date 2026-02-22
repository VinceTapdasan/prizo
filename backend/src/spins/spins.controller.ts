import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { SpinsService } from './spins.service';
import { CustomersService } from '../customers/customers.service';

@Controller('businesses/:businessId')
export class SpinsController {
  constructor(
    private readonly spins: SpinsService,
    private readonly customers: CustomersService,
  ) {}

  @Get('spin-status')
  async getSpinStatus(
    @Param('businessId') businessId: string,
    @Query('phone') phone: string,
  ) {
    if (!phone) throw new BadRequestException('phone is required');
    const customer = await this.customers.findOrCreateByPhone(phone);
    return this.spins.getSpinStatus(businessId, customer.id);
  }

  @Post('spin')
  async executeSpin(
    @Param('businessId') businessId: string,
    @Body() body: { phone: string },
  ) {
    if (!body?.phone) throw new BadRequestException('phone is required');
    const customer = await this.customers.findOrCreateByPhone(body.phone);
    return this.spins.executeSpin(businessId, customer.id);
  }
}
