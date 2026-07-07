import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { UpdateCertificateStatusDto } from './dto/update-certificate-status.dto';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { UpdateAdminNoteDto } from './dto/update-admin-note.dto';
import { UpdateStaffCertificateDto } from './dto/update-staff-certificate.dto';

@ApiTags('Admin - Staff')
@ApiBearerAuth()
@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({ summary: 'Create a new staff profile' })
  @ApiConsumes('multipart/form-data')
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

  @ApiOperation({ summary: 'Get all staff profiles with filters' })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'right_to_work_status', required: false, type: String })
  @ApiQuery({ name: 'roles', required: false, type: String })
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

  @ApiOperation({ summary: 'Get staff general stats' })
  @Get('stats')
  async getStats() {
    return this.staffService.getStats();
  }

  @ApiOperation({ summary: 'Get a single staff profile by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a staff profile' })
  @ApiConsumes('multipart/form-data')
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

  @ApiOperation({ summary: 'Remove a staff profile by ID' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }

  @ApiOperation({ summary: 'Update staff account status' })
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
  ) {
    return this.staffService.updateStatus(id, dto.status);
  }

  @ApiOperation({ summary: 'Update verification status of a certificate' })
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

  @ApiOperation({ summary: 'Update specific staff certificate details' })
  @ApiConsumes('multipart/form-data')
  @Patch('certificates/:certificateId')
  @UseInterceptors(FileInterceptor('file'))
  async updateCertificate(
    @Param('certificateId') certificateId: string,
    @Body() dto: UpdateStaffCertificateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.staffService.updateCertificate(certificateId, dto, file);
  }

  @ApiOperation({ summary: 'Delete a staff certificate' })
  @Delete('certificates/:certificateId')
  async deleteCertificate(@Param('certificateId') certificateId: string) {
    return this.staffService.deleteCertificate(certificateId);
  }

  @ApiOperation({ summary: 'Update admin note on staff profile' })
  @Patch('admin-note/:staffId')
  async updateAdminNote(
    @Param('staffId') staffId: string,
    @Body() dto: UpdateAdminNoteDto,
  ) {
    return this.staffService.updateAdminNote(staffId, dto.admin_note);
  }
}
