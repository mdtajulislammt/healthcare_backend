import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, BadRequestException, Req } from '@nestjs/common';
import { ApplyShiftService } from './apply-shift.service';
import { CreateApplyShiftDto } from './dto/create-apply-shift.dto';
import { UpdateApplyShiftDto } from './dto/update-apply-shift.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('application/staff/shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF)
export class ApplyShiftController {
  constructor(
    private readonly applyShiftService: ApplyShiftService,
    private readonly prisma: PrismaService,
  ) { }

  @Post()
  create(@Body() createApplyShiftDto: CreateApplyShiftDto, @Req() req: Request) {
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
    // Get user_id from authenticated user
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    // Get staff_id from user_id
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { user_id },
      select: { id: true },
    });

    if (!staffProfile) {
      throw new BadRequestException('Staff profile not found. Please complete your profile first.');
    }

    const staff_id = staffProfile.id;

    // Validate coordinates if provided
    let staffLat: number | undefined;
    let staffLng: number | undefined;

    if (staff_latitude !== undefined || staff_longitude !== undefined) {
      if (staff_latitude === undefined || staff_longitude === undefined) {
        throw new BadRequestException('Both staff_latitude and staff_longitude must be provided together');
      }

      staffLat = Number(staff_latitude);
      staffLng = Number(staff_longitude);

      if (isNaN(staffLat) || isNaN(staffLng)) {
        throw new BadRequestException('Invalid coordinates. Must be valid numbers');
      }

      // Validate latitude range (-90 to 90)
      if (staffLat < -90 || staffLat > 90) {
        throw new BadRequestException('Invalid latitude. Must be between -90 and 90');
      }

      // Validate longitude range (-180 to 180)
      if (staffLng < -180 || staffLng > 180) {
        throw new BadRequestException('Invalid longitude. Must be between -180 and 180');
      }
    }

    // Validate distance filters
    let maxDistanceMiles: number | undefined;
    let maxDistanceKm: number | undefined;

    if (max_distance_miles !== undefined) {
      maxDistanceMiles = Number(max_distance_miles);
      if (isNaN(maxDistanceMiles) || maxDistanceMiles < 0) {
        throw new BadRequestException('max_distance_miles must be a valid positive number');
      }
    }

    if (max_distance_km !== undefined) {
      maxDistanceKm = Number(max_distance_km);
      if (isNaN(maxDistanceKm) || maxDistanceKm < 0) {
        throw new BadRequestException('max_distance_km must be a valid positive number');
      }
    }

    // Validate that distance filter requires staff coordinates
    if ((maxDistanceMiles !== undefined || maxDistanceKm !== undefined) && (staffLat === undefined || staffLng === undefined)) {
      throw new BadRequestException('staff_latitude and staff_longitude are required when using distance filters');
    }

    return this.applyShiftService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      staff_id,
      staff_latitude: staffLat,
      staff_longitude: staffLng,
      status,
      max_distance_miles: maxDistanceMiles,
      max_distance_km: maxDistanceKm,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('staff_latitude') staff_latitude?: string,
    @Query('staff_longitude') staff_longitude?: string,
  ) {
    // Get user_id from authenticated user
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    // Get staff_id from user_id
    const staffProfile = await this.prisma.staffProfile.findUnique({
      where: { user_id },
      select: { id: true },
    });

    if (!staffProfile) {
      throw new BadRequestException('Staff profile not found. Please complete your profile first.');
    }

    const staff_id = staffProfile.id;

    // Validate coordinates if provided
    let staffLat: number | undefined;
    let staffLng: number | undefined;

    if (staff_latitude !== undefined || staff_longitude !== undefined) {
      if (staff_latitude === undefined || staff_longitude === undefined) {
        throw new BadRequestException('Both staff_latitude and staff_longitude must be provided together');
      }

      staffLat = Number(staff_latitude);
      staffLng = Number(staff_longitude);

      if (isNaN(staffLat) || isNaN(staffLng)) {
        throw new BadRequestException('Invalid coordinates. Must be valid numbers');
      }

      // Validate latitude range (-90 to 90)
      if (staffLat < -90 || staffLat > 90) {
        throw new BadRequestException('Invalid latitude. Must be between -90 and 90');
      }

      // Validate longitude range (-180 to 180)
      if (staffLng < -180 || staffLng > 180) {
        throw new BadRequestException('Invalid longitude. Must be between -180 and 180');
      }
    }

    return this.applyShiftService.findOne(id, staff_id, staffLat, staffLng);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateApplyShiftDto: UpdateApplyShiftDto) {
    return this.applyShiftService.update(id, updateApplyShiftDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.applyShiftService.remove(id);
  }
}
