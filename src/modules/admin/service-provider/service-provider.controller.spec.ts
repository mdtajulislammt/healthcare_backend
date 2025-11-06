import { Test, TestingModule } from '@nestjs/testing';
import { ServiceProviderController } from './service-provider.controller';
import { ServiceProviderService } from './service-provider.service';

describe('ServiceProviderController', () => {
  let controller: ServiceProviderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceProviderController],
      providers: [ServiceProviderService],
    }).compile();

    controller = module.get<ServiceProviderController>(ServiceProviderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
