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
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApplyShiftService } from './apply-shift.service';
import { CreateApplyShiftDto } from './dto/create-apply-shift.dto';
import { UpdateApplyShiftDto } from './dto/update-apply-shift.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';

@Controller('application/staff/shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF)
export class ApplyShiftController {
  constructor(private readonly applyShiftService: ApplyShiftService) {}

  @Post()
  create(
    @Body() createApplyShiftDto: CreateApplyShiftDto,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.applyShiftService.create(createApplyShiftDto, user_id);
  }

  @Get()
  async findAll(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('staff_latitude') staff_latitude?: string,
    @Query('staff_longitude') staff_longitude?: string,
    @Query('status') status?: string,
    @Query('max_distance_miles') max_distance_miles?: string,
    @Query('max_distance_km') max_distance_km?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.applyShiftService.findAll({
      user_id,
      page,
      limit,
      search,
      staff_latitude,
      staff_longitude,
      status,
      max_distance_miles,
      max_distance_km,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('staff_latitude') staff_latitude?: string,
    @Query('staff_longitude') staff_longitude?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.applyShiftService.findOne(
      id,
      user_id,
      staff_latitude,
      staff_longitude,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateApplyShiftDto: UpdateApplyShiftDto,
  ) {
    return this.applyShiftService.update(id, updateApplyShiftDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.applyShiftService.remove(id);
  }
}
