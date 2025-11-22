import {
  Controller,
  Get,
  UseGuards,
  Req,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { HomeService } from './home.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Service Provider - Home')
@Controller('application/service-provider/home')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SERVICE_PROVIDER)
@ApiBearerAuth()
export class HomeController {
  constructor(private readonly homeService: HomeService) { }

  @ApiOperation({ summary: 'Get dashboard metrics (4 cards)' })
  @Get('metrics')
  getDashboardMetrics(@Req() req: Request) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.homeService.getDashboardMetrics(user_id);
  }

  @ApiOperation({ summary: 'Get recent shifts' })
  @Get('recent-shifts')
  getRecentShifts(
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    const limitNum = limit ? Number(limit) : 10;
    if (limit && (isNaN(limitNum) || limitNum < 1 || limitNum > 50)) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }

    return this.homeService.getRecentShifts(user_id, limitNum);
  }

  @ApiOperation({ summary: 'Get recent activities' })
  @Get('recent-activities')
  getRecentActivities(
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    const limitNum = limit ? Number(limit) : 10;
    if (limit && (isNaN(limitNum) || limitNum < 1 || limitNum > 50)) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }

    return this.homeService.getRecentActivities(user_id, limitNum);
  }

  @ApiOperation({ summary: 'Get all home data (metrics, recent shifts, recent activities)' })
  @Get('all')
  getAllHomeData(
    @Req() req: Request,
    @Query('shifts_limit') shiftsLimit?: string,
    @Query('activities_limit') activitiesLimit?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    const shiftsLimitNum = shiftsLimit ? Number(shiftsLimit) : 10;
    const activitiesLimitNum = activitiesLimit ? Number(activitiesLimit) : 10;

    if (shiftsLimit && (isNaN(shiftsLimitNum) || shiftsLimitNum < 1 || shiftsLimitNum > 50)) {
      throw new BadRequestException('Shifts limit must be between 1 and 50');
    }
    if (activitiesLimit && (isNaN(activitiesLimitNum) || activitiesLimitNum < 1 || activitiesLimitNum > 50)) {
      throw new BadRequestException('Activities limit must be between 1 and 50');
    }

    return this.homeService.getAllHomeData(user_id, shiftsLimitNum, activitiesLimitNum);
  }
}
