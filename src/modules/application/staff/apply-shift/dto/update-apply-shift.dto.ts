import { PartialType } from '@nestjs/swagger';
import { CreateApplyShiftDto } from './create-apply-shift.dto';

export class UpdateApplyShiftDto extends PartialType(CreateApplyShiftDto) {}
