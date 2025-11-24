import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { ProfessionRole, ShiftStatus, ShiftType } from '@prisma/client';

export class CreateShiftDto {
    @IsOptional()
    @IsString()
    service_provider_id?: string;

    @IsOptional()
    @IsString()
    created_by_employee_id?: string;

    @IsOptional()
    @IsString()
    assigned_staff_id?: string;

    @IsNotEmpty()
    @IsString()
    posting_title: string;

    @IsEnum(ShiftType)
    shift_type: ShiftType;

    @IsEnum(ProfessionRole)
    profession_role: ProfessionRole;

    @IsBoolean()
    @Type(() => Boolean)
    is_urgent: boolean;

    @IsDateString()
    start_date: string;

    @IsOptional()
    @IsDateString()
    end_date?: string;

    @IsDateString()
    start_time: string;

    @IsDateString()
    end_time: string;

    @IsNotEmpty()
    @IsString()
    facility_name: string;

    @IsNotEmpty()
    @IsString()
    full_address: string;

    @Type(() => Number)
    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(0)
    pay_rate_hourly: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(0)
    signing_bonus?: number;

    @IsOptional()
    @IsString()
    internal_po_number?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(0)
    emergency_bonus?: number;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsEnum(ShiftStatus)
    status?: ShiftStatus;
}
