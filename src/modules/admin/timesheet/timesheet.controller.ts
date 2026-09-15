import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TimesheetService } from './timesheet.service';
import { ForceApproveTimesheetDto } from './dto/force-approve-timesheet.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { UpdateTimesheetAttendanceDto } from './dto/update-timesheet-attendance.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';

@ApiTags('Admin - Digital Timesheet Review')
@ApiBearerAuth()
@Controller('admin/timesheets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  @ApiOperation({
    summary:
      'Get all timesheets pending review (submitted, under_review, rejected, approved)',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Limit number of results per page',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'search',
    description: 'Search query for staff names or reference numbers',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'status',
    description:
      'Timesheet status filter (pending | disputed | approved | invoiced | paid | all)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'urgency',
    description: 'Filter pending timesheets by urgency (critical | warning | normal)',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'care_home_id',
    description: 'Filter timesheets by Care Home / Service Provider ID',
    required: false,
    type: String,
  })
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string, // 'pending' | 'disputed' | 'approved' | 'invoiced' | 'paid' | 'all'
    @Query('urgency') urgency?: string, // 'critical' | 'warning' | 'normal'
    @Query('care_home_id') care_home_id?: string,
  ) {
    return this.timesheetService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      urgency,
      care_home_id,
    });
  }

  @ApiOperation({ summary: 'Get a single timesheet by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.timesheetService.findOne(id);
  }

  @ApiOperation({
    summary:
      'Update check-in and check-out attendance times for a pending timesheet (admin action with auto-recalculation of hours and pay)',
  })
  @Patch(':id/attendance')
  updateAttendance(
    @Param('id') id: string,
    @Body() updateDto: UpdateTimesheetAttendanceDto,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.timesheetService.updateAttendance(id, user_id, updateDto);
  }

  @ApiOperation({ summary: 'Force approve a timesheet (admin action)' })
  @Post(':id/force-approve')
  forceApprove(
    @Param('id') id: string,
    @Body() forceApproveDto: ForceApproveTimesheetDto,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.timesheetService.forceApprove(id, user_id, forceApproveDto);
  }

  @ApiOperation({ summary: 'Resolve dispute on a timesheet' })
  @Post(':id/resolve-dispute')
  resolveDispute(
    @Param('id') id: string,
    @Body() resolveDisputeDto: ResolveDisputeDto,
    @Req() req: Request,
  ) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.timesheetService.resolveDispute(id, user_id, resolveDisputeDto);
  }

  @ApiOperation({ summary: 'Create Xero invoice for a timesheet manually' })
  @Post(':id/invoice')
  createInvoice(@Param('id') id: string) {
    return this.timesheetService.createInvoice(id);
  }

  @ApiOperation({ summary: 'Sync invoice status from Xero' })
  @Post(':id/sync-invoice')
  syncInvoice(@Param('id') id: string) {
    return this.timesheetService.syncInvoiceStatus(id);
  }

  @ApiOperation({ summary: 'Mark staff payout as paid for a timesheet' })
  @Post(':id/mark-staff-paid')
  markStaffPaid(@Param('id') id: string, @Req() req: Request) {
    const user_id = req.user?.userId;
    if (!user_id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.timesheetService.markStaffPaid(id, user_id);
  }

  @ApiOperation({ summary: 'Get staff earnings summary' })
  @Get('staff/:staffId/earnings')
  getStaffEarnings(@Param('staffId') staffId: string) {
    return this.timesheetService.getStaffEarnings(staffId);
  }

  @ApiOperation({ summary: 'Sync all invoice statuses from Xero (bulk)' })
  @Post('sync-all-invoices')
  syncAllInvoices() {
    return this.timesheetService.syncAllInvoiceStatuses();
  }

  @ApiOperation({ summary: 'Create invoices for multiple approved timesheets' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        timesheetIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['timesheet-id-1', 'timesheet-id-2'],
        },
      },
      required: ['timesheetIds'],
    },
  })
  @Post('invoices/bulk')
  createBulkInvoices(@Body() body: { timesheetIds: string[] }) {
    return this.timesheetService.createBulkInvoices(body.timesheetIds);
  }

  @ApiOperation({ summary: 'Delete a timesheet (admin action)' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.timesheetService.remove(id);
  }
}
