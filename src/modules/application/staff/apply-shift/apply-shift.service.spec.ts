import { Test, TestingModule } from '@nestjs/testing';
import { ApplyShiftService } from './apply-shift.service';

describe('ApplyShiftService', () => {
  let service: ApplyShiftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApplyShiftService],
    }).compile();

    service = module.get<ApplyShiftService>(ApplyShiftService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
