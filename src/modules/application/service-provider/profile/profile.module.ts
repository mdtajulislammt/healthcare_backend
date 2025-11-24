import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { ActivityLogModule } from 'src/common/module/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule { }
