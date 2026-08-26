import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import appConfig from '../../../config/app.config';
import { ArrayHelper } from '../../helper/array.helper';
import { Role } from '../../guard/role/role.enum';

const prisma = new PrismaClient();

export class UserRepository {
  /**
   * get user by email
   * @param email
   * @returns
   */
  static async getUserByEmail(email: string) {
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    return user;
  }

  // email varification
  static async verifyEmail({ email }) {
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    return user;
  }

  /**
   * get user details
   * @returns
   */
  static async getUserDetails(userId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        role_users: {
          include: {
            role: {
              include: {
                permission_roles: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return user;
  }

  /**
   * Check existance
   * @returns
   */
  static async exist({ field, value }) {
    const model = await prisma.user.findFirst({
      where: {
        [field]: value,
      },
    });
    return model;
  }

  /**
   * Create su admin user
   * @param param0
   * @returns
   */
  static async createSuAdminUser({ username, email, password }) {
    try {
      password = await bcrypt.hash(password, appConfig().security.salt);

      const user = await prisma.user.create({
        data: {
          // username: username,
          email: email,
          password: password,
          type: 'su_admin',
        },
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Invite user under tenant
   * @param param0
   * @returns
   */
  static async inviteUser({
    name,
    username,
    email,
    role_id,
  }: {
    name: string;
    username: string;
    email: string;
    role_id: string;
  }) {
    try {
      const user = await prisma.user.create({
        data: {
          //   name: name,
          //   username: username,
          email: email,
        },
      });
      if (user) {
        // attach role
        await this.attachRole({
          user_id: user.id,
          role_id: role_id,
        });
        return user;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Attach a role to a user
   * @param param0
   * @returns
   */
  static async attachRole({
    user_id,
    role_id,
  }: {
    user_id: string;
    role_id: string;
  }) {
    const role = await prisma.roleUser.create({
      data: {
        user_id: user_id,
        role_id: role_id,
      },
    });
    return role;
  }

  /**
   * update user role
   * @param param0
   * @returns
   */
  static async syncRole({
    user_id,
    role_id,
  }: {
    user_id: string;
    role_id: string;
  }) {
    const role = await prisma.roleUser.updateMany({
      where: {
        AND: [
          {
            user_id: user_id,
          },
        ],
      },
      data: {
        role_id: role_id,
      },
    });
    return role;
  }

  /**
   * create user under a tenant
   * @param param0
   * @returns
   */
  static async createUser({
    name,
    first_name,
    last_name,
    email,
    password,
    phone_number,
    role_id = null,
    type = 'user',
  }: {
    name?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    password: string;
    phone_number?: string;
    role_id?: string;
    type?: string;
  }) {
    try {
      const data = {};
      if (name) {
        data['name'] = name;
      }
      if (first_name) {
        data['first_name'] = first_name;
      }
      if (last_name) {
        data['last_name'] = last_name;
      }
      if (phone_number) {
        data['phone_number'] = phone_number;
      }
      if (email) {
        // Check if email already exist
        const userEmailExist = await UserRepository.exist({
          field: 'email',
          value: String(email),
        });

        if (userEmailExist) {
          return {
            success: false,
            message: 'Email already exist',
          };
        }

        data['email'] = email;
      }
      if (password) {
        data['password'] = await bcrypt.hash(
          password,
          appConfig().security.salt,
        );
      }

      if (type && ArrayHelper.inArray(type, Object.values(Role))) {
        data['type'] = type;

        // if (type == Role.VENDOR) {
        //   data['approved_at'] = DateHelper.now();
        // }
      }

      const user = await prisma.user.create({
        data: {
          ...data,
        },
      });

      if (user) {
        if (role_id) {
          // attach role
          await this.attachRole({
            user_id: user.id,
            role_id: role_id,
          });
        }

        return {
          success: true,
          message: 'User created successfully',
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User creation failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * create user under a tenant
   * @param param0
   * @returns
   */
  static async updateUser(
    user_id: string,
    {
      name,
      email,
      password,
      role_id = null,
      type = 'user',
    }: {
      name?: string;
      email?: string;
      password?: string;
      role_id?: string;
      type?: string;
    },
  ) {
    try {
      const data = {};
      if (name) {
        data['name'] = name;
      }
      if (email) {
        // Check if email already exist
        const userEmailExist = await UserRepository.exist({
          field: 'email',
          value: String(email),
        });

        if (userEmailExist) {
          return {
            success: false,
            message: 'Email already exist',
          };
        }
        data['email'] = email;
      }
      if (password) {
        data['password'] = await bcrypt.hash(
          password,
          appConfig().security.salt,
        );
      }

      if (ArrayHelper.inArray(type, Object.values(Role))) {
        data['type'] = type;
      } else {
        return {
          success: false,
          message: 'Invalid user type',
        };
      }

      const existUser = await prisma.user.findFirst({
        where: {
          id: user_id,
        },
      });

      if (!existUser) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const user = await prisma.user.update({
        where: {
          id: user_id,
        },
        data: {
          ...data,
        },
      });

      if (user) {
        if (role_id) {
          // attach role
          await this.attachRole({
            user_id: user.id,
            role_id: role_id,
          });
        }

        return {
          success: true,
          message: 'User updated successfully',
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User update failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * delete user
   * @param param0
   * @returns
   */
  static async deleteUser(user_id: string) {
    try {
      const existUser = await prisma.user.findFirst({
        where: {
          id: user_id,
        },
      });
      if (!existUser) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      await prisma.$transaction(async (tx) => {
        await this.hardDeleteUser(user_id, tx);
      });

      return {
        success: true,
        message: 'User permanently deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  // change password
  static async changePassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    try {
      password = await bcrypt.hash(password, appConfig().security.salt);
      const user = await prisma.user.update({
        where: {
          email: email,
        },
        data: {
          password: password,
        },
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  // change email
  static async changeEmail({
    user_id,
    new_email,
  }: {
    user_id: string;
    new_email: string;
  }) {
    try {
      const user = await prisma.user.update({
        where: {
          id: user_id,
        },
        data: {
          email: new_email,
        },
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  // validate password
  static async validatePassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    if (user) {
      const isValid = await bcrypt.compare(password, user.password);
      return isValid;
    } else {
      return false;
    }
  }

  // convert user type to admin/vendor
  static async convertTo(user_id: string, type: string = 'vendor') {
    try {
      const userDetails = await UserRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      if (userDetails.type == 'vendor') {
        return {
          success: false,
          message: 'User is already a vendor',
        };
      }
      await prisma.user.update({
        where: { id: user_id },
        data: { type: type },
      });

      return {
        success: true,
        message: 'Converted to ' + type + ' successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  // generate two factor secret
  static async generate2FASecret(user_id: string) {
    const user = await prisma.user.findFirst({
      where: { id: user_id },
    });

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    const secret = speakeasy.generateSecret();
    await prisma.user.update({
      where: { id: user_id },
      data: { two_factor_secret: secret.base32 },
    });

    const otpAuthUrl = secret.otpauth_url;

    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    return {
      success: true,
      message: '2FA secret generated successfully',
      data: {
        secret: secret.base32,
        qrCode: qrCode,
      },
    };
  }

  // verify two factor
  static async verify2FA(user_id: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: user_id } });

    if (!user || !user.two_factor_secret) return false;

    const isValid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
    });

    return isValid;
  }

  // enable two factor
  static async enable2FA(user_id: string) {
    const user = await prisma.user.update({
      where: { id: user_id },
      data: { is_two_factor_enabled: 1 },
    });
    return user;
  }

  // disable two factor
  static async disable2FA(user_id: string) {
    const user = await prisma.user.update({
      where: { id: user_id },
      data: { is_two_factor_enabled: 0, two_factor_secret: null },
    });
    return user;
  }

  // Hard delete a user and all their relational records to prevent constraint failures
  static async hardDeleteUser(userId: string, txClient?: any) {
    const client = txClient || prisma;

    // 1. Delete basic user relations
    await client.account.deleteMany({ where: { user_id: userId } });
    await client.ucode.deleteMany({ where: { user_id: userId } });
    await client.userSetting.deleteMany({ where: { user_id: userId } });
    await client.userDeviceToken.deleteMany({ where: { user_id: userId } });
    await client.userPaymentMethod.deleteMany({ where: { user_id: userId } });
    
    await client.paymentTransaction.updateMany({
      where: { user_id: userId },
      data: { user_id: null },
    });

    await client.notification.deleteMany({
      where: {
        OR: [
          { sender_id: userId },
          { receiver_id: userId },
        ],
      },
    });

    await client.message.deleteMany({
      where: {
        OR: [
          { sender_id: userId },
          { receiver_id: userId },
        ],
      },
    });

    await client.conversation.deleteMany({
      where: {
        OR: [
          { creator_id: userId },
          { participant_id: userId },
        ],
      },
    });

    await client.employee.updateMany({
      where: { user_id: userId },
      data: { user_id: null },
    });

    await client.adminProfile.deleteMany({
      where: { user_id: userId },
    });

    // 2. Handle StaffProfile and its cascade relations
    const staff = await client.staffProfile.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });

    if (staff) {
      await client.shift.updateMany({
        where: { assigned_staff_id: staff.id },
        data: { assigned_staff_id: null },
      });

      await client.shiftApplication.deleteMany({ where: { staff_id: staff.id } });
      await client.shiftAttendance.deleteMany({ where: { staff_id: staff.id } });
      await client.shiftTimesheet.deleteMany({ where: { staff_id: staff.id } });
      await client.providerStaffPreference.deleteMany({ where: { staff_id: staff.id } });
      await client.staffPerformanceReview.deleteMany({ where: { staff_id: staff.id } });
      await client.staffCertificate.deleteMany({ where: { staff_id: staff.id } });
      await client.staffDbsInfo.deleteMany({ where: { staff_id: staff.id } });
      await client.staffEmergencyContact.deleteMany({ where: { staff_id: staff.id } });
      await client.staffEducation.deleteMany({ where: { staff_id: staff.id } });
      await client.staffCurrentAddress.deleteMany({ where: { staff_id: staff.id } });
      await client.staffPreviousAddress.deleteMany({ where: { staff_id: staff.id } });
      await client.staffReferee.deleteMany({ where: { staff_id: staff.id } });
      await client.staffBankDetails.deleteMany({ where: { staff_id: staff.id } });
      
      await client.staffProfile.delete({ where: { id: staff.id } });
    }

    // 3. Handle ServiceProviderInfo and its cascade relations
    const provider = await client.serviceProviderInfo.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });

    if (provider) {
      await client.providerPayRateByRole.deleteMany({ where: { service_provider_id: provider.id } });

      const shifts = await client.shift.findMany({
        where: { service_provider_id: provider.id },
        select: { id: true },
      });
      const shiftIds = shifts.map((s: any) => s.id);

      await client.shiftApplication.deleteMany({ where: { shift_id: { in: shiftIds } } });
      await client.shiftAttendance.deleteMany({ where: { shift_id: { in: shiftIds } } });
      await client.shiftTimesheet.deleteMany({ where: { shift_id: { in: shiftIds } } });
      await client.staffPerformanceReview.deleteMany({ where: { shift_id: { in: shiftIds } } });
      await client.shift.deleteMany({ where: { service_provider_id: provider.id } });

      await client.providerStaffPreference.deleteMany({ where: { provider_id: provider.id } });
      await client.staffPerformanceReview.deleteMany({ where: { provider_id: provider.id } });

      const employees = await client.employee.findMany({
        where: { service_provider_id: provider.id },
        select: { id: true },
      });
      const employeeIds = employees.map((e: any) => e.id);

      await client.employeePermission.deleteMany({ where: { employee_id: { in: employeeIds } } });
      await client.employee.deleteMany({ where: { service_provider_id: provider.id } });

      await client.serviceProviderInfo.delete({ where: { id: provider.id } });
    }

    // 4. Delete ActivityLogs & RoleUsers & User itself
    await client.activityLog.deleteMany({ where: { user_id: userId } });
    await client.roleUser.deleteMany({ where: { user_id: userId } });
    await client.user.delete({ where: { id: userId } });
  }
}
