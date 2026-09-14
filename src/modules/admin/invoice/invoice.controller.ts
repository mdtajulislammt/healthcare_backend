import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { GenerateWeeklyInvoiceDto } from './dto/generate-weekly-invoice.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Admin - Invoices & Cashflow')
@ApiBearerAuth()
@Controller('admin/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @ApiOperation({
    summary:
      'Get Cashflow Overview (Paid vs Coming), Outstanding Invoices by Supplier, and Invoice List',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoices and Cashflow overview fetched successfully',
  })
  @Get()
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoiceService.findAll(query);
  }

  @ApiOperation({
    summary:
      'Generate weekly consolidated invoices for Care Providers from approved timesheets',
  })
  @ApiResponse({
    status: 201,
    description: 'Weekly invoices generated successfully',
  })
  @Post('generate-weekly')
  generateWeekly(@Body() dto: GenerateWeeklyInvoiceDto) {
    return this.invoiceService.generateWeekly(dto);
  }
}

