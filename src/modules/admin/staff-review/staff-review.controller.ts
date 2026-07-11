import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  Patch,
  Body,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StaffReviewService } from './staff-review.service';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';
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
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'staffId', required: false, type: String })
  @ApiQuery({ name: 'providerId', required: false, type: String })
  @ApiQuery({ name: 'shiftId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'ratingBelow', required: false, type: String })
  @ApiQuery({
    name: 'sortRating',
    required: false,
    type: String,
    enum: ['asc', 'desc'],
  })
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('staffId') staffId?: string,
    @Query('providerId') providerId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('status') status?: string,
    @Query('ratingBelow') ratingBelow?: string,
    @Query('sortRating') sortRating?: string,
  ) {
    return this.staffReviewService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      staffId,
      providerId,
      shiftId,
      ratingBelow: ratingBelow ? Number(ratingBelow) : undefined,
      status,
      sortRating: sortRating as 'asc' | 'desc' | undefined,
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

  @ApiOperation({ summary: 'Update staff review status' })
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateReviewStatusDto) {
    return this.staffReviewService.updateStatus(id || '', body.status);
  }
}
