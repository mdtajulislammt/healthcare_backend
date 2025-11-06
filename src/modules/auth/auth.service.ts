// external imports
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { MailService } from '../../mail/mail.service';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../common/helper/date.helper';
import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { StringHelper } from '../../common/helper/string.helper';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
  ) { }

  // async me(userId: string) {
  //   try {
  //     const user = await this.prisma.user.findFirst({
  //       where: {
  //         id: userId,
  //       },
  //       select: {
  //         id: true,
  //         name: true,
  //         email: true,
  //         avatar: true,
  //         address: true,
  //         phone_number: true,
  //         type: true,
  //         gender: true,
  //         date_of_birth: true,
  //         created_at: true,
  //       },
  //     });

  //     if (!user) {
  //       return {
  //         success: false,
  //         message: 'User not found',
  //       };
  //     }

  //     if (user.avatar) {
  //       user['avatar_url'] = SojebStorage.url(
  //         appConfig().storageUrl.avatar + user.avatar,
  //       );
  //     }

  //     if (user) {
  //       return {
  //         success: true,
  //         data: user,
  //       };
  //     } else {
  //       return {
  //         success: false,
  //         message: 'User not found',
  //       };
  //     }
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // async updateUser(
  //   userId: string,
  //   updateUserDto: UpdateUserDto,
  //   image?: Express.Multer.File,
  // ) {
  //   try {
  //     const data: any = {};
  //     if (updateUserDto.name) {
  //       data.name = updateUserDto.name;
  //     }
  //     if (updateUserDto.first_name) {
  //       data.first_name = updateUserDto.first_name;
  //     }
  //     if (updateUserDto.last_name) {
  //       data.last_name = updateUserDto.last_name;
  //     }
  //     if (updateUserDto.phone_number) {
  //       data.phone_number = updateUserDto.phone_number;
  //     }
  //     if (updateUserDto.country) {
  //       data.country = updateUserDto.country;
  //     }
  //     if (updateUserDto.state) {
  //       data.state = updateUserDto.state;
  //     }
  //     if (updateUserDto.local_government) {
  //       data.local_government = updateUserDto.local_government;
  //     }
  //     if (updateUserDto.city) {
  //       data.city = updateUserDto.city;
  //     }
  //     if (updateUserDto.zip_code) {
  //       data.zip_code = updateUserDto.zip_code;
  //     }
  //     if (updateUserDto.address) {
  //       data.address = updateUserDto.address;
  //     }
  //     if (updateUserDto.gender) {
  //       data.gender = updateUserDto.gender;
  //     }
  //     if (updateUserDto.date_of_birth) {
  //       data.date_of_birth = DateHelper.format(updateUserDto.date_of_birth);
  //     }
  //     if (image) {
  //       // delete old image from storage
  //       const oldImage = await this.prisma.user.findFirst({
  //         where: { id: userId },
  //         select: { avatar: true },
  //       });
  //       if (oldImage.avatar) {
  //         await SojebStorage.delete(
  //           appConfig().storageUrl.avatar + oldImage.avatar,
  //         );
  //       }

  //       // upload file
  //       const fileName = `${StringHelper.randomString()}${image.originalname}`;
  //       await SojebStorage.put(
  //         appConfig().storageUrl.avatar + fileName,
  //         image.buffer,
  //       );

  //       data.avatar = fileName;
  //     }
  //     const user = await UserRepository.getUserDetails(userId);
  //     if (user) {
  //       await this.prisma.user.update({
  //         where: { id: userId },
  //         data: {
  //           ...data,
  //         },
  //       });

  //       return {
  //         success: true,
  //         message: 'User updated successfully',
  //       };
  //     } else {
  //       return {
  //         success: false,
  //         message: 'User not found',
  //       };
  //     }
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  async validateUser(
    email: string,
    pass: string,
    token?: string,
  ): Promise<any> {
    const _password = pass;
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (user) {
      const _isValidPassword = await UserRepository.validatePassword({
        email: email,
        password: _password,
      });
      if (_isValidPassword) {
        const { password, ...result } = user;
        if (user.is_two_factor_enabled) {
          if (token) {
            const isValid = await UserRepository.verify2FA(user.id, token);
            if (!isValid) {
              throw new UnauthorizedException('Invalid token');
              // return {
              //   success: false,
              //   message: 'Invalid token',
              // };
            }
          } else {
            throw new UnauthorizedException('Token is required');
            // return {
            //   success: false,
            //   message: 'Token is required',
            // };
          }
        }
        return result;
      } else {
        throw new UnauthorizedException('Password not matched');
        // return {
        //   success: false,
        //   message: 'Password not matched',
        // };
      }
    } else {
      throw new UnauthorizedException('Email not found');
      // return {
      //   success: false,
      //   message: 'Email not found',
      // };
    }
  }

  async login({ email, userId }) {
    try {


      // check if user is verified
      const userVerified = await UserRepository.getUserDetails(userId);
      if (!userVerified.email_verified_at) {
        return {
          success: false,
          message: 'Email not verified',
        };
      }

      // check user approved
      const userApproved = await UserRepository.getUserDetails(userId);
      if (!userApproved.approved_at) {
        return {
          success: false,
          message: 'User not approved',
        };
      }


      const payload = { email: email, sub: userId };
      const token = this.jwtService.sign(payload);
      const user = await UserRepository.getUserDetails(userId);

      return {
        success: true,
        message: 'Logged in successfully',
        authorization: {
          token: token,
          type: 'bearer',
        },
        type: user.type,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // async register({
  //   name,
  //   first_name,
  //   last_name,
  //   email,
  //   password,
  //   type,
  // }: {
  //   name: string;
  //   first_name: string;
  //   last_name: string;
  //   email: string;
  //   password: string;
  //   type?: string;
  // }) {
  //   try {
  //     // Check if email already exist
  //     const userEmailExist = await UserRepository.exist({
  //       field: 'email',
  //       value: String(email),
  //     });

  //     if (userEmailExist) {
  //       return {
  //         statusCode: 401,
  //         message: 'Email already exist',
  //       };
  //     }

  //     const user = await UserRepository.createUser({
  //       name: name,
  //       first_name: first_name,
  //       last_name: last_name,
  //       email: email,
  //       password: password,
  //       type: type,
  //     });

  //     if (user == null && user.success == false) {
  //       return {
  //         success: false,
  //         message: 'Failed to create account',
  //       };
  //     }

  //     // create stripe customer account
  //     const stripeCustomer = await StripePayment.createCustomer({
  //       user_id: user.data.id,
  //       email: email,
  //       name: name,
  //     });

  //     if (stripeCustomer) {
  //       await this.prisma.user.update({
  //         where: {
  //           id: user.data.id,
  //         },
  //         data: {
  //           billing_id: stripeCustomer.id,
  //         },
  //       });
  //     }

  //     // ----------------------------------------------------
  //     // // create otp code
  //     // const token = await UcodeRepository.createToken({
  //     //   userId: user.data.id,
  //     //   isOtp: true,
  //     // });

  //     // // send otp code to email
  //     // await this.mailService.sendOtpCodeToEmail({
  //     //   email: email,
  //     //   name: name,
  //     //   otp: token,
  //     // });

  //     // return {
  //     //   success: true,
  //     //   message: 'We have sent an OTP code to your email',
  //     // };

  //     // ----------------------------------------------------

  //     // Generate verification token
  //     const token = await UcodeRepository.createVerificationToken({
  //       userId: user.data.id,
  //       email: email,
  //     });

  //     // Send verification email with token
  //     await this.mailService.sendVerificationLink({
  //       email,
  //       name: email,
  //       token: token.token,
  //       type: type,
  //     });

  //     return {
  //       success: true,
  //       message: 'We have sent a verification link to your email',
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  async forgotPassword(email) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // Get user name from profile
        const userProfile = await this.prisma.user.findUnique({
          where: { id: user.id },
          include: {
            staff_profile: { select: { first_name: true, last_name: true } },
            service_provider_info: { select: { first_name: true, last_name: true } },
          },
        });

        const userName = userProfile?.staff_profile
          ? `${userProfile.staff_profile.first_name} ${userProfile.staff_profile.last_name}`
          : userProfile?.service_provider_info
            ? `${userProfile.service_provider_info.first_name} ${userProfile.service_provider_info.last_name}`
            : email;

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: userName,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resetPassword({ email, token, password }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await UserRepository.changePassword({
            email: email,
            password: password,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: email,
            token: token,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verifyEmail({ email, token }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              email_verified_at: new Date(Date.now()),
            },
          });

          // delete otp code
          // await UcodeRepository.deleteToken({
          //   email: email,
          //   token: token,
          // });

          return {
            success: true,
            message: 'Email verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resendVerificationEmail(email: string) {
    try {
      const user = await UserRepository.getUserByEmail(email);

      if (user) {
        // create otp code
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // Get user name from profile
        const userProfile = await this.prisma.user.findUnique({
          where: { id: user.id },
          include: {
            staff_profile: { select: { first_name: true, last_name: true } },
            service_provider_info: { select: { first_name: true, last_name: true } },
          },
        });

        const userName = userProfile?.staff_profile
          ? `${userProfile.staff_profile.first_name} ${userProfile.staff_profile.last_name}`
          : userProfile?.service_provider_info
            ? `${userProfile.service_provider_info.first_name} ${userProfile.service_provider_info.last_name}`
            : email;

        // send otp code to email
        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: userName,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changePassword({ user_id, oldPassword, newPassword }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const _isValidPassword = await UserRepository.validatePassword({
          email: user.email,
          password: oldPassword,
        });
        if (_isValidPassword) {
          await UserRepository.changePassword({
            email: user.email,
            password: newPassword,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid password',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async requestEmailChange(user_id: string, email: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
          email: email,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: email,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: new_email,
          token: token,
          forEmailChange: true,
        });

        if (existToken) {
          await UserRepository.changeEmail({
            user_id: user.id,
            new_email: new_email,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: new_email,
            token: token,
          });

          return {
            success: true,
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // --------- 2FA ---------
  async generate2FASecret(user_id: string) {
    try {
      return await UserRepository.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verify2FA(user_id: string, token: string) {
    try {
      const isValid = await UserRepository.verify2FA(user_id, token);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async enable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.enable2FA(user_id);
        return {
          success: true,
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async disable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.disable2FA(user_id);
        return {
          success: true,
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // --------- end 2FA ---------

  // --------- Registration Flow ---------
  /**
   * Step 1: Select Account Type
   * Creates a user with account type and sets onboarding_step to "email"
   */
  async selectAccountType(type: 'staff' | 'service_provider' | 'admin') {
    try {
      // Validate account type
      if (!['staff', 'service_provider', 'admin'].includes(type)) {
        return {
          success: false,
          message: 'Invalid account type. Must be staff, service_provider, or admin',
        };
      }

      // Admin accounts should be created manually, restrict public registration
      if (type === 'admin') {
        return {
          success: false,
          message: 'Admin accounts cannot be created through public registration',
        };
      }

      // Create user with type and onboarding_step
      const user = await this.prisma.user.create({
        data: {
          type: type,
          onboarding_step: 'email',
          status: 1,
        },
      });

      return {
        success: true,
        message: 'Account type selected successfully',
        data: {
          user_id: user.id,
          type: user.type,
          onboarding_step: user.onboarding_step,
        },
        next_step: 'email',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Step 2: Register Email
   * Updates user email and sends verification code
   */
  async registerEmail(userId: string, email: string) {
    try {
      // Check if email already exists
      const existingUser = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (existingUser) {
        return {
          success: false,
          message: 'Email already registered',
        };
      }

      // Get user to verify onboarding step
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.onboarding_step !== 'email' && user.onboarding_step !== 'account_type') {
        return {
          success: false,
          message: 'Invalid onboarding step. Please start from account type selection',
        };
      }

      // Update user email and onboarding step
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: email,
          onboarding_step: 'email_verify',
        },
      });

      // Create verification OTP code
      const otpCode = await UcodeRepository.createRegistrationOtp({
        userId: userId,
        email: email,
      });

      if (!otpCode) {
        return {
          success: false,
          message: 'Failed to create verification code',
        };
      }

      // Send OTP code to email
      await this.mailService.sendOtpCodeToEmail({
        email: email,
        name: email,
        otp: otpCode,
      });

      return {
        success: true,
        message: 'Verification code sent to email',
        next_step: 'email_verify',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Step 3: Verify Email Code
   * Verifies the OTP code and updates email_verified_at
   */
  async verifyEmailCode(email: string, code: string) {
    try {
      // Validate token
      const isValid = await UcodeRepository.validateToken({
        email: email,
        token: code,
      });

      if (!isValid) {
        return {
          success: false,
          message: 'Invalid or expired verification code',
        };
      }

      // Get user by email
      const user = await UserRepository.getUserByEmail(email);

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Update user: set email_verified_at and onboarding_step
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email_verified_at: new Date(),
          onboarding_step: 'profile_setup',
        },
      });

      // Delete verification code
      await UcodeRepository.deleteToken({
        email: email,
        token: code,
      });

      return {
        success: true,
        message: 'Email verified successfully',
        data: {
          user_id: user.id,
          type: user.type,
          onboarding_step: 'profile_setup',
        },
        next_step: 'profile_setup',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Step 4A: Complete Staff Profile
   * Creates StaffProfile and assigns role
   */
  async completeStaffProfile(
    userId: string,
    profileData: any,
    photoFile?: Express.Multer.File,
    cvFile?: Express.Multer.File,
  ) {
    try {
      // Get user to verify
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          staff_profile: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.type !== 'staff') {
        return {
          success: false,
          message: 'User type mismatch. Expected staff',
        };
      }

      if (!user.email_verified_at) {
        return {
          success: false,
          message: 'Email must be verified before completing profile',
        };
      }

      if (user.staff_profile) {
        return {
          success: false,
          message: 'Profile already created',
        };
      }

      // Hash password
      await UserRepository.changePassword({
        email: user.email,
        password: profileData.password,
      });

      // If a staff photo file is provided, store it first
      let staffPhotoFileName: string = null;
      if (photoFile) {
        staffPhotoFileName = `${StringHelper.randomString()}${photoFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.staff + staffPhotoFileName,
          photoFile.buffer,
        );
      }

      let staffCvFileName: string = null;
      if (cvFile) {
        staffCvFileName = `${StringHelper.randomString()}${cvFile.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.cv + staffCvFileName,
          cvFile.buffer,
        );
      }

      // Normalize roles & agreed_to_terms from multipart
      const rolesNormalized = Array.isArray(profileData.roles)
        ? profileData.roles
        : (typeof profileData.roles === 'string'
          ? String(profileData.roles).split(',').map((v: string) => v.trim().toLowerCase()).filter(Boolean)
          : undefined);
      const agreedStaff = typeof profileData.agreed_to_terms === 'string'
        ? ['true', '1', 'yes'].includes(String(profileData.agreed_to_terms).trim().toLowerCase())
        : !!profileData.agreed_to_terms;

      // Create StaffProfile (with optional additional roles)
      const staffProfile = await this.prisma.staffProfile.create({
        data: {
          user_id: userId,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          mobile_code: profileData.mobile_code,
          mobile_number: profileData.mobile_number,
          date_of_birth: new Date(profileData.date_of_birth),
          roles: (rolesNormalized && rolesNormalized.length > 0) ? rolesNormalized as any : undefined,
          right_to_work_status: profileData.right_to_work_status,
          cv_url: staffCvFileName ?? undefined,
          photo_url: staffPhotoFileName ?? undefined,
          agreed_to_terms: agreedStaff,
          compliance_status: 'pending',
        },
      });

      // Assign staff role
      const role = await this.prisma.role.findFirst({
        where: { name: 'staff' },
      });

      if (role) {
        await UserRepository.attachRole({
          user_id: userId,
          role_id: role.id,
        });
      }

      // Update onboarding step (password already updated by changePassword)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          onboarding_step: 'completed',
        },
      });

      // create stripe customer account
      const stripeCustomer = await StripePayment.createCustomer({
        user_id: userId,
        email: user.email,
        name: `${profileData.first_name} ${profileData.last_name}`,
      });

      if (stripeCustomer) {
        await this.prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            billing_id: stripeCustomer.id,
          },
        });
      }

      return {
        success: true,
        message: 'Staff profile created successfully',
        data: {
          staff_profile_id: staffProfile.id,
          onboarding_step: 'completed',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // --------- Staff Certificates ---------
  async addStaffCertificate(payload: { user_id: string; certificate_type: string; expiry_date?: string }, file?: Express.Multer.File) {
    try {
      const userId = payload.user_id;
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      const staff = await this.prisma.staffProfile.findUnique({ where: { user_id: userId } });
      if (!staff) {
        return { success: false, message: 'Staff profile not found' };
      }

      let fileName: string | undefined;
      if (file) {
        fileName = `${StringHelper.randomString()}${file.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.certificate + fileName,
          file.buffer,
        );
      }

      const expiry = payload.expiry_date ? new Date(payload.expiry_date) : null;

      const created = await this.prisma.staffCertificate.create({
        data: {
          staff_id: staff.id,
          certificate_type: payload.certificate_type as any,
          file_url: fileName,
          ...(expiry ? { expiry_date: expiry } : {}),
          // verified_status defaults to pending
        },
      });

      return { success: true, data: created };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async addStaffCertificatesBulk(
    payload: { user_id: string; expiries?: string | Record<string, string> },
    files?: { [key: string]: Express.Multer.File[] }
  ) {
    try {
      const userId = payload.user_id;
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { success: false, message: 'Unrecognized user' };
      }
      const staff = await this.prisma.staffProfile.findUnique({ where: { user_id: userId } });
      if (!staff) {
        return { success: false, message: 'Staff profile not found' };
      }

      // Parse expiry dates from payload
      let expiryMap: Record<string, string> = {};
      if (typeof payload.expiries === 'string') {
        try {
          expiryMap = JSON.parse(payload.expiries);
        } catch {
          // Ignore parse errors
        }
      } else if (payload.expiries && typeof payload.expiries === 'object') {
        expiryMap = payload.expiries as Record<string, string>;
      }

      // Allowed certificate types (from enum)
      const allowedTypes = [
        'care_certificate',
        'moving_handling',
        'first_aid',
        'basic_life_support',
        'infection_control',
        'safeguarding',
        'health_safety',
        'equality_diversity',
        'coshh',
        'medication_training',
        'nvq_iii',
        'additional_training',
      ];
      const allowedTypesSet = new Set(allowedTypes);

      // Map files by field name (certificate type)
      const typeToFile: Record<string, Express.Multer.File> = {};
      if (files) {
        for (const [fieldName, fileArray] of Object.entries(files)) {
          const type = fieldName.trim().toLowerCase();
          if (!allowedTypesSet.has(type)) continue; // Skip unknown types
          if (!fileArray || fileArray.length === 0) continue;
          if (typeToFile[type]) continue; // Avoid duplicates (keep first)
          typeToFile[type] = fileArray[0]; // Take first file if multiple
        }
      }

      const types = Object.keys(typeToFile);
      if (types.length === 0) {
        return { success: false, message: 'No valid certificate files provided. Use field name as certificate_type.' };
      }

      // Prevent duplicates: check existing certificates for this staff
      const existingCertificates = await this.prisma.staffCertificate.findMany({
        where: {
          staff_id: staff.id,
          certificate_type: { in: types as any[] },
        },
        select: { certificate_type: true },
      });
      const existingTypesSet = new Set(
        existingCertificates.map((c) => (c.certificate_type as string).toLowerCase())
      );

      // Build create operations
      const createOps: ReturnType<typeof this.prisma.staffCertificate.create>[] = [];
      for (const type of types) {
        if (existingTypesSet.has(type)) {
          continue; // Skip existing types
        }

        const file = typeToFile[type];
        let fileName: string | undefined;

        // Upload file if provided
        if (file) {
          fileName = `${StringHelper.randomString()}${file.originalname}`;
          await SojebStorage.put(
            appConfig().storageUrl.certificate + fileName,
            file.buffer,
          );
        }

        // Get expiry date for this type
        const expiryStr = expiryMap[type];
        const expiryDate = expiryStr ? new Date(expiryStr) : undefined;

        createOps.push(
          this.prisma.staffCertificate.create({
            data: {
              staff_id: staff.id,
              certificate_type: type as any,
              file_url: fileName,
              ...(expiryDate ? { expiry_date: expiryDate } : {}),
            },
          })
        );
      }

      if (createOps.length === 0) {
        return {
          success: true,
          data: [],
          message: 'No new certificates to create (all provided types already exist or invalid).',
        };
      }

      const results = await this.prisma.$transaction(createOps);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Step 4B: Complete Service Provider Profile
   * Creates ServiceProviderInfo and assigns role
   */
  async completeServiceProviderProfile(userId: string, profileData: any, brand_logo?: Express.Multer.File) {
    try {
      // Get user to verify
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          service_provider_info: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.type !== 'service_provider') {
        return {
          success: false,
          message: 'User type mismatch. Expected service_provider',
        };
      }

      if (!user.email_verified_at) {
        return {
          success: false,
          message: 'Email must be verified before completing profile',
        };
      }

      if (user.service_provider_info) {
        return {
          success: false,
          message: 'Profile already created',
        };
      }

      // Hash password
      await UserRepository.changePassword({
        email: user.email,
        password: profileData.password,
      });

      // If a brand logo file is provided, store it first
      let brandLogoFileName: string = null;
      if (brand_logo) {
        brandLogoFileName = `${StringHelper.randomString()}${brand_logo.originalname}`;
        await SojebStorage.put(appConfig().storageUrl.brand + brandLogoFileName, brand_logo.buffer);
      }

      // Normalize types from multipart form
      const maxClientCapacity = typeof profileData.max_client_capacity === 'string'
        ? parseInt(profileData.max_client_capacity, 10)
        : profileData.max_client_capacity;

      const agreedToTerms = typeof profileData.agreed_to_terms === 'string'
        ? ['true', '1', 'yes'].includes(profileData.agreed_to_terms.trim().toLowerCase())
        : !!profileData.agreed_to_terms;

      // Create ServiceProviderInfo
      const serviceProviderInfo = await this.prisma.serviceProviderInfo.create({
        data: {
          user_id: userId,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          mobile_code: profileData.mobile_code,
          mobile_number: profileData.mobile_number,
          brand_logo_url: brandLogoFileName ?? undefined,
          organization_name: profileData.organization_name,
          website: profileData.website,
          cqc_provider_number: profileData.cqc_provider_number,
          vat_tax_id: profileData.vat_tax_id,
          primary_address: profileData.primary_address,
          main_service_type: profileData.main_service_type,
          max_client_capacity: maxClientCapacity,
          agreed_to_terms: agreedToTerms,
        },
      });

      // Assign service_provider role
      const role = await this.prisma.role.findFirst({
        where: { name: 'service_provider' },
      });

      if (role) {
        await UserRepository.attachRole({
          user_id: userId,
          role_id: role.id,
        });
      }

      // Update onboarding step (password already updated by changePassword)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          onboarding_step: 'completed',
        },
      });

      // create stripe customer account
      const stripeCustomer = await StripePayment.createCustomer({
        user_id: userId,
        email: user.email,
        name: `${profileData.first_name} ${profileData.last_name}`,
      });

      if (stripeCustomer) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { billing_id: stripeCustomer.id },
        });
      }

      return {
        success: true,
        message: 'Service provider profile created successfully',
        data: {
          service_provider_info_id: serviceProviderInfo.id,
          onboarding_step: 'completed',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get Registration Status
   * Returns current registration status and next step
   */
  async getRegistrationStatus(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          staff_profile: true,
          service_provider_info: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const getNextStep = (currentStep: string): string => {
        const steps = {
          account_type: 'email',
          email: 'email_verify',
          email_verify: 'profile_setup',
          profile_setup: 'completed',
        };
        return steps[currentStep] || 'completed';
      };

      return {
        success: true,
        data: {
          user_id: user.id,
          type: user.type,
          onboarding_step: user.onboarding_step,
          email: user.email,
          email_verified: !!user.email_verified_at,
          profile_created: !!(user.staff_profile || user.service_provider_info),
          next_step: getNextStep(user.onboarding_step),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // --------- end Registration Flow ---------
}
