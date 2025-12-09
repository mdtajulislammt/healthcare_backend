import {
    Controller,
    Get,
    Post,
    Body,
    Delete,
    UseGuards,
    Req,
    BadRequestException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { BankDetailsService } from './bank-details.service';
import { CreateBankDetailDto } from './dto/create-bank-detail.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Staff - Bank Details')
@Controller('application/staff/bank-details')
export class BankDetailsController {
    constructor(private readonly bankDetailsService: BankDetailsService) {}

    @ApiOperation({ summary: 'Create or update staff bank details' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.STAFF)
    @Post()
    @HttpCode(HttpStatus.OK)
    async createOrUpdate(
        @Req() req: Request,
        @Body() createBankDetailDto: CreateBankDetailDto,
    ) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }

        return this.bankDetailsService.createOrUpdate(user_id, createBankDetailDto);
    }

    @ApiOperation({ summary: 'Get staff bank details' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.STAFF)
    @Get()
    async findOne(@Req() req: Request) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }

        return this.bankDetailsService.findByUser(user_id);
    }

    @ApiOperation({ summary: 'Delete staff bank details' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.STAFF)
    @Delete()
    @HttpCode(HttpStatus.OK)
    async remove(@Req() req: Request) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }

        return this.bankDetailsService.remove(user_id);
    }
}
