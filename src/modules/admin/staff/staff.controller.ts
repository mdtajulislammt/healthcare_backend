import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { UpdateCertificateStatusDto } from './dto/update-certificate-status.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'photo', maxCount: 1 },
      { name: 'cv', maxCount: 1 },
      { name: 'care_certificate', maxCount: 1 },
      { name: 'moving_handling', maxCount: 1 },
      { name: 'first_aid', maxCount: 1 },
      { name: 'basic_life_support', maxCount: 1 },
      { name: 'infection_control', maxCount: 1 },
      { name: 'safeguarding', maxCount: 1 },
      { name: 'health_safety', maxCount: 1 },
      { name: 'equality_diversity', maxCount: 1 },
      { name: 'coshh', maxCount: 1 },
      { name: 'medication_training', maxCount: 1 },
      { name: 'nvq_iii', maxCount: 1 },
      { name: 'additional_training', maxCount: 1 },
    ]),
  )
  async create(
    @Body() createStaffDto: CreateStaffDto,
    @UploadedFiles()
    files?: {
      photo?: Express.Multer.File[];
      cv?: Express.Multer.File[];
      care_certificate?: Express.Multer.File[];
      moving_handling?: Express.Multer.File[];
      first_aid?: Express.Multer.File[];
      basic_life_support?: Express.Multer.File[];
      infection_control?: Express.Multer.File[];
      safeguarding?: Express.Multer.File[];
      health_safety?: Express.Multer.File[];
      equality_diversity?: Express.Multer.File[];
      coshh?: Express.Multer.File[];
      medication_training?: Express.Multer.File[];
      nvq_iii?: Express.Multer.File[];
      additional_training?: Express.Multer.File[];
    },
  ) {
    return this.staffService.create(createStaffDto, files);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('right_to_work_status') right_to_work_status?: string,
    @Query('roles') roles?: string,
  ) {
    return this.staffService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      right_to_work_status,
      roles,
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
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'photo', maxCount: 1 },
      { name: 'cv', maxCount: 1 },
      { name: 'current_address_evidence', maxCount: 1 },
    ]),
  )
  update(
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffDto,
    @UploadedFiles()
    files?: {
      photo?: Express.Multer.File[];
      cv?: Express.Multer.File[];
      current_address_evidence?: Express.Multer.File[];
    },
  ) {
    return this.staffService.update(
      id,
      updateStaffDto,
      files?.photo?.[0],
      files?.cv?.[0],
      files?.current_address_evidence?.[0],
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
  ) {
    return this.staffService.updateStatus(id, dto.status);
  }

  @Patch('certificates/:certificateId/status')
  async updateCertificateStatus(
    @Param('certificateId') certificateId: string,
    @Body() dto: UpdateCertificateStatusDto,
  ) {
    return this.staffService.updateCertificateStatus(
      certificateId,
      dto.verified_status,
    );
  }
}
