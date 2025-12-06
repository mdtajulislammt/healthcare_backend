import { Module } from '@nestjs/common';
import { XeroService } from './xero.service';
import { XeroController } from './xero.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [XeroController],
    providers: [XeroService],
    exports: [XeroService],
})
export class XeroModule {}

