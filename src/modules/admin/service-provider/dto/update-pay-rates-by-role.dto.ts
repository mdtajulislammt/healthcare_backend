import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UpdatePayRateByRoleDto } from './update-pay-rate-by-role.dto';

export class UpdatePayRatesByRoleDto {
  @ApiProperty({
    description: 'List of role-specific pay rates to upsert',
    type: [UpdatePayRateByRoleDto],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'pay_rates must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => UpdatePayRateByRoleDto)
  pay_rates: UpdatePayRateByRoleDto[];
}
