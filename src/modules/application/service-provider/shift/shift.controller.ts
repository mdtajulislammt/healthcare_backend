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
import { EmployeePermissionType } from '@prisma/client';

@Controller('application/shifts')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
@Roles(Role.SERVICE_PROVIDER, Role.EMPLOYEE)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) { }

  @Post()
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  create(@Body() createShiftDto: CreateShiftDto) {
    return this.shiftService.create(createShiftDto);
  }

  @Get()
  @RequireEmployeePermission(
    EmployeePermissionType.post_new_shifts,
    EmployeePermissionType.assign_shift_applicants,
  )
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.shiftService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
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
  update(@Param('id') id: string, @Body() updateShiftDto: UpdateShiftDto) {
    return this.shiftService.update(id, updateShiftDto);
  }

  @Delete(':id')
  @RequireEmployeePermission(EmployeePermissionType.post_new_shifts)
  remove(@Param('id') id: string) {
    return this.shiftService.remove(id);
  }
}
