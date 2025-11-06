import { Module } from '@nestjs/common';
import { ServiceProviderService } from './service-provider.service';
import { ServiceProviderController } from './service-provider.controller';

@Module({
  controllers: [ServiceProviderController],
  providers: [ServiceProviderService],
})
export class ServiceProviderModule {}
