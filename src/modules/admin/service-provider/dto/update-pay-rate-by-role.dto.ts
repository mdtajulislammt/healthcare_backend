import { IsEnum, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProfessionRole } from '@prisma/client';

export class UpdatePayRateByRoleDto {
  @ApiProperty({
    description: 'Professional role for this pay rate',
    enum: ProfessionRole,
    example: 'nurse',
  })
  @IsEnum(ProfessionRole)
  @IsNotEmpty()
  profession_role: ProfessionRole;

  @ApiProperty({
    description: 'Hourly pay rate for the specified role (minimum 0.01)',
    example: 25.5,
    type: Number,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Pay rate hourly must be at least 0.01' })
  @IsNotEmpty()
  pay_rate_hourly: number;
}
