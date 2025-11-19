import { PartialType } from '@nestjs/swagger';
import { CreateShiftTimesheetDto } from './create-shift-timesheet.dto';

export class UpdateShiftTimesheetDto extends PartialType(CreateShiftTimesheetDto) {}
