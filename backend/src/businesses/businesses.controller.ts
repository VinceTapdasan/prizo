import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('business_owner')
  create(@Req() req: any, @Body() body: { name: string; type?: string; location?: string }) {
    return this.businesses.create(req.user.id, body);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  findOwned(@Req() req: any) {
    return this.businesses.findByOwner(req.user.id);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.businesses.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard)
  update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.businesses.update(id, req.user.id, body);
  }

  @Post(':id/regenerate-qr')
  @UseGuards(SupabaseAuthGuard)
  regenerateQr(@Param('id') id: string, @Req() req: any) {
    return this.businesses.regenerateQr(id, req.user.id);
  }
}
