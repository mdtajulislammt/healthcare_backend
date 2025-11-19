import { Test, TestingModule } from '@nestjs/testing';
import { ShiftTimesheetService } from './shift-timesheet.service';

describe('ShiftTimesheetService', () => {
  let service: ShiftTimesheetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShiftTimesheetService],
    }).compile();

    service = module.get<ShiftTimesheetService>(ShiftTimesheetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
