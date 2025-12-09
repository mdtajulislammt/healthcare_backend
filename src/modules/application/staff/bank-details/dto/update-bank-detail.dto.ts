import { PartialType } from '@nestjs/swagger';
import { CreateBankDetailDto } from './create-bank-detail.dto';

export class UpdateBankDetailDto extends PartialType(CreateBankDetailDto) {}
