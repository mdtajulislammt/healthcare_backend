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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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

@ApiTags('Service Provider - Profile')
@Controller('application/service-provider/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) { }

  @Post()
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profileService.create(createProfileDto);
  }

  @Get()
  findAll() {
    return this.profileService.findAll();
  }

  @ApiOperation({ summary: 'Get service provider profile' })
  @ApiBearerAuth()
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profileService.findOne(+id);
  }

  @ApiOperation({ summary: 'Update service provider profile info' })
  @ApiBearerAuth()
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

    return this.profileService.updateServiceProviderProfile(user_id, updateServiceProviderProfileDto, brandLogoFile);
  }

  @ApiOperation({ summary: 'Update service provider business info' })
  @ApiBearerAuth()
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

    return this.profileService.updateBusinessInfo(user_id, updateBusinessInfoDto, supportDocumentsFile);
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
