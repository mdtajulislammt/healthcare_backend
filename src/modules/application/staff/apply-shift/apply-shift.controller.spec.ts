import { Test, TestingModule } from '@nestjs/testing';
import { ApplyShiftController } from './apply-shift.controller';
import { ApplyShiftService } from './apply-shift.service';

describe('ApplyShiftController', () => {
  let controller: ApplyShiftController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplyShiftController],
      providers: [ApplyShiftService],
    }).compile();

    controller = module.get<ApplyShiftController>(ApplyShiftController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
