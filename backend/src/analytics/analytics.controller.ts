import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';

@Controller('businesses/:id/analytics')
@UseGuards(SupabaseAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  getOverview(@Param('id') id: string) {
    return this.analytics.getOverview(id);
  }
}
