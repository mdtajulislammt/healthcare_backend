import { PartialType } from '@nestjs/swagger';
import { CreateShiftApplicationDto } from './create-shift-application.dto';

export class UpdateShiftApplicationDto extends PartialType(CreateShiftApplicationDto) {}
