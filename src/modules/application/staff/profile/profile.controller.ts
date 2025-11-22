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
  HttpCode,
  HttpStatus,
  UploadedFiles,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateUpdateEducationDto } from './dto/create-update-education.dto';
import { CreateUpdateCertificateDto } from './dto/create-update-certificate.dto';
import { UpdateDbsInfoDto } from './dto/update-dbs-info.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { ActivityLogService } from 'src/common/service/activity-log.service';
import { Query } from '@nestjs/common';

@ApiTags('Staff - Profile')
@Controller('application/staff/profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly activityLogService: ActivityLogService,
  ) { }

  @ApiOperation({ summary: 'Update staff personal info and roles' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF)
  @Patch('personal-info')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'cv', maxCount: 1 },
        { name: 'current_address_evidence', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
      },
    ),
  )
  @HttpCode(HttpStatus.OK)
  async updateStaffProfile(
    @Req() req: Request,
    @Body() updateStaffProfileDto: UpdateStaffProfileDto,
    @UploadedFiles() files?: {
      photo?: Express.Multer.File[];
      cv?: Express.Multer.File[];
      current_address_evidence?: Express.Multer.File[];
    },
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    const photoFile = files?.photo?.[0];
    const cvFile = files?.cv?.[0];
    const currentAddressEvidenceFile = files?.current_address_evidence?.[0];

    return this.profileService.updateStaffProfile(
      user_id,
      updateStaffProfileDto,
      photoFile,
      cvFile,
      currentAddressEvidenceFile,
    );
  }

  @ApiOperation({ summary: 'Create or update staff education' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF)
  @Post('education')
  @HttpCode(HttpStatus.OK)
  async createOrUpdateEducation(
    @Req() req: Request,
    @Body() createUpdateEducationDto: CreateUpdateEducationDto,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.profileService.createOrUpdateEducation(user_id, createUpdateEducationDto);
  }

  @ApiOperation({ summary: 'Create or update staff certificate' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF)
  @Post('certificate')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  @HttpCode(HttpStatus.OK)
  async createOrUpdateCertificate(
    @Req() req: Request,
    @Body() createUpdateCertificateDto: CreateUpdateCertificateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.profileService.createOrUpdateCertificate(user_id, createUpdateCertificateDto, file);
  }

  @ApiOperation({ summary: 'Update staff DBS info' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF)
  @Patch('dbs-info')
  @HttpCode(HttpStatus.OK)
  async updateDbsInfo(
    @Req() req: Request,
    @Body() updateDbsInfoDto: UpdateDbsInfoDto,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.profileService.updateDbsInfo(user_id, updateDbsInfoDto);
  }

  @ApiOperation({ summary: 'Get staff profile with all related data' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STAFF)
  @Get('me')
  async getStaffProfile(@Req() req: Request) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.profileService.getStaffProfile(user_id);
  }

  @Post()
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profileService.create(createProfileDto);
  }

  @Get()
  findAll() {
    return this.profileService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profileService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profileService.update(+id, updateProfileDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.profileService.remove(+id);
  }
}
