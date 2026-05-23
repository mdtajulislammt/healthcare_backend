import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffReviewService } from './staff-review.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Admin - Staff Review')
@ApiBearerAuth()
@Controller('admin/staff-review')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StaffReviewController {
  constructor(private readonly staffReviewService: StaffReviewService) {}

  @ApiOperation({ summary: 'Get staff performance reviews' })
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('ratingBelow') ratingBelow?: string,
    @Query('staffId') staffId?: string,
    @Query('providerId') providerId?: string,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.staffReviewService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      ratingBelow: ratingBelow ? Number(ratingBelow) : undefined,
      staffId,
      providerId,
      shiftId,
    });
  }

  @ApiOperation({ summary: 'Get a single staff performance review by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffReviewService.findOne(id || '');
  }

  @ApiOperation({ summary: 'Delete a staff performance review by ID' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffReviewService.remove(id || '');
  }
}
