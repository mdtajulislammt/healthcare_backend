import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PayrollService } from './payroll.service';
import { PayrollQueryDto } from './dto/payroll-query.dto';
import { MarkPayrollPaidDto } from './dto/mark-payroll-paid.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Admin - Payroll & 12.07% Annual Leave')
@ApiBearerAuth()
@Controller('admin/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @ApiOperation({
    summary:
      'Get payroll summary with hours, 12.07% annual leave, and paid/unpaid status by date range',
  })
  @ApiQuery({ name: 'start_date', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'paid', 'unpaid'], description: 'Filter by paid/unpaid status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search staff name, email, or phone' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page' })
  @Get()
  findAll(@Query() query: PayrollQueryDto) {
    return this.payrollService.findAll(query);
  }

  @ApiOperation({
    summary:
      'Export weekly/custom date-range payroll to downloadable CSV format with 12.07% annual leave calculations',
  })
  @ApiQuery({ name: 'start_date', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'paid', 'unpaid'], description: 'Filter by paid/unpaid status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search staff name, email, or phone' })
  @Get('export-csv')
  async exportCsv(
    @Query() query: PayrollQueryDto,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.payrollService.exportCsv(query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }

  @ApiOperation({
    summary: 'Mark staff payroll as paid for a date range or specific timesheet IDs',
  })
  @Post('mark-paid')
  markPaid(
    @Body() dto: MarkPayrollPaidDto,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.payrollService.markPaid(dto, user_id);
  }
}

