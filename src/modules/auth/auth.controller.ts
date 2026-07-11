import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SelectAccountTypeDto } from './dto/select-account-type.dto';
import { RegisterEmailDto } from './dto/register-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { CompleteStaffProfileDto } from './dto/complete-staff-profile.dto';
import { CompleteServiceProviderProfileDto } from './dto/complete-service-provider-profile.dto';
import {
  CreateStaffCertificateDto,
  CreateStaffCertificatesBulkDto,
} from './dto/create-staff-certificate.dto';
import { CreateStaffDbsInfoDto } from './dto/create-staff-dbs-info.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import appConfig from '../../config/app.config';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Get user details' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    try {
      const user_id = req.user.userId;

      const response = await this.authService.me(user_id);

      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch user details',
      };
    }
  }

  @ApiOperation({ summary: 'Delete logged in user account' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  async deleteAccount(@Req() req: Request) {
    try {
      const user_id = req.user.userId;

      const response = await this.authService.deleteAccount(user_id);

      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Register a user' })
  @Post('register')
  async create(@Body() data: CreateUserDto) {
    try {
      const name = data.name;
      const first_name = data.first_name;
      const last_name = data.last_name;
      const email = data.email;
      const password = data.password;
      const type = data.type;

      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!password) {
        throw new HttpException(
          'Password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const response = await this.authService.register({
        name: name,
        first_name: first_name,
        last_name: last_name,
        email: email,
        password: password,
        type: type,
      });

      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  // login user
  @ApiOperation({ summary: 'Login user' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request) {
    try {
      const user_id = req.user.id;

      const user_email = req.user.email;

      const response = await this.authService.login({
        userId: user_id,
        email: user_email,
      });

      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  // --------------change password---------

  @ApiOperation({ summary: 'Forgot password' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
      },
      required: ['email'],
    },
  })
  @Post('forgot-password')
  async forgotPassword(@Body() data: { email: string }) {
    try {
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.forgotPassword(email);
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  @ApiOperation({ summary: 'Verify forgot password code' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        token: { type: 'string', example: '123456' },
      },
      required: ['email', 'token'],
    },
  })
  @Post('verify-code')
  async verifyForgotPasswordCode(
    @Body() data: { email: string; token: string },
  ) {
    try {
      const email = data.email;
      const token = data.token;

      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }

      return await this.authService.verifyForgotPasswordCode({
        email,
        token,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  // verify email to verify the email
  @ApiOperation({ summary: 'Verify email' })
  @Post('verify-email')
  async verifyEmail(@Body() data: VerifyEmailDto) {
    try {
      const email = data.email;
      const token = data.token;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.verifyEmail({
        email: email,
        token: token,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Failed to verify email',
      };
    }
  }

  // resend verification email to verify the email
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
      },
      required: ['email'],
    },
  })
  @Post('resend-verification-email')
  async resendVerificationEmail(@Body() data: { email: string }) {
    try {
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.resendVerificationEmail(email);
    } catch (error) {
      return {
        success: false,
        message: 'Failed to resend verification email',
      };
    }
  }

  // reset password if user forget the password
  @ApiOperation({ summary: 'Reset password' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        token: { type: 'string', example: '123456' },
        password: { type: 'string', example: 'newPassword123' },
      },
      required: ['email', 'token', 'password'],
    },
  })
  @Post('reset-password')
  async resetPassword(
    @Body() data: { email: string; token: string; password: string },
  ) {
    try {
      const email = data.email;
      const token = data.token;
      const password = data.password;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!password) {
        throw new HttpException(
          'Password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return await this.authService.resetPassword({
        email: email,
        token: token,
        password: password,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  // change password if user want to change the password
  @ApiOperation({ summary: 'Change password' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        old_password: { type: 'string', example: 'oldPassword123' },
        new_password: { type: 'string', example: 'newPassword123' },
      },
      required: ['old_password', 'new_password'],
    },
  })
  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Body() data: { email: string; old_password: string; new_password: string },
  ) {
    try {
      // const email = data.email;
      const user_id = req.user.userId;

      const oldPassword = data.old_password;
      const newPassword = data.new_password;
      // if (!email) {
      //   throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      // }
      if (!oldPassword) {
        throw new HttpException(
          'Old password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!newPassword) {
        throw new HttpException(
          'New password not provided',
          HttpStatus.UNAUTHORIZED,
        );
      }
      return await this.authService.changePassword({
        // email: email,
        user_id: user_id,
        oldPassword: oldPassword,
        newPassword: newPassword,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Failed to change password',
      };
    }
  }

  // --------------end change password---------

  @ApiOperation({ summary: 'Google OAuth Login' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin(): Promise<any> {
    return HttpStatus.OK;
  }

  @ApiOperation({ summary: 'Google OAuth Redirect Callback' })
  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleLoginRedirect(@Req() req: Request): Promise<any> {
    return {
      statusCode: HttpStatus.OK,
      data: req.user,
    };
  }

  // update user
  @ApiOperation({ summary: 'Update user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('update')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
    }),
  )
  // async updateUser(
  //   @Req() req: Request,
  //   @Body() data: UpdateUserDto,
  //   @UploadedFile() image: Express.Multer.File,
  // ) {
  //   try {
  //     const user_id = req.user.userId;
  //     const response = await this.authService.updateUser(user_id, data, image);
  //     return response;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Failed to update user',
  //     };
  //   }
  // }

  // -------change email address------
  @ApiOperation({ summary: 'request email change' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'new-email@example.com' },
      },
      required: ['email'],
    },
  })
  @Post('request-email-change')
  async requestEmailChange(
    @Req() req: Request,
    @Body() data: { email: string },
  ) {
    try {
      const user_id = req.user.userId;
      const email = data.email;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.requestEmailChange(user_id, email);
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  @ApiOperation({ summary: 'Change email address' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'new-email@example.com' },
        token: { type: 'string', example: '123456' },
      },
      required: ['email', 'token'],
    },
  })
  @Post('change-email')
  async changeEmail(
    @Req() req: Request,
    @Body() data: { email: string; token: string },
  ) {
    try {
      const user_id = req.user.userId;
      const email = data.email;

      const token = data.token;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.UNAUTHORIZED);
      }
      if (!token) {
        throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.changeEmail({
        user_id: user_id,
        new_email: email,
        token: token,
      });
    } catch (error) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }
  // -------end change email address------

  // --------- 2FA ---------
  @ApiOperation({ summary: 'Generate 2FA secret' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('generate-2fa-secret')
  async generate2FASecret(@Req() req: Request) {
    try {
      const user_id = req.user.userId;
      return await this.authService.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Verify 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: '123456' },
      },
      required: ['token'],
    },
  })
  @Post('verify-2fa')
  async verify2FA(@Req() req: Request, @Body() data: { token: string }) {
    try {
      const user_id = req.user.userId;
      const token = data.token;
      return await this.authService.verify2FA(user_id, token);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('enable-2fa')
  async enable2FA(@Req() req: Request) {
    try {
      const user_id = req.user.userId;
      return await this.authService.enable2FA(user_id);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('disable-2fa')
  async disable2FA(@Req() req: Request) {
    try {
      const user_id = req.user.userId;
      return await this.authService.disable2FA(user_id);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
  // --------- end 2FA ---------

  // --------- Registration Flow ---------
  @ApiOperation({ summary: 'Step 1: Select account type' })
  @Post('select-account-type')
  async selectAccountType(@Body() data: SelectAccountTypeDto) {
    try {
      const type = data.type;
      if (!type) {
        throw new HttpException(
          'Account type not provided',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.authService.selectAccountType(type);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Step 2: Register email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        user_id: { type: 'string', example: 'uuid-of-user' },
      },
      required: ['email', 'user_id'],
    },
  })
  @Post('register-email')
  async registerEmail(@Body() data: RegisterEmailDto & { user_id: string }) {
    try {
      const email = data.email;
      const userId = data.user_id;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.BAD_REQUEST);
      }
      if (!userId) {
        throw new HttpException('User ID not provided', HttpStatus.BAD_REQUEST);
      }
      const result = await this.authService.registerEmail(userId, email);
      //! TODO: Remove this code from response after testing
      // if (result.success) {
      //   const ucode =
      //     await this.authService.getRegistrationOtpForTesting(email);
      //   return {
      //     ...result,
      //     test_otp_code: ucode, // For testing purposes only
      //   };
      // }
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Resend OTP for email verification' })
  @Post('resend-otp')
  async resendOtp(@Body() data: ResendOtpDto) {
    try {
      const email = data.email;
      const userId = data.user_id;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.BAD_REQUEST);
      }
      if (!userId) {
        throw new HttpException('User ID not provided', HttpStatus.BAD_REQUEST);
      }
      const result = await this.authService.resendOtp(userId, email);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Step 3: Verify email code' })
  @Post('verify-email-code')
  async verifyEmailCode(@Body() data: VerifyEmailCodeDto) {
    try {
      const email = data.email;
      const code = data.code;
      if (!email) {
        throw new HttpException('Email not provided', HttpStatus.BAD_REQUEST);
      }
      if (!code) {
        throw new HttpException(
          'Verification code not provided',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.authService.verifyEmailCode(email, code);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({
    summary: 'Step 4A: Complete staff profile (with certificates and DBS info)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', example: 'uuid-of-user' },
        first_name: { type: 'string', example: 'John' },
        last_name: { type: 'string', example: 'Doe' },
        mobile_code: { type: 'string', example: '+44' },
        mobile_number: { type: 'string', example: '1234567890' },
        date_of_birth: {
          type: 'string',
          format: 'date',
          example: '1995-05-15',
        },
        roles: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['nurse', 'senior_hca', 'hca_carer', 'support_worker'],
          },
          example: ['nurse'],
        },
        right_to_work_status: { type: 'string', example: 'UK Citizen' },
        experience: { type: 'string', example: '5 years' },
        nmc_pin: { type: 'string', example: '12A3456B' },
        dbs_certificate_number: { type: 'string', example: '001234567890' },
        dbs_surname_as_certificate: { type: 'string', example: 'Doe' },
        dbs_date_of_birth_on_cert: {
          type: 'string',
          format: 'date',
          example: '1995-05-15',
        },
        dbs_certificate_print_date: {
          type: 'string',
          format: 'date',
          example: '2024-01-15',
        },
        dbs_is_registered_on_update: { type: 'boolean', example: false },
        password: { type: 'string', example: 'password123' },
        agreed_to_terms: { type: 'boolean', example: true },
        referees: {
          type: 'string',
          description: 'JSON string of RefereeInfoDto[]',
          example:
            '[{"name":"Jane Smith","mobile_code":"+44","mobile_number":"1234567890","email":"jane@example.com","role":"Supervisor","start_date":"2020-01-01","end_date":"2022-12-31","consent_to_contact":true}]',
        },
        photo: { type: 'string', format: 'binary' },
        cv: { type: 'string', format: 'binary' },
        care_certificate: { type: 'string', format: 'binary' },
        moving_handling: { type: 'string', format: 'binary' },
        first_aid: { type: 'string', format: 'binary' },
        basic_life_support: { type: 'string', format: 'binary' },
        infection_control: { type: 'string', format: 'binary' },
        safeguarding: { type: 'string', format: 'binary' },
        health_safety: { type: 'string', format: 'binary' },
        equality_diversity: { type: 'string', format: 'binary' },
        coshh: { type: 'string', format: 'binary' },
        medication_training: { type: 'string', format: 'binary' },
        nvq_iii: { type: 'string', format: 'binary' },
        additional_training: { type: 'string', format: 'binary' },
      },
      required: [
        'user_id',
        'first_name',
        'last_name',
        'date_of_birth',
        'right_to_work_status',
        'password',
      ],
    },
  })
  @Post('complete-staff-profile')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'photo', maxCount: 1 },
      { name: 'cv', maxCount: 1 },
      { name: 'care_certificate', maxCount: 1 },
      { name: 'moving_handling', maxCount: 1 },
      { name: 'first_aid', maxCount: 1 },
      { name: 'basic_life_support', maxCount: 1 },
      { name: 'infection_control', maxCount: 1 },
      { name: 'safeguarding', maxCount: 1 },
      { name: 'health_safety', maxCount: 1 },
      { name: 'equality_diversity', maxCount: 1 },
      { name: 'coshh', maxCount: 1 },
      { name: 'medication_training', maxCount: 1 },
      { name: 'nvq_iii', maxCount: 1 },
      { name: 'additional_training', maxCount: 1 },
    ]),
  )
  async completeStaffProfile(
    @Body() data: CompleteStaffProfileDto & { user_id: string },
    @UploadedFiles()
    files?: {
      photo?: Express.Multer.File[];
      cv?: Express.Multer.File[];
      care_certificate?: Express.Multer.File[];
      moving_handling?: Express.Multer.File[];
      first_aid?: Express.Multer.File[];
      basic_life_support?: Express.Multer.File[];
      infection_control?: Express.Multer.File[];
      safeguarding?: Express.Multer.File[];
      health_safety?: Express.Multer.File[];
      equality_diversity?: Express.Multer.File[];
      coshh?: Express.Multer.File[];
      medication_training?: Express.Multer.File[];
      nvq_iii?: Express.Multer.File[];
      additional_training?: Express.Multer.File[];
    },
  ) {
    try {
      const userId = data.user_id;
      if (!userId) {
        throw new HttpException('User ID not provided', HttpStatus.BAD_REQUEST);
      }
      const profileData = {
        first_name: data.first_name,
        last_name: data.last_name,
        mobile_code: data.mobile_code,
        mobile_number: data.mobile_number,
        date_of_birth: data.date_of_birth,
        roles: data.roles,
        right_to_work_status: data.right_to_work_status,
        password: data.password,
        agreed_to_terms: data.agreed_to_terms,
        experience: data.experience,
        nmc_pin: data.nmc_pin,
        dbs_certificate_number: data.dbs_certificate_number,
        dbs_surname_as_certificate: data.dbs_surname_as_certificate,
        dbs_date_of_birth_on_cert: data.dbs_date_of_birth_on_cert,
        dbs_certificate_print_date: data.dbs_certificate_print_date,
        dbs_is_registered_on_update: data.dbs_is_registered_on_update,
        referees: data.referees,
      };
      const photo = files?.photo?.[0];
      const cv = files?.cv?.[0];

      // Extract certificate files
      const certificateFiles: { [key: string]: Express.Multer.File[] } = {};
      if (files) {
        const certFields = [
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
        for (const field of certFields) {
          if (files[field]) {
            certificateFiles[field] = files[field];
          }
        }
      }

      return await this.authService.completeStaffProfile(
        userId,
        profileData,
        photo,
        cv,
        Object.keys(certificateFiles).length > 0 ? certificateFiles : undefined,
      );
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Add a staff certificate (single)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', example: 'uuid-of-user' },
        certificate_type: {
          type: 'string',
          enum: [
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
          ],
        },
        expiry_date: { type: 'string', format: 'date', example: '2026-12-31' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['user_id', 'certificate_type'],
    },
  })
  @Post('staff/certificates')
  @UseInterceptors(FileInterceptor('file'))
  async addStaffCertificate(
    @Body() data: CreateStaffCertificateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      return await this.authService.addStaffCertificate(data, file);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Add staff certificates (bulk)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', example: 'uuid-of-user' },
        expiries: {
          type: 'string',
          description:
            'Optional JSON string mapping certificate types to expiry dates',
          example: '{"first_aid":"2026-12-31","coshh":"2025-08-01"}',
        },
        care_certificate: { type: 'string', format: 'binary' },
        moving_handling: { type: 'string', format: 'binary' },
        first_aid: { type: 'string', format: 'binary' },
        basic_life_support: { type: 'string', format: 'binary' },
        infection_control: { type: 'string', format: 'binary' },
        safeguarding: { type: 'string', format: 'binary' },
        health_safety: { type: 'string', format: 'binary' },
        equality_diversity: { type: 'string', format: 'binary' },
        coshh: { type: 'string', format: 'binary' },
        medication_training: { type: 'string', format: 'binary' },
        nvq_iii: { type: 'string', format: 'binary' },
        additional_training: { type: 'string', format: 'binary' },
      },
      required: ['user_id'],
    },
  })
  @Post('staff/certificates/bulk')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'care_certificate', maxCount: 1 },
      { name: 'moving_handling', maxCount: 1 },
      { name: 'first_aid', maxCount: 1 },
      { name: 'basic_life_support', maxCount: 1 },
      { name: 'infection_control', maxCount: 1 },
      { name: 'safeguarding', maxCount: 1 },
      { name: 'health_safety', maxCount: 1 },
      { name: 'equality_diversity', maxCount: 1 },
      { name: 'coshh', maxCount: 1 },
      { name: 'medication_training', maxCount: 1 },
      { name: 'nvq_iii', maxCount: 1 },
      { name: 'additional_training', maxCount: 1 },
    ]),
  )
  async addStaffCertificatesBulk(
    @Body() data: CreateStaffCertificatesBulkDto,
    @UploadedFiles()
    files?: {
      care_certificate?: Express.Multer.File[];
      moving_handling?: Express.Multer.File[];
      first_aid?: Express.Multer.File[];
      basic_life_support?: Express.Multer.File[];
      infection_control?: Express.Multer.File[];
      safeguarding?: Express.Multer.File[];
      health_safety?: Express.Multer.File[];
      equality_diversity?: Express.Multer.File[];
      coshh?: Express.Multer.File[];
      medication_training?: Express.Multer.File[];
      nvq_iii?: Express.Multer.File[];
      additional_training?: Express.Multer.File[];
    },
  ) {
    try {
      return await this.authService.addStaffCertificatesBulk(data, files);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Create or update staff DBS info' })
  @ApiBearerAuth()
  @Post('staff/dbs-info')
  async createOrUpdateStaffDbsInfo(@Body() data: CreateStaffDbsInfoDto) {
    try {
      return await this.authService.createOrUpdateStaffDbsInfo(data);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Step 4B: Complete service provider profile' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', example: 'uuid-of-user' },
        first_name: { type: 'string', example: 'John' },
        last_name: { type: 'string', example: 'Doe' },
        mobile_code: { type: 'string', example: '+44' },
        mobile_number: { type: 'string', example: '1234567890' },
        organization_name: { type: 'string', example: 'Care Home Ltd' },
        website: { type: 'string', example: 'https://carehome.com' },
        cqc_provider_number: { type: 'string', example: 'CQC123456' },
        vat_tax_id: { type: 'string', example: 'GB123456789' },
        primary_address: { type: 'string', example: '123 Main St, London' },
        main_service_type: {
          type: 'string',
          enum: [
            'residential_care',
            'domiciliary_care',
            'nursing_care',
            'supported_living',
            'other',
          ],
          example: 'residential_care',
        },
        max_client_capacity: { type: 'number', example: 50 },
        password: { type: 'string', example: 'password123' },
        agreed_to_terms: { type: 'boolean', example: true },
        brand_logo: { type: 'string', format: 'binary' },
      },
      required: [
        'user_id',
        'first_name',
        'last_name',
        'organization_name',
        'cqc_provider_number',
        'primary_address',
        'main_service_type',
        'max_client_capacity',
        'password',
        'agreed_to_terms',
      ],
    },
  })
  @Post('complete-service-provider-profile')
  @UseInterceptors(FileInterceptor('brand_logo'))
  async completeServiceProviderProfile(
    @Body() data: CompleteServiceProviderProfileDto & { user_id: string },
    @UploadedFile() brand_logo?: Express.Multer.File,
  ) {
    try {
      const userId = data.user_id;
      if (!userId) {
        throw new HttpException('User ID not provided', HttpStatus.BAD_REQUEST);
      }

      const profileData = {
        first_name: data.first_name,
        last_name: data.last_name,
        mobile_code: data.mobile_code,
        mobile_number: data.mobile_number,
        organization_name: data.organization_name,
        website: data.website,
        cqc_provider_number: data.cqc_provider_number,
        vat_tax_id: data.vat_tax_id,
        primary_address: data.primary_address,
        main_service_type: data.main_service_type,
        max_client_capacity: data.max_client_capacity,
        password: data.password,
        agreed_to_terms: data.agreed_to_terms,
      };
      return await this.authService.completeServiceProviderProfile(
        userId,
        profileData,
        brand_logo,
      );
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  @ApiOperation({ summary: 'Get registration status' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', example: 'uuid-of-user' },
      },
      required: ['user_id'],
    },
  })
  @Post('registration-status')
  async getRegistrationStatus(@Body() data: { user_id: string }) {
    try {
      const userId = data.user_id;
      if (!userId) {
        throw new HttpException('User ID not provided', HttpStatus.BAD_REQUEST);
      }
      return await this.authService.getRegistrationStatus(userId);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
  // --------- end Registration Flow ---------
}
