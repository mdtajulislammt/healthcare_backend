import {
    Controller,
    Get,
    Post,
    Query,
    Param,
    UseGuards,
    Req,
    Res,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { XeroService } from './xero.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request, Response } from 'express';

@ApiTags('Payment - Xero')
@Controller('payment/xero')
export class XeroController {
    constructor(private readonly xeroService: XeroService) {}

    @Get('connect')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    async connect(@Res() res: Response) {
        try {
            const authUrl = await this.xeroService.getAuthorizationUrl();
            return res.redirect(authUrl);
        } catch (error) {
            throw new BadRequestException(
                'Failed to initiate Xero connection',
            );
        }
    }

    @Get('connect-url')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    async getConnectUrl() {
        try {
            const authUrl = await this.xeroService.getAuthorizationUrl();
            return {
                success: true,
                authUrl: authUrl,
                message: 'Copy this URL and open it in your browser to connect Xero',
            };
        } catch (error) {
            throw new BadRequestException(
                `Failed to generate Xero authorization URL: ${error.message}`,
            );
        }
    }

    @Get('status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    async getStatus() {
        const isConnected = await this.xeroService.isConnected();
        return {
            success: true,
            connected: isConnected,
        };
    }

    @Get('callback')
    async callback(@Query('code') code: string, @Query('error') error?: string) {
        // Check for OAuth errors from Xero
        if (error) {
            throw new BadRequestException(
                `Xero authorization failed: ${error}`,
            );
        }

        if (!code) {
            throw new BadRequestException('Authorization code is required');
        }

        try {
            await this.xeroService.handleOAuthCallback(code);
            return {
                success: true,
                message: 'Xero connected successfully',
            };
        } catch (error) {
            // Re-throw BadRequestException and InternalServerErrorException as-is
            if (
                error instanceof BadRequestException ||
                error instanceof InternalServerErrorException
            ) {
                throw error;
            }
            throw new BadRequestException(
                `Failed to complete Xero connection: ${error.message}`,
            );
        }
    }

    @Post('webhook')
    async webhook(@Req() req: Request) {
        // Xero webhook handler (if webhooks are enabled)
        // For now, this is a placeholder
        // You would verify Xero signature and process invoice updates
        return {
            success: true,
            message: 'Webhook received',
        };
    }
}

