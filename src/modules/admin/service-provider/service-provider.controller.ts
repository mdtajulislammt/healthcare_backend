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
} from '@nestjs/common';
import { ServiceProviderService } from './service-provider.service';
import { CreateServiceProviderDto } from './dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from './dto/update-service-provider.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { UpdateEmergencyBonusDto } from './dto/update-emergency-bonus.dto';
import { UpdatePayRateByRoleDto } from 'src/modules/admin/service-provider/dto/update-pay-rate-by-role.dto';
import { UpdatePayRatesByRoleDto } from 'src/modules/admin/service-provider/dto/update-pay-rates-by-role.dto';

@Controller('admin/service-provider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ServiceProviderController {
  constructor(
    private readonly serviceProviderService: ServiceProviderService,
  ) {}

  @Post()
  create(@Body() createServiceProviderDto: CreateServiceProviderDto) {
    return this.serviceProviderService.create(createServiceProviderDto);
  }

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

  @Get('stats')
  getStats() {
    return this.serviceProviderService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceProviderService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateServiceProviderDto: UpdateServiceProviderDto,
  ) {
    return this.serviceProviderService.update(id, updateServiceProviderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceProviderService.remove(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: number) {
    return this.serviceProviderService.updateStatus(id, Number(status));
  }

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

  @Get(':id/pay-rate-by-role')
  getPayRatesByRole(@Param('id') id: string, @Query('role') role?: string) {
    return this.serviceProviderService.getPayRatesByRole(id, role);
  }

  // @Patch(':id/pay-rate-by-role')
  // updatePayRateByRole(
  //   @Param('id') id: string,
  //   @Body() updatePayRateByRoleDto: UpdatePayRateByRoleDto,
  // ) {
  //   return this.serviceProviderService.updatePayRateByRole(id, updatePayRateByRoleDto);
  // }

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
