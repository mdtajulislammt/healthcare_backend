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

@Controller('application/service-provider/shift-timesheet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SERVICE_PROVIDER)
export class ShiftTimesheetController {
  constructor(private readonly shiftTimesheetService: ShiftTimesheetService) { }

  @Post()
  create(@Body() createShiftTimesheetDto: CreateShiftTimesheetDto) {
    return this.shiftTimesheetService.create(createShiftTimesheetDto);
  }

  @Get()
  findAll() {
    return this.shiftTimesheetService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shiftTimesheetService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateShiftTimesheetDto: UpdateShiftTimesheetDto) {
    return this.shiftTimesheetService.update(id, updateShiftTimesheetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shiftTimesheetService.remove(id);
  }

  @Post(':id/approve')
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
