import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { UpdateCertificateStatusDto } from './dto/update-certificate-status.dto';

@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) { }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.staffService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('stats')
  async getStats() {
    return this.staffService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) {
    return this.staffService.update(id, updateStaffDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStaffStatusDto) {
    return this.staffService.updateStatus(id, dto.status);
  }

  @Patch('certificates/:certificateId/status')
  async updateCertificateStatus(
    @Param('certificateId') certificateId: string,
    @Body() dto: UpdateCertificateStatusDto,
  ) {
    return this.staffService.updateCertificateStatus(certificateId, dto.verified_status);
  }
}
