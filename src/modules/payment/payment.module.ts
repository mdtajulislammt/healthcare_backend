import { Module } from '@nestjs/common';
import { StripeModule } from './stripe/stripe.module';
import { XeroModule } from './xero/xero.module';

@Module({
  imports: [StripeModule, XeroModule],
})
export class PaymentModule {}
