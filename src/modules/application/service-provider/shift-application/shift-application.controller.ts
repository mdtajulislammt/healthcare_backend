import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShiftApplicationService } from './shift-application.service';
import { CreateShiftApplicationDto } from './dto/create-shift-application.dto';
import { UpdateShiftApplicationDto } from './dto/update-shift-application.dto';
import { AcceptApplicationDto } from './dto/accept-application.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';
import { EmployeePermissionGuard } from 'src/common/guard/employee-permission/employee-permission.guard';
import { RequireEmployeePermission } from 'src/common/guard/employee-permission/employee-permission.decorator';
import { EmployeePermissionType } from '@prisma/client';

@ApiTags('Service Provider - Shift Applications')
@Controller('application/shift-applications')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
@Roles(Role.SERVICE_PROVIDER, Role.EMPLOYEE)
@ApiBearerAuth()
export class ShiftApplicationController {
  constructor(private readonly shiftApplicationService: ShiftApplicationService) { }

  @Post()
  @RequireEmployeePermission(EmployeePermissionType.assign_shift_applicants)
  create(@Body() createShiftApplicationDto: CreateShiftApplicationDto) {
    return this.shiftApplicationService.create(createShiftApplicationDto);
  }

  @Get()
  @RequireEmployeePermission(EmployeePermissionType.assign_shift_applicants)
  findAll(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('dateOrder') dateOrder?: 'asc' | 'desc',
    @Query('shiftId') shiftId?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftApplicationService.findAll(user_id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      dateOrder,
      shiftId,
    });
  }

  @Get(':id')
  @RequireEmployeePermission(EmployeePermissionType.assign_shift_applicants)
  findOne(@Param('id') id: string) {
    return this.shiftApplicationService.findOne(+id);
  }

  @Get(':id/profile')
  @RequireEmployeePermission(EmployeePermissionType.assign_shift_applicants)
  viewApplicantProfile(@Param('id') id: string, @Req() req: Request) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftApplicationService.viewApplicantProfile(id, user_id);
  }

  @Patch(':id')
  @RequireEmployeePermission(EmployeePermissionType.assign_shift_applicants)
  update(@Param('id') id: string, @Body() updateShiftApplicationDto: UpdateShiftApplicationDto) {
    return this.shiftApplicationService.update(+id, updateShiftApplicationDto);
  }

  @Delete(':id')
  @RequireEmployeePermission(EmployeePermissionType.assign_shift_applicants)
  remove(@Param('id') id: string) {
    return this.shiftApplicationService.remove(+id);
  }

  /**
   * Accept or reject a shift application
   * @param id - Application ID
   * @param acceptApplicationDto - DTO containing action and optional notes
   * @param req - Request object to get user_id from JWT
   */
  @Post(':id/accept')
  @RequireEmployeePermission(EmployeePermissionType.assign_shift_applicants)
  acceptApplication(
    @Param('id') id: string,
    @Body() acceptApplicationDto: AcceptApplicationDto,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.shiftApplicationService.acceptApplication(id, user_id, acceptApplicationDto);
  }
}
