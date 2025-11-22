import { Module } from '@nestjs/common';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogModule } from 'src/common/module/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [HomeController],
  providers: [HomeService, PrismaService],
})
export class HomeModule { }
