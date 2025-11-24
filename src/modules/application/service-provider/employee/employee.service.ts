import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { UserRepository } from 'src/common/repository/user/user.repository';
import { MailService } from 'src/mail/mail.service';
import { EmployeePermissionType, EmployeeRole } from '@prisma/client';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';
import { ActivityLogService } from 'src/common/service/activity-log.service';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly activityLogService: ActivityLogService,
  ) { }

  /**
   * Create a new employee for a service provider
   */
  async create(
    serviceProviderUserId: string,
    createEmployeeDto: CreateEmployeeDto,
    photoFile?: Express.Multer.File,
  ) {
    try {
      // Get service provider info from authenticated user
      const user = await this.prisma.user.findUnique({
        where: { id: serviceProviderUserId },
        include: {
          service_provider_info: true,
        },
      });

      if (!user || !user.service_provider_info) {
        throw new NotFoundException('Service provider profile not found. Please complete your profile first.');
      }

      // Use service_provider_id from user's profile, or from DTO if provided
      const serviceProviderId = createEmployeeDto.service_provider_id || user.service_provider_info.id;

      // Verify service provider access (if service_provider_id was provided in DTO, verify it matches)
      if (createEmployeeDto.service_provider_id && createEmployeeDto.service_provider_id !== user.service_provider_info.id) {
        throw new ForbiddenException('You can only create employees for your own service provider');
      }

      const serviceProvider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id: serviceProviderId },
      });

      if (!serviceProvider) {
        throw new NotFoundException('Service provider not found');
      }

      // Check if email already exists in User table
      const existingUser = await UserRepository.exist({
        field: 'email',
        value: createEmployeeDto.email,
      });

      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }

      // Check if email already exists in Employee table
      const existingEmployee = await this.prisma.employee.findUnique({
        where: { email: createEmployeeDto.email },
      });

      if (existingEmployee) {
        throw new BadRequestException('Employee with this email already exists');
      }

      // Create User account (User model doesn't have first_name/last_name, those are in Employee model)
      const userResult = await UserRepository.createUser({
        email: createEmployeeDto.email,
        password: createEmployeeDto.password,
        type: 'employee',
      });

      if (!userResult.success) {
        throw new BadRequestException(userResult.message || 'Failed to create user account');
      }

      const userId = userResult.data.id;

      // Verify email and approve user automatically (since service provider is creating the employee)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          email_verified_at: new Date(),
          status: 1, // Approved
          approved_at: new Date(),
          onboarding_step: 'completed',
        },
      });

      // Handle photo upload if provided
      let photoFileName: string | undefined = undefined;
      if (photoFile) {
        photoFileName = `${StringHelper.randomString()}${photoFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.avatar + photoFileName,
          photoFile.buffer,
        );
      }

      // Create Employee record
      const employee = await this.prisma.employee.create({
        data: {
          user_id: userId,
          service_provider_id: serviceProviderId,
          first_name: createEmployeeDto.first_name,
          last_name: createEmployeeDto.last_name,
          email: createEmployeeDto.email,
          mobile_code: createEmployeeDto.mobile_code,
          mobile_number: createEmployeeDto.mobile_number,
          photo_url: photoFileName,
          employee_role: createEmployeeDto.employee_role,
          is_active: true,
        },
      });

      // Assign default permissions based on role
      const defaultPermissions = this.getDefaultPermissionsForRole(createEmployeeDto.employee_role);

      // Merge with custom permissions if provided
      const permissionsToAssign = createEmployeeDto.permissions
        ? [...new Set([...defaultPermissions, ...createEmployeeDto.permissions])]
        : defaultPermissions;

      // Create employee permissions
      if (permissionsToAssign.length > 0) {
        await Promise.all(
          permissionsToAssign.map((permission) =>
            this.prisma.employeePermission.create({
              data: {
                employee_id: employee.id,
                permission: permission,
                is_granted: true,
              },
            }),
          ),
        );
      }

      // Send welcome email with credentials to employee
      await this.mailService.sendEmployeeCredentials({
        email: createEmployeeDto.email,
        name: `${createEmployeeDto.first_name} ${createEmployeeDto.last_name}`,
        password: createEmployeeDto.password, // Send plain password as it's a new account
        organizationName: user.service_provider_info.organization_name,
      });

      // Log activity
      await this.activityLogService.logEmployeeCreate(
        serviceProviderUserId,
        employee.id,
        `${createEmployeeDto.first_name} ${createEmployeeDto.last_name}`,
        createEmployeeDto.employee_role,
      );

      // Fetch created employee with permissions
      const createdEmployee = await this.findOne(serviceProviderUserId, employee.id);

      return {
        success: true,
        message: 'Employee created successfully. Email verified, account approved, and credentials sent via email.',
        data: createdEmployee.data,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to create employee');
    }
  }

  /**
   * Get all employees for a service provider
   */
  async findAll(serviceProviderUserId: string, serviceProviderId?: string) {
    try {
      // Get service provider info from authenticated user
      const user = await this.prisma.user.findUnique({
        where: { id: serviceProviderUserId },
        include: {
          service_provider_info: true,
        },
      });

      if (!user || !user.service_provider_info) {
        throw new NotFoundException('Service provider profile not found. Please complete your profile first.');
      }

      // Use service_provider_id from user's profile, or from parameter if provided
      const finalServiceProviderId = serviceProviderId || user.service_provider_info.id;

      // Verify service provider access (if service_provider_id was provided, verify it matches)
      if (serviceProviderId && serviceProviderId !== user.service_provider_info.id) {
        throw new ForbiddenException('You can only view employees for your own service provider');
      }

      const serviceProvider = await this.prisma.serviceProviderInfo.findUnique({
        where: { id: finalServiceProviderId },
      });

      if (!serviceProvider) {
        throw new NotFoundException('Service provider not found');
      }

      const employees = await this.prisma.employee.findMany({
        where: {
          service_provider_id: finalServiceProviderId,
        },
        include: {
          permissions: {
            where: {
              is_granted: true,
            },
            select: {
              id: true,
              permission: true,
              is_granted: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // Fetch user data separately for each employee and format photo URLs
      const employeesWithUsers = await Promise.all(
        employees.map(async (employee) => {
          let user = null;
          if (employee.user_id) {
            user = await this.prisma.user.findUnique({
              where: { id: employee.user_id },
              select: {
                id: true,
                email: true,
                type: true,
                email_verified_at: true,
              },
            });
          }

          // Format photo URL if exists
          let formattedPhotoUrl: string | null = null;
          if (employee.photo_url) {
            formattedPhotoUrl = SojebStorage.url(
              appConfig().storageUrl.avatar + employee.photo_url,
            );
          }

          return {
            ...employee,
            photo_url: formattedPhotoUrl,
            user,
          };
        }),
      );

      return {
        success: true,
        message: 'Employees fetched successfully',
        data: employeesWithUsers,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to fetch employees');
    }
  }

  /**
   * Get a single employee by ID
   */
  async findOne(serviceProviderUserId: string, employeeId: string) {
    try {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          permissions: {
            where: {
              is_granted: true,
            },
            select: {
              id: true,
              permission: true,
              is_granted: true,
            },
          },
          service_provider_info: {
            select: {
              id: true,
              user_id: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      // Verify service provider access
      if (employee.service_provider_info.user_id !== serviceProviderUserId) {
        throw new ForbiddenException('Access denied');
      }

      // Fetch user data if exists
      let user = null;
      if (employee.user_id) {
        user = await this.prisma.user.findUnique({
          where: { id: employee.user_id },
          select: {
            id: true,
            email: true,
            type: true,
            email_verified_at: true,
          },
        });
      }

      // Format photo URL if exists
      let formattedPhotoUrl: string | null = null;
      if (employee.photo_url) {
        formattedPhotoUrl = SojebStorage.url(
          appConfig().storageUrl.avatar + employee.photo_url,
        );
      }

      return {
        success: true,
        message: 'Employee fetched successfully',
        data: {
          ...employee,
          photo_url: formattedPhotoUrl,
          user,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to fetch employee');
    }
  }

  /**
   * Update employee information
   */
  async update(
    serviceProviderUserId: string,
    employeeId: string,
    updateEmployeeDto: UpdateEmployeeDto,
    photoFile?: Express.Multer.File,
  ) {
    try {
      // Verify employee exists and service provider has access
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          service_provider_info: {
            select: {
              user_id: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      if (employee.service_provider_info.user_id !== serviceProviderUserId) {
        throw new ForbiddenException('Access denied');
      }

      // Check email uniqueness if email is being updated
      if (updateEmployeeDto.email && updateEmployeeDto.email !== employee.email) {
        const existingUser = await UserRepository.exist({
          field: 'email',
          value: updateEmployeeDto.email,
        });

        if (existingUser) {
          throw new BadRequestException('Email already exists');
        }

        const existingEmployee = await this.prisma.employee.findUnique({
          where: { email: updateEmployeeDto.email },
        });

        if (existingEmployee) {
          throw new BadRequestException('Employee with this email already exists');
        }
      }

      // Update employee
      const updateData: any = {};
      if (updateEmployeeDto.first_name) updateData.first_name = updateEmployeeDto.first_name;
      if (updateEmployeeDto.last_name) updateData.last_name = updateEmployeeDto.last_name;
      if (updateEmployeeDto.mobile_code !== undefined) updateData.mobile_code = updateEmployeeDto.mobile_code;
      if (updateEmployeeDto.mobile_number !== undefined) updateData.mobile_number = updateEmployeeDto.mobile_number;
      if (updateEmployeeDto.employee_role) updateData.employee_role = updateEmployeeDto.employee_role;
      if (updateEmployeeDto.is_active !== undefined) updateData.is_active = updateEmployeeDto.is_active;

      // Handle photo upload if provided
      const existingPhotoUrl = employee.photo_url;
      if (photoFile) {
        // Delete old photo if exists
        if (existingPhotoUrl) {
          try {
            await SojebStorage.delete(appConfig().storageUrl.avatar + existingPhotoUrl);
          } catch (error) {
            // Continue even if deletion fails
            console.error('Failed to delete old photo:', error);
          }
        }
        // Upload new photo
        const photoFileName = `${StringHelper.randomString()}${photoFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.avatar + photoFileName,
          photoFile.buffer,
        );
        updateData.photo_url = photoFileName;
      }

      const updatedEmployee = await this.prisma.employee.update({
        where: { id: employeeId },
        data: updateData,
      });

      // Update user email if provided
      if (updateEmployeeDto.email && employee.user_id) {
        await this.prisma.user.update({
          where: { id: employee.user_id },
          data: { email: updateEmployeeDto.email },
        });
      }

      // Fetch updated employee with relations (already formats photo URL)
      const result = await this.findOne(serviceProviderUserId, employeeId);

      return {
        success: true,
        message: 'Employee updated successfully',
        data: result.data,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update employee');
    }
  }

  /**
   * Assign permissions to an employee
   */
  async assignPermissions(
    serviceProviderUserId: string,
    employeeId: string,
    assignPermissionDto: AssignPermissionDto,
  ) {
    try {
      // Verify employee exists and service provider has access
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          service_provider_info: {
            select: {
              user_id: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      if (employee.service_provider_info.user_id !== serviceProviderUserId) {
        throw new ForbiddenException('Access denied');
      }

      // Remove existing permissions
      await this.prisma.employeePermission.deleteMany({
        where: { employee_id: employeeId },
      });

      // Create new permissions
      if (assignPermissionDto.permissions.length > 0) {
        await Promise.all(
          assignPermissionDto.permissions.map((permission) =>
            this.prisma.employeePermission.create({
              data: {
                employee_id: employeeId,
                permission: permission,
                is_granted: true,
              },
            }),
          ),
        );
      }

      // Fetch updated employee with permissions
      const result = await this.findOne(serviceProviderUserId, employeeId);

      return {
        success: true,
        message: 'Permissions assigned successfully',
        data: result.data,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to assign permissions');
    }
  }

  /**
   * Update employee status (activate/deactivate)
   */
  async updateStatus(
    serviceProviderUserId: string,
    employeeId: string,
    isActive: boolean,
  ) {
    try {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          service_provider_info: {
            select: {
              user_id: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      if (employee.service_provider_info.user_id !== serviceProviderUserId) {
        throw new ForbiddenException('Access denied');
      }

      const updatedEmployee = await this.prisma.employee.update({
        where: { id: employeeId },
        data: { is_active: isActive },
      });

      return {
        success: true,
        message: `Employee ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: updatedEmployee,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update employee status');
    }
  }

  /**
   * Get default permissions for a role
   */
  private getDefaultPermissionsForRole(role: EmployeeRole): EmployeePermissionType[] {
    const rolePermissionMap: Record<EmployeeRole, EmployeePermissionType[]> = {
      [EmployeeRole.manager]: [
        EmployeePermissionType.post_new_shifts,
        EmployeePermissionType.assign_shift_applicants,
        EmployeePermissionType.add_emergency_bonus,
        EmployeePermissionType.favorite_block_workers,
        EmployeePermissionType.approve_timesheets,
        EmployeePermissionType.dispute_timesheets,
        EmployeePermissionType.view_invoices,
        EmployeePermissionType.manage_team_permissions,
      ],
      [EmployeeRole.scheduler]: [
        EmployeePermissionType.post_new_shifts,
        EmployeePermissionType.assign_shift_applicants,
        EmployeePermissionType.favorite_block_workers,
      ],
      [EmployeeRole.hr_manager]: [
        EmployeePermissionType.favorite_block_workers,
        EmployeePermissionType.manage_team_permissions,
      ],
      [EmployeeRole.finance_officer]: [
        EmployeePermissionType.approve_timesheets,
        EmployeePermissionType.view_invoices,
      ],
      [EmployeeRole.compliance_officer]: [
        EmployeePermissionType.approve_timesheets,
        EmployeePermissionType.dispute_timesheets,
      ],
      [EmployeeRole.general_staff]: [],
    };

    return rolePermissionMap[role] || [];
  }
}
