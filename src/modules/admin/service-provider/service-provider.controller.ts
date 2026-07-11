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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ServiceProviderService } from './service-provider.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { UpdateEmergencyBonusDto } from './dto/update-emergency-bonus.dto';
import { UpdatePayRatesByRoleDto } from 'src/modules/admin/service-provider/dto/update-pay-rates-by-role.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Admin - Service Provider')
@ApiBearerAuth()
@Controller('admin/service-provider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ServiceProviderController {
  constructor(
    private readonly serviceProviderService: ServiceProviderService,
  ) {}

  @ApiOperation({ summary: 'Create a new service provider profile' })
  @ApiConsumes('multipart/form-data')
  @Post()
  @UseInterceptors(FileInterceptor('brand_logo'))
  create(
    @Body() createServiceProviderDto: CreateServiceProviderDto,
    @UploadedFile() brand_logo?: Express.Multer.File,
  ) {
    return this.serviceProviderService.create(
      createServiceProviderDto,
      brand_logo,
    );
  }

  @ApiOperation({ summary: 'Get all service providers with filters' })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'main_service_type', required: false, type: String })
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('main_service_type') main_service_type?: string,
  ) {
    return this.serviceProviderService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      main_service_type,
    });
  }

  @ApiOperation({ summary: 'Get service provider statistics' })
  @Get('stats')
  getStats() {
    return this.serviceProviderService.getStats();
  }

  @ApiOperation({ summary: 'Get a single service provider by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceProviderService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a service provider profile' })
  @ApiConsumes('multipart/form-data')
  @Patch(':id')
  @UseInterceptors(FileInterceptor('brand_logo'))
  update(
    @Param('id') id: string,
    @Body() updateServiceProviderDto: UpdateServiceProviderDto,
    @UploadedFile() brand_logo?: Express.Multer.File,
  ) {
    return this.serviceProviderService.update(
      id,
      updateServiceProviderDto,
      brand_logo,
    );
  }

  @ApiOperation({ summary: 'Remove a service provider profile by ID' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceProviderService.remove(id);
  }

  @ApiOperation({ summary: 'Update approval status of a service provider' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'number',
          description: '0 (pending), 1 (active), 2 (suspended)',
          example: 1,
        },
      },
      required: ['status'],
    },
  })
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: number) {
    return this.serviceProviderService.updateStatus(id, Number(status));
  }

  @ApiOperation({
    summary: 'Update emergency bonus setting of a service provider',
  })
  @Patch(':id/emergency-bonus')
  updateEmergencyBonus(
    @Param('id') id: string,
    @Body() updateEmergencyBonusDto: UpdateEmergencyBonusDto,
  ) {
    return this.serviceProviderService.updateEmergencyBonus(
      id,
      updateEmergencyBonusDto,
    );
  }

  @ApiOperation({ summary: 'Get pay rates by role for a service provider' })
  @ApiQuery({ name: 'role', required: false, type: String })
  @Get(':id/pay-rate-by-role')
  getPayRatesByRole(@Param('id') id: string, @Query('role') role?: string) {
    return this.serviceProviderService.getPayRatesByRole(id, role);
  }

  @ApiOperation({ summary: 'Update pay rates by role for a service provider' })
  @Patch(':id/pay-rate-by-role')
  updatePayRatesByRole(
    @Param('id') id: string,
    @Body() updatePayRatesByRoleDto: UpdatePayRatesByRoleDto,
  ) {
    return this.serviceProviderService.updatePayRatesByRole(
      id,
      updatePayRatesByRoleDto,
    );
  }
}
