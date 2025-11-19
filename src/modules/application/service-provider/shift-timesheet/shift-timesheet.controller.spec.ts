import { Test, TestingModule } from '@nestjs/testing';
import { ShiftTimesheetController } from './shift-timesheet.controller';
import { ShiftTimesheetService } from './shift-timesheet.service';

describe('ShiftTimesheetController', () => {
  let controller: ShiftTimesheetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShiftTimesheetController],
      providers: [ShiftTimesheetService],
    }).compile();

    controller = module.get<ShiftTimesheetController>(ShiftTimesheetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
