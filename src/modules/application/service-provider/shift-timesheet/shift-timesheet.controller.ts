import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ShiftTimesheetService } from './shift-timesheet.service';
import { CreateShiftTimesheetDto } from './dto/create-shift-timesheet.dto';
import { UpdateShiftTimesheetDto } from './dto/update-shift-timesheet.dto';
import { ApproveTimesheetDto } from './dto/approve-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { EmployeePermissionGuard } from 'src/common/guard/employee-permission/employee-permission.guard';
import { RequireEmployeePermission } from 'src/common/guard/employee-permission/employee-permission.decorator';
import { EmployeePermissionType } from '@prisma/client';

@Controller('application/service-provider/shift-timesheet')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
@Roles(Role.SERVICE_PROVIDER, Role.EMPLOYEE)
export class ShiftTimesheetController {
  constructor(private readonly shiftTimesheetService: ShiftTimesheetService) { }

  @Post()
  @RequireEmployeePermission(EmployeePermissionType.approve_timesheets)
  create(@Body() createShiftTimesheetDto: CreateShiftTimesheetDto) {
    return this.shiftTimesheetService.create(createShiftTimesheetDto);
  }

  @Get()
  @RequireEmployeePermission(
    EmployeePermissionType.approve_timesheets,
    EmployeePermissionType.dispute_timesheets,
  )
  findAll() {
    return this.shiftTimesheetService.findAll();
  }

  @Get('shift/:shift_id')
  @RequireEmployeePermission(
    EmployeePermissionType.approve_timesheets,
    EmployeePermissionType.dispute_timesheets,
  )
  findByShift(
    @Param('shift_id') shiftId: string,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftTimesheetService.findByShiftId(shiftId, user_id);
  }

  @Get(':id')
  @RequireEmployeePermission(
    EmployeePermissionType.approve_timesheets,
    EmployeePermissionType.dispute_timesheets,
  )
  findOne(@Param('id') id: string) {
    return this.shiftTimesheetService.findOne(id);
  }

  @Patch(':id')
  @RequireEmployeePermission(EmployeePermissionType.approve_timesheets)
  update(@Param('id') id: string, @Body() updateShiftTimesheetDto: UpdateShiftTimesheetDto) {
    return this.shiftTimesheetService.update(id, updateShiftTimesheetDto);
  }

  @Delete(':id')
  @RequireEmployeePermission(EmployeePermissionType.approve_timesheets)
  remove(@Param('id') id: string) {
    return this.shiftTimesheetService.remove(id);
  }

  @Post(':id/approve')
  @RequireEmployeePermission(EmployeePermissionType.approve_timesheets)
  approveTimesheet(
    @Param('id') id: string,
    @Body() approveTimesheetDto: ApproveTimesheetDto,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftTimesheetService.approveTimesheet(id, user_id, approveTimesheetDto);
  }

  @Post(':id/reject')
  @RequireEmployeePermission(
    EmployeePermissionType.approve_timesheets,
    EmployeePermissionType.dispute_timesheets,
  )
  rejectTimesheet(
    @Param('id') id: string,
    @Body() rejectTimesheetDto: RejectTimesheetDto,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftTimesheetService.rejectTimesheet(id, user_id, rejectTimesheetDto);
  }
}
