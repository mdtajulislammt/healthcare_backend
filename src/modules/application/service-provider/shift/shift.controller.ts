import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ShiftService } from './shift.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
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
import { EmployeePermissionGuard } from 'src/common/guard/employee-permission/employee-permission.guard';
import { RequireEmployeePermission } from 'src/common/guard/employee-permission/employee-permission.decorator';
import { EmployeePermissionType, ShiftStatus } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Service Provider - Shifts')
@ApiBearerAuth()
@Controller('application/shifts')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
@Roles(Role.SERVICE_PROVIDER, Role.EMPLOYEE)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @ApiOperation({ summary: 'Create a new shift post' })
  @Post()
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  create(@Req() req: Request, @Body() createShiftDto: CreateShiftDto) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.create(createShiftDto, userId);
  }

  @ApiOperation({
    summary: 'Get all shifts for the logged-in service provider',
  })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'filter',
    description: 'Filter by applicant presence',
    required: false,
    enum: ['with_applicants', 'without_applicants'],
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by shift status',
    required: false,
    enum: ShiftStatus,
  })
  @Get()
  @RequireEmployeePermission(
    EmployeePermissionType.post_new_shifts,
    EmployeePermissionType.assign_shift_applicants,
  )
  findAll(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('filter') filter?: 'with_applicants' | 'without_applicants',
    @Query('status') status?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.findAll(userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      filter,
      status: status as ShiftStatus,
    });
  }

  @ApiOperation({ summary: 'Get emergency bonus option list' })
  @Get('bonus-options')
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  getEmergencyBonusOptions(@Req() req: Request) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.getEmergencyBonusOptions(userId);
  }

  @ApiOperation({ summary: 'Get pay rates by role for the service provider' })
  @ApiQuery({ name: 'role', required: false, type: String })
  @Get('pay-rates-by-role')
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  getPayRatesByRole(@Req() req: Request, @Query('role') role?: string) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.getPayRatesByRole(userId, role);
  }

  @ApiOperation({ summary: 'Get details of a single shift by ID' })
  @ApiQuery({
    name: 'status',
    description: 'Filter application status',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'dateOrder',
    description: 'Sorting order by date',
    required: false,
    enum: ['asc', 'desc'],
  })
  @Get(':id')
  @RequireEmployeePermission(
    EmployeePermissionType.post_new_shifts,
    EmployeePermissionType.assign_shift_applicants,
  )
  findOne(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('dateOrder') dateOrder?: 'asc' | 'desc',
  ) {
    return this.shiftService.findOne(id, {
      applicationStatus: status,
      dateOrder,
    });
  }

  @ApiOperation({ summary: 'Update shift details' })
  @Patch(':id')
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateShiftDto: UpdateShiftDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.update(id, updateShiftDto, userId);
  }

  @ApiOperation({ summary: 'Delete/remove a shift by ID' })
  @Delete(':id')
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  remove(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.remove(id, userId);
  }
}
