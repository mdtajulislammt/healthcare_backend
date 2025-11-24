import { Module } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { GeofenceController } from './geofence.controller';
import { ActivityLogModule } from 'src/common/module/activity-log.module';

@Module({
    imports: [ActivityLogModule],
    controllers: [GeofenceController],
    providers: [GeofenceService],
})
export class GeofenceModule { }

