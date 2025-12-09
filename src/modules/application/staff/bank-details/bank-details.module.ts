import { Module } from '@nestjs/common';
import { BankDetailsService } from './bank-details.service';
import { BankDetailsController } from './bank-details.controller';

@Module({
  controllers: [BankDetailsController],
  providers: [BankDetailsService],
})
export class BankDetailsModule {}
