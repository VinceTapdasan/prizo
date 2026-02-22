import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('superadmin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('businesses')
  getBusinesses() {
    return this.admin.getAllBusinessesWithStats();
  }

  @Get('activity-logs')
  getActivityLogs(@Query('limit') limit?: string) {
    return this.admin.getRecentActivityLogs(limit ? parseInt(limit, 10) : 50);
  }

  @Get('businesses/:id/frequency')
  getFrequency(@Param('id') id: string) {
    return this.admin.getBusinessFrequency(id);
  }
}
