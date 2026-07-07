import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateAdminNoteDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The admin note for the staff member',
    example: 'Highly experienced nurse, background check completed.',
  })
  admin_note: string;
}
