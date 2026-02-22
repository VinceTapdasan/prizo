import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from './auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly supabase: SupabaseService) {}

  // Idempotent — only sets role if not already assigned.
  // Called after Google OAuth to provision business_owner role.
  @Post('provision')
  @UseGuards(SupabaseAuthGuard)
  async provision(@Req() req: any, @Body('role') role: string) {
    const userId = req.user.id as string;
    const currentRole = req.user.app_metadata?.role;

    // Skip if role already set
    if (currentRole) {
      return { role: currentRole, provisioned: false };
    }

    const allowedRoles = ['business_owner', 'customer'];
    const targetRole = allowedRoles.includes(role) ? role : 'business_owner';

    const { error } = await this.supabase.db.auth.admin.updateUserById(userId, {
      app_metadata: { role: targetRole },
    });

    if (error) throw error;

    return { role: targetRole, provisioned: true };
  }
}
