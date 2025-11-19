import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffPreferenceService } from './staff-preference.service';
import { FavoriteStaffDto } from './dto/favorite-staff.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@Controller('application/service-provider/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SERVICE_PROVIDER)
export class StaffPreferenceController {
    constructor(private readonly staffPreferenceService: StaffPreferenceService) { }


    @Get('favorites')
    getFavorites(@Req() req: Request) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }
        return this.staffPreferenceService.getPreferences(user_id, 'favorite');
    }

    @Get('blocked')
    getBlocked(@Req() req: Request) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }
        return this.staffPreferenceService.getPreferences(user_id, 'blocked');
    }


    @Post(':staffId/favorite')
    favoriteStaff(
        @Param('staffId') staffId: string,
        @Body() favoriteStaffDto: FavoriteStaffDto,
        @Req() req: Request,
    ) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }

        return this.staffPreferenceService.setPreference(
            user_id,
            staffId,
            'favorite',
            favoriteStaffDto.reason,
        );
    }

    @Post(':staffId/block')
    blockStaff(
        @Param('staffId') staffId: string,
        @Body() favoriteStaffDto: FavoriteStaffDto,
        @Req() req: Request,
    ) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }

        return this.staffPreferenceService.setPreference(
            user_id,
            staffId,
            'blocked',
            favoriteStaffDto.reason,
        );
    }
}


