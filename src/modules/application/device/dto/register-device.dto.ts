import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({
    description: 'FCM device token',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Device platform',
    enum: ['android', 'ios'],
  })
  @IsString()
  @IsEnum(['android', 'ios'] as any)
  platform: 'android' | 'ios';
}


