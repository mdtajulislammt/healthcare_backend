import { Module } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { GeofenceController } from './geofence.controller';

@Module({
    controllers: [GeofenceController],
    providers: [GeofenceService],
})
export class GeofenceModule { }

