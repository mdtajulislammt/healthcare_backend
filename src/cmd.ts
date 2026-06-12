// external imports
import { Module } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
// internal imports
import { PrismaService } from './prisma/prisma.service';
import { SeedCommand } from './command/seed.command';
import { CheckCertExpiryCommand } from './command/check-cert-expiry.command';
import { MailService } from './mail/mail.service';

@Module({
  providers: [SeedCommand, CheckCertExpiryCommand, PrismaService, MailService],
})
export class AppModule {}

async function bootstrap() {
  await CommandFactory.run(AppModule);
}

bootstrap();
