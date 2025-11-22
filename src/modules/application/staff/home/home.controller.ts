import { Controller, Get, UseGuards, Req, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { HomeService } from './home.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Staff - Home')
@ApiBearerAuth()
@Controller('application/staff/home')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF)
export class HomeController {
  constructor(private readonly homeService: HomeService) { }

  @ApiOperation({ summary: 'Get staff home dashboard data (profile completion, next shift, work stats, immediate check-in)' })
  @Get('dashboard')
  getDashboardData(@Req() req: Request) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.homeService.getDashboardData(user_id);
  }

  @ApiOperation({ summary: 'Get new shifts near you with distance calculation' })
  @Get('new-shifts')
  getNewShiftsNearYou(
    @Req() req: Request,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('limit') limit?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    const lat = latitude ? Number(latitude) : undefined;
    const lng = longitude ? Number(longitude) : undefined;
    const limitNum = limit ? Number(limit) : 10;

    if (latitude && (isNaN(lat) || lat < -90 || lat > 90)) {
      throw new BadRequestException('Invalid latitude');
    }
    if (longitude && (isNaN(lng) || lng < -180 || lng > 180)) {
      throw new BadRequestException('Invalid longitude');
    }
    if (limit && (isNaN(limitNum) || limitNum < 1 || limitNum > 50)) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }

    return this.homeService.getNewShiftsNearYou(user_id, lat, lng, limitNum);
  }
}
