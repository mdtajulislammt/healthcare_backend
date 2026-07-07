import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ShiftService } from './shift.service';
import { Response } from 'express';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { AssignStaffDto } from './dto/assign-staff.dto';

@ApiTags('Admin - Shifts')
@ApiBearerAuth()
@Controller('admin/shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @ApiOperation({ summary: 'Get all shifts' })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.shiftService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
    });
  }

  // Keep static route above dynamic ':id' to avoid misrouting
  @ApiOperation({ summary: 'Export shifts to CSV format' })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'dateRange', required: false, type: String })
  @Get('export')
  async export(
    @Query('type') type: string,
    @Query('search') search: string,
    @Query('dateRange') dateRange: string,
    @Res() res: Response,
  ) {
    const csv = await this.shiftService.exportShifts(type, {
      search,
      dateRange,
    });
    const date = new Date().toISOString().slice(0, 10);
    const rangeLabel = dateRange ? `_${dateRange}` : '';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shifts_${type || 'all'}${rangeLabel}_${date}.csv"`,
    );
    res.send(csv);
  }

  @ApiOperation({ summary: 'Get a single shift by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shiftService.findOne(id);
  }

  @ApiOperation({ summary: 'Assign staff to a shift manually' })
  @Patch(':id/assign')
  assignStaff(
    @Param('id') id: string,
    @Body() assignStaffDto: AssignStaffDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.shiftService.assignStaff(id, assignStaffDto.staff_id, userId);
  }

  @ApiOperation({ summary: 'Delete/remove a shift by ID' })
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.remove(id, userId);
  }
}
