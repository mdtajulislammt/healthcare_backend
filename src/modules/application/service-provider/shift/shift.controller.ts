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
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { EmployeePermissionGuard } from 'src/common/guard/employee-permission/employee-permission.guard';
import { RequireEmployeePermission } from 'src/common/guard/employee-permission/employee-permission.decorator';
import { EmployeePermissionType, ShiftStatus } from '@prisma/client';
import { Request } from 'express';

@Controller('application/shifts')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
@Roles(Role.SERVICE_PROVIDER, Role.EMPLOYEE)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Post()
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  create(@Req() req: Request, @Body() createShiftDto: CreateShiftDto) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.create(createShiftDto, userId);
  }

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

  @Get('bonus-options')
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  getEmergencyBonusOptions(@Req() req: Request) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.getEmergencyBonusOptions(userId);
  }

  @Get('pay-rates-by-role')
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  getPayRatesByRole(@Req() req: Request, @Query('role') role?: string) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftService.getPayRatesByRole(userId, role);
  }

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

  @Delete(':id')
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  remove(@Param('id') id: string) {
    return this.shiftService.remove(id);
  }
}
