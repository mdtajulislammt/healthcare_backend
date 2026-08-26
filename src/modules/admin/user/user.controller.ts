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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@ApiTags('User')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.ADMIN)
@Controller('admin/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ description: 'Create a user' })
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.userService.create(createUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Create a new admin user' })
  @ApiResponse({ description: 'Create an admin user' })
  @Post('admin')
  async createAdminUser(@Body() createAdminUserDto: CreateAdminUserDto) {
    try {
      const result = await this.userService.createAdminUser(createAdminUserDto);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Delete an admin user' })
  @ApiResponse({ description: 'Delete an admin user' })
  @Delete('admin/:id')
  async deleteAdminUser(@Param('id') id: string) {
    try {
      const result = await this.userService.deleteAdminUser(id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Get all admin users' })
  @ApiResponse({ description: 'Get all admin users' })
  @Get('admin')
  async findAllAdmins() {
    try {
      const result = await this.userService.findAllAdmins();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Get all users with search, filtering, and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term across email, name, organization, phone number, CQC' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Alias for search' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'User type filter (staff, service_provider, admin, user, all)' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Status filter (0/pending, 1/active, 2/suspended, all)' })
  @ApiQuery({ name: 'approved', required: false, type: String, description: 'Approval status filter (approved, pending, all)' })
  @ApiQuery({ name: 'is_verified', required: false, type: String, description: 'Email verification filter (true, false, verified, unverified, all)' })
  @ApiQuery({ name: 'from_date', required: false, type: String, description: 'Created on/after date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to_date', required: false, type: String, description: 'Created on/before date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'sort_by', required: false, type: String, description: 'Field to sort by (created_at, updated_at, email, type, status, approved_at)' })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'], description: 'Sort order (asc, desc)' })
  @ApiResponse({ description: 'List of users with pagination and applied filters' })
  @Get()
  async findAll(@Query() query: FindUsersDto) {
    try {
      const users = await this.userService.findAll(query);
      return users;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  // approve user
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve a user registration' })
  @ApiResponse({ description: 'Approve a user' })
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    try {
      const user = await this.userService.approve(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  // reject user
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a user registration' })
  @ApiResponse({ description: 'Reject a user' })
  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    try {
      const user = await this.userService.reject(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Get details of a user by ID' })
  @ApiResponse({ description: 'Get a user by id' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const user = await this.userService.findOne(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Update user settings' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userService.update(id, updateUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Delete user account' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const user = await this.userService.remove(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}
