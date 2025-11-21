import {
    BadRequestException,
    Body,
    Controller,
    Post,
    Param,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffReviewService } from './staff-review.service';
import { CreateStaffReviewDto } from './dto/create-staff-review.dto';
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
export class StaffReviewController {
    constructor(private readonly staffReviewService: StaffReviewService) { }

    @Post(':staffId/reviews')
    @RequireEmployeePermission(EmployeePermissionType.manage_team_permissions)
    createReview(
        @Param('staffId') staffId: string,
        @Body() createStaffReviewDto: CreateStaffReviewDto,
        @Req() req: Request,
    ) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }
        return this.staffReviewService.createReview(user_id, staffId, createStaffReviewDto);
    }
}


