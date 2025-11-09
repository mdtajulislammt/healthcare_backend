import { Module } from '@nestjs/common';
import { ShiftApplicationService } from './shift-application.service';
import { ShiftApplicationController } from './shift-application.controller';
import { PrismaService } from '../../../../prisma/prisma.service';

@Module({
  controllers: [ShiftApplicationController],
  providers: [ShiftApplicationService, PrismaService],
})
export class ShiftApplicationModule { }
