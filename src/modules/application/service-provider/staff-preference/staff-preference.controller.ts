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
import { EmployeePermissionGuard } from 'src/common/guard/employee-permission/employee-permission.guard';
import { RequireEmployeePermission } from 'src/common/guard/employee-permission/employee-permission.decorator';
import { EmployeePermissionType } from '@prisma/client';

@Controller('application/service-provider/staff')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
@Roles(Role.SERVICE_PROVIDER, Role.EMPLOYEE)
export class StaffPreferenceController {
    constructor(private readonly staffPreferenceService: StaffPreferenceService) { }


    @Get('favorites')
    @RequireEmployeePermission(EmployeePermissionType.favorite_block_workers)
    getFavorites(@Req() req: Request) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }
        return this.staffPreferenceService.getPreferences(user_id, 'favorite');
    }

    @Get('blocked')
    @RequireEmployeePermission(EmployeePermissionType.favorite_block_workers)
    getBlocked(@Req() req: Request) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }
        return this.staffPreferenceService.getPreferences(user_id, 'blocked');
    }


    @Post(':staffId/favorite')
    @RequireEmployeePermission(EmployeePermissionType.favorite_block_workers)
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
    @RequireEmployeePermission(EmployeePermissionType.favorite_block_workers)
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


