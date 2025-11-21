import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Service Provider - Employees')
@ApiBearerAuth()
@Controller('application/service-provider/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SERVICE_PROVIDER)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) { }

  @ApiOperation({ summary: 'Create a new employee' })
  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
    }),
  )
  async create(
    @Req() req: Request,
    @Body() createEmployeeDto: CreateEmployeeDto,
    @UploadedFile() photoFile?: Express.Multer.File,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.employeeService.create(user_id, createEmployeeDto, photoFile);
  }

  @ApiOperation({ summary: 'Get all employees for service provider' })
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('service_provider_id') serviceProviderId?: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.employeeService.findAll(user_id, serviceProviderId);
  }

  @ApiOperation({ summary: 'Get employee by ID' })
  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.employeeService.findOne(user_id, id);
  }

  @ApiOperation({ summary: 'Update employee information' })
  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
    }),
  )
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @UploadedFile() photoFile?: Express.Multer.File,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.employeeService.update(user_id, id, updateEmployeeDto, photoFile);
  }

  @ApiOperation({ summary: 'Assign permissions to employee' })
  @Post(':id/permissions')
  async assignPermissions(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() assignPermissionDto: AssignPermissionDto,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    return this.employeeService.assignPermissions(user_id, id, assignPermissionDto);
  }

  @ApiOperation({ summary: 'Update employee status (activate/deactivate)' })
  @Patch(':id/status')
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('is_active') isActive: string,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }

    const isActiveBool = isActive === 'true' || isActive === '1';
    return this.employeeService.updateStatus(user_id, id, isActiveBool);
  }
}
