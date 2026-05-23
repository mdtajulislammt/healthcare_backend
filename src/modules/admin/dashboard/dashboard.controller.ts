import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ summary: 'Get dashboard metrics and statistics' })
  @Get('metrics')
  getMetrics() {
    return this.dashboardService.getMetrics();
  }

  @ApiOperation({
    summary: 'Get monthly Care Provider & Agency Staff statistics',
  })
  @Get('monthly-stats')
  getMonthlyStats() {
    return this.dashboardService.getMonthlyStats();
  }

  @ApiOperation({
    summary: 'Get top 5 service providers and staff with filters',
  })
  @Get('top-providers-staff')
  getTopProvidersAndStaff(
    @Query('search') search?: string,
    @Query('status') status?: string, // 'active' | 'suspended' | 'all'
  ) {
    return this.dashboardService.getTopProvidersAndStaff({
      search,
      status: status || 'all',
    });
  }

  @ApiOperation({
    summary:
      'Get all dashboard data (metrics, monthly stats, top providers & staff) in one call',
  })
  @Get('all')
  getAllDashboardData(
    @Query('search') search?: string,
    @Query('status') status?: string, // 'active' | 'suspended' | 'all'
    @Query('lowStarPage') lowStarPage?: string,
    @Query('lowStarLimit') lowStarLimit?: string,
    @Query('lowStarSearch') lowStarSearch?: string,
    @Query('ratingBelow') ratingBelow?: string,
  ) {
    return this.dashboardService.getAllDashboardData({
      search,
      status: status || 'all',
      lowStarPage: lowStarPage ? Number(lowStarPage) : undefined,
      lowStarLimit: lowStarLimit ? Number(lowStarLimit) : undefined,
      lowStarSearch,
      ratingBelow: ratingBelow ? Number(ratingBelow) : undefined,
    });
  }

  @ApiOperation({ summary: 'Get staff reviews below a star threshold' })
  @Get('low-star-staff-reviews')
  getLowStarStaffReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('ratingBelow') ratingBelow?: string,
  ) {
    return this.dashboardService.getLowStarStaffReviews({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      ratingBelow: ratingBelow ? Number(ratingBelow) : undefined,
    });
  }
}
