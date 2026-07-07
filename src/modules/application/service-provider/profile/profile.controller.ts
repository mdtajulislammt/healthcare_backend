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
  UploadedFile,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateServiceProviderProfileDto } from './dto/update-service-provider-profile.dto';
import { UpdateBusinessInfoDto } from './dto/update-business-info.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { ActivityLogService } from 'src/common/service/activity-log.service';

@ApiTags('Service Provider - Profile')
@ApiBearerAuth()
@Controller('application/service-provider/profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @ApiOperation({ summary: 'Create profile placeholder' })
  @Post()
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profileService.create(createProfileDto);
  }

  @ApiOperation({ summary: 'Get all profile placeholders' })
  @Get()
  findAll() {
    return this.profileService.findAll();
  }

  @ApiOperation({ summary: 'Get service provider profile' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SERVICE_PROVIDER)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getServiceProviderProfile(@Req() req: Request) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.profileService.getServiceProviderProfile(user_id);
  }

  @ApiOperation({ summary: 'Get profile placeholder by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profileService.findOne(+id);
  }

  @ApiOperation({ summary: 'Update service provider profile info' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SERVICE_PROVIDER)
  @Patch('info')
  @UseInterceptors(
    FileInterceptor('brand_logo', {
      storage: memoryStorage(),
    }),
  )
  @HttpCode(HttpStatus.OK)
  async updateServiceProviderProfile(
    @Req() req: Request,
    @Body() updateServiceProviderProfileDto: UpdateServiceProviderProfileDto,
    @UploadedFile() brandLogoFile?: Express.Multer.File,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.profileService.updateServiceProviderProfile(
      user_id,
      updateServiceProviderProfileDto,
      brandLogoFile,
    );
  }

  @ApiOperation({ summary: 'Update service provider business info' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SERVICE_PROVIDER)
  @Patch('business-info')
  @UseInterceptors(
    FileInterceptor('support_documents', {
      storage: memoryStorage(),
    }),
  )
  @HttpCode(HttpStatus.OK)
  async updateBusinessInfo(
    @Req() req: Request,
    @Body() updateBusinessInfoDto: UpdateBusinessInfoDto,
    @UploadedFile() supportDocumentsFile?: Express.Multer.File,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.profileService.updateBusinessInfo(
      user_id,
      updateBusinessInfoDto,
      supportDocumentsFile,
    );
  }

  @ApiOperation({ summary: 'Update profile placeholder' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profileService.update(+id, updateProfileDto);
  }

  @ApiOperation({ summary: 'Remove profile placeholder' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.profileService.remove(+id);
  }

  @ApiOperation({
    summary: 'Get recent activities for logged-in service provider',
  })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'action_type', required: false, type: String })
  @Get('activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SERVICE_PROVIDER)
  getActivities(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action_type') actionType?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.activityLogService.getUserActivities(user_id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      actionType: actionType as any,
    });
  }
}
