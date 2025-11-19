import {
    Controller,
    Post,
    Param,
    Body,
    UseGuards,
    Req,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GeofenceService } from './geofence.service';
import { CheckGeofenceDto } from './dto/check-geofence.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { Request } from 'express';

@ApiTags('Staff - Geofence')
@Controller('application/staff/shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF)
@ApiBearerAuth()
export class GeofenceController {
    constructor(private readonly geofenceService: GeofenceService) { }

    @Post(':shiftId/check-geofence')
    checkGeofence(
        @Param('shiftId') shiftId: string,
        @Body() checkGeofenceDto: CheckGeofenceDto,
        @Req() req: Request,
    ) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }

        return this.geofenceService.checkGeofence(
            shiftId,
            user_id,
            checkGeofenceDto.latitude,
            checkGeofenceDto.longitude,
        );
    }

    @Post(':shiftId/check-in')
    checkIn(@Param('shiftId') shiftId: string, @Req() req: Request) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }

        return this.geofenceService.checkIn(shiftId, user_id);
    }

    @Post(':shiftId/check-out')
    checkOut(@Param('shiftId') shiftId: string, @Req() req: Request) {
        const user_id = req.user?.userId;
        if (!user_id) {
            throw new BadRequestException('User not authenticated');
        }

        return this.geofenceService.checkOut(shiftId, user_id);
    }
}
