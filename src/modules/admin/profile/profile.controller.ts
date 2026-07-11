import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfileService } from './profile.service';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Admin - Profile')
@Controller('admin/profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiOperation({ summary: 'Get admin profile' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAdminProfile(@Req() req: Request) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.profileService.getAdminProfile(userId);
  }

  @ApiOperation({ summary: 'Update admin profile with photo file' })
  @ApiConsumes('multipart/form-data')
  @Patch()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
    }),
  )
  @HttpCode(HttpStatus.OK)
  async updateAdminProfile(
    @Req() req: Request,
    @Body() updateAdminProfileDto: UpdateAdminProfileDto,
    @UploadedFile() photoFile?: Express.Multer.File,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.profileService.updateAdminProfile(
      userId,
      updateAdminProfileDto,
      photoFile,
    );
  }
}
