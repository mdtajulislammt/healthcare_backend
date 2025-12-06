import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { TimesheetService } from './timesheet.service';
import { ForceApproveTimesheetDto } from './dto/force-approve-timesheet.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
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
    constructor(private readonly timesheetService: TimesheetService) { }

    @ApiOperation({ summary: 'Get all timesheets pending review (submitted, under_review, rejected, approved)' })
    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('status') status?: string, // 'pending' | 'disputed' | 'approved' | 'all'
    ) {
        return this.timesheetService.findAll({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search,
            status,
        });
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
    markStaffPaid(
        @Param('id') id: string,
        @Req() req: Request,
    ) {
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
    @Post('invoices/bulk')
    createBulkInvoices(@Body() body: { timesheetIds: string[] }) {
        return this.timesheetService.createBulkInvoices(body.timesheetIds);
    }
}

