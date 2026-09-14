import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma, TimesheetStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { XeroService } from 'src/modules/payment/xero/xero.service';
import { GenerateWeeklyInvoiceDto } from './dto/generate-weekly-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xeroService: XeroService,
  ) {}

  /**
   * Get all-in-one Cashflow Overview, Outstanding Invoices by Supplier, and Paginated Invoices List
   */
  async findAll(query: InvoiceQueryDto) {
    try {
      const page = Math.max(Number(query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
      const skip = (page - 1) * limit;

      const now = new Date();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      // Base query for global overview & supplier summaries (excluding soft-deleted users)
      const baseTimesheets = await this.prisma.shiftTimesheet.findMany({
        where: {
          status: {
            in: [
              TimesheetStatus.approved,
              TimesheetStatus.invoiced,
              TimesheetStatus.paid,
            ],
          },
          staff: {
            user: {
              deleted_at: null,
            },
          },
        },
        select: {
          id: true,
          total_hours: true,
          hourly_rate: true,
          total_pay: true,
          status: true,
          xero_invoice_id: true,
          xero_invoice_number: true,
          xero_status: true,
          reviewed_at: true,
          submitted_at: true,
          paid_at: true,
          created_at: true,
          shift: {
            select: {
              id: true,
              posting_title: true,
              facility_name: true,
              start_date: true,
              service_provider_id: true,
              service_provider_info: {
                select: {
                  id: true,
                  organization_name: true,
                  primary_address: true,
                  mobile_code: true,
                  mobile_number: true,
                  user: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // 1. Calculate Cashflow Overview
      let paidAmount = 0;
      let paidCount = 0;

      let comingAmount = 0;
      let comingCount = 0;
      let overdueAmount = 0;
      let overdueCount = 0;

      let unbilledAmount = 0;
      let unbilledHours = 0;
      let unbilledTimesheetsCount = 0;

      // Map for supplier outstanding breakdown
      const supplierMap = new Map<
        string,
        {
          supplier_id: string;
          supplier_name: string;
          email: string | null;
          phone: string | null;
          primary_address: string | null;
          total_outstanding: number;
          unpaid_invoices_count: number;
          overdue_invoices_count: number;
          oldest_due_date: Date | null;
        }
      >();

      for (const item of baseTimesheets) {
        const itemPay = item.total_pay || 0;
        const itemHours = item.total_hours || 0;
        const refDate = item.reviewed_at || item.submitted_at || item.created_at;
        const dueDate = new Date(refDate.getTime() + thirtyDaysMs);
        const isOverdue = now.getTime() > dueDate.getTime();

        const sp = item.shift.service_provider_info;

        if (item.status === TimesheetStatus.paid || item.xero_status === 'PAID') {
          paidAmount += itemPay;
          paidCount++;
        } else if (item.status === TimesheetStatus.invoiced) {
          comingAmount += itemPay;
          comingCount++;
          if (isOverdue) {
            overdueAmount += itemPay;
            overdueCount++;
          }

          // Supplier breakdown
          if (sp) {
            const existing = supplierMap.get(sp.id) || {
              supplier_id: sp.id,
              supplier_name: sp.organization_name,
              email: sp.user?.email || null,
              phone: [sp.mobile_code, sp.mobile_number].filter(Boolean).join(' ') || null,
              primary_address: sp.primary_address || null,
              total_outstanding: 0,
              unpaid_invoices_count: 0,
              overdue_invoices_count: 0,
              oldest_due_date: null,
            };

            existing.total_outstanding += itemPay;
            existing.unpaid_invoices_count++;
            if (isOverdue) {
              existing.overdue_invoices_count++;
            }
            if (!existing.oldest_due_date || dueDate < existing.oldest_due_date) {
              existing.oldest_due_date = dueDate;
            }

            supplierMap.set(sp.id, existing);
          }
        } else if (item.status === TimesheetStatus.approved) {
          unbilledAmount += itemPay;
          unbilledHours += itemHours;
          unbilledTimesheetsCount++;
        }
      }

      const cashflow_overview = {
        what_has_been_paid: {
          amount: Number(paidAmount.toFixed(2)),
          count: paidCount,
        },
        what_is_coming: {
          amount: Number(comingAmount.toFixed(2)),
          count: comingCount,
          overdue_amount: Number(overdueAmount.toFixed(2)),
          overdue_count: overdueCount,
        },
        unbilled_work: {
          amount: Number(unbilledAmount.toFixed(2)),
          hours: Number(unbilledHours.toFixed(2)),
          pending_timesheets: unbilledTimesheetsCount,
        },
      };

      const outstanding_by_supplier = Array.from(supplierMap.values()).map((s) => ({
        ...s,
        total_outstanding: Number(s.total_outstanding.toFixed(2)),
      }));

      // 2. Build filtered paginated query for invoices list
      const whereConditions: Prisma.ShiftTimesheetWhereInput[] = [
        {
          staff: {
            user: {
              deleted_at: null,
            },
          },
        },
      ];

      // Status filter
      if (query.status && query.status !== 'all') {
        const st = query.status.toLowerCase();
        if (st === 'paid') {
          whereConditions.push({
            OR: [
              { status: TimesheetStatus.paid },
              { xero_status: 'PAID' },
            ],
          });
        } else if (st === 'unpaid') {
          whereConditions.push({
            status: TimesheetStatus.invoiced,
            xero_status: { not: 'PAID' },
          });
        } else if (st === 'approved') {
          whereConditions.push({
            status: TimesheetStatus.approved,
          });
        } else if (st === 'overdue') {
          const thirtyDaysAgo = new Date(now.getTime() - thirtyDaysMs);
          whereConditions.push({
            status: TimesheetStatus.invoiced,
            xero_status: { not: 'PAID' },
            reviewed_at: { lte: thirtyDaysAgo },
          });
        }
      } else {
        whereConditions.push({
          status: {
            in: [
              TimesheetStatus.approved,
              TimesheetStatus.invoiced,
              TimesheetStatus.paid,
            ],
          },
        });
      }

      // Date range filter
      if (query.start_date || query.end_date) {
        const dateCondition: Prisma.DateTimeFilter = {};
        if (query.start_date) {
          dateCondition.gte = new Date(query.start_date);
        }
        if (query.end_date) {
          const end = new Date(query.end_date);
          end.setHours(23, 59, 59, 999);
          dateCondition.lte = end;
        }
        whereConditions.push({
          OR: [
            { reviewed_at: dateCondition },
            { shift: { start_date: dateCondition } },
          ],
        });
      }

      // Care home / Supplier filter
      if (query.care_home_id) {
        whereConditions.push({
          shift: {
            service_provider_id: query.care_home_id.trim(),
          },
        });
      }

      // Search filter
      if (query.search && query.search.trim()) {
        const term = query.search.trim();
        whereConditions.push({
          OR: [
            { xero_invoice_number: { contains: term, mode: 'insensitive' } },
            {
              shift: {
                posting_title: { contains: term, mode: 'insensitive' },
              },
            },
            {
              shift: {
                facility_name: { contains: term, mode: 'insensitive' },
              },
            },
            {
              shift: {
                service_provider_info: {
                  organization_name: { contains: term, mode: 'insensitive' },
                },
              },
            },
            {
              staff: {
                first_name: { contains: term, mode: 'insensitive' },
              },
            },
            {
              staff: {
                last_name: { contains: term, mode: 'insensitive' },
              },
            },
          ],
        });
      }

      const where: Prisma.ShiftTimesheetWhereInput = {
        AND: whereConditions,
      };

      const [invoicesRaw, total] = await this.prisma.$transaction([
        this.prisma.shiftTimesheet.findMany({
          where,
          select: {
            id: true,
            total_hours: true,
            hourly_rate: true,
            total_pay: true,
            status: true,
            xero_invoice_id: true,
            xero_invoice_number: true,
            xero_status: true,
            reviewed_at: true,
            submitted_at: true,
            paid_at: true,
            created_at: true,
            shift: {
              select: {
                id: true,
                posting_title: true,
                facility_name: true,
                pay_rate_hourly: true,
                start_date: true,
                service_provider_info: {
                  select: {
                    id: true,
                    organization_name: true,
                  },
                },
              },
            },
            staff: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: [
            { reviewed_at: 'desc' },
            { created_at: 'desc' },
          ],
        }),
        this.prisma.shiftTimesheet.count({ where }),
      ]);

      const invoices = invoicesRaw.map((ts) => {
        const refDate = ts.reviewed_at || ts.submitted_at || ts.created_at;
        const dueDate = new Date(refDate.getTime() + thirtyDaysMs);
        const isOverdue =
          ts.status === TimesheetStatus.invoiced &&
          ts.xero_status !== 'PAID' &&
          now.getTime() > dueDate.getTime();
        const daysOverdue = isOverdue
          ? Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))
          : 0;

        let displayStatus: 'paid' | 'overdue' | 'unpaid' | 'approved' = 'unpaid';
        if (ts.status === TimesheetStatus.paid || ts.xero_status === 'PAID') {
          displayStatus = 'paid';
        } else if (isOverdue) {
          displayStatus = 'overdue';
        } else if (ts.status === TimesheetStatus.approved) {
          displayStatus = 'approved';
        }

        return {
          id: ts.id,
          invoice_number:
            ts.xero_invoice_number ||
            `INV-${ts.id.substring(0, 8).toUpperCase()}`,
          xero_invoice_id: ts.xero_invoice_id,
          xero_status: ts.xero_status,
          supplier_id: ts.shift.service_provider_info.id,
          supplier_name: ts.shift.service_provider_info.organization_name,
          facility_name:
            ts.shift.facility_name ||
            ts.shift.service_provider_info.organization_name,
          shift_title: ts.shift.posting_title,
          hcp_name: `${ts.staff.first_name} ${ts.staff.last_name}`,
          total_hours: ts.total_hours || 0,
          hourly_rate: ts.hourly_rate || ts.shift.pay_rate_hourly,
          total_amount: ts.total_pay || 0,
          issue_date: refDate,
          due_date: dueDate,
          paid_at: ts.paid_at,
          status: displayStatus,
          days_overdue: daysOverdue,
        };
      });

      return {
        success: true,
        message: 'Invoices and cashflow fetched successfully',
        cashflow_overview,
        outstanding_by_supplier,
        invoices,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch invoices overview', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to fetch invoices',
      );
    }
  }

  /**
   * Generate weekly consolidated invoices from approved uninvoiced timesheets
   */
  async generateWeekly(dto: GenerateWeeklyInvoiceDto) {
    try {
      const startDate = new Date(dto.start_date);
      const endDate = new Date(dto.end_date);
      endDate.setHours(23, 59, 59, 999);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid start_date or end_date');
      }

      if (startDate > endDate) {
        throw new BadRequestException('start_date cannot be greater than end_date');
      }

      const dueDays = dto.due_days || 30;

      // Find all approved uninvoiced timesheets within shift date range
      const whereTimesheets: Prisma.ShiftTimesheetWhereInput = {
        status: TimesheetStatus.approved,
        xero_invoice_id: null,
        shift: {
          start_date: {
            gte: startDate,
            lte: endDate,
          },
          ...(dto.care_home_id ? { service_provider_id: dto.care_home_id } : {}),
        },
        staff: {
          user: {
            deleted_at: null,
          },
        },
      };

      const timesheets = await this.prisma.shiftTimesheet.findMany({
        where: whereTimesheets,
        include: {
          shift: {
            include: {
              service_provider_info: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          staff: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (timesheets.length === 0) {
        throw new BadRequestException(
          'No approved unbilled timesheets found in the selected date range to generate weekly invoices',
        );
      }

      // Group timesheets by service_provider_id
      const groupedByProvider = new Map<
        string,
        typeof timesheets
      >();

      for (const ts of timesheets) {
        const providerId = ts.shift.service_provider_id;
        const list = groupedByProvider.get(providerId) || [];
        list.push(ts);
        groupedByProvider.set(providerId, list);
      }

      const isXeroConnected = await this.xeroService.isConnected();
      const generatedInvoices = [];
      let totalAmountBilled = 0;

      const invoiceDate = new Date();
      const dueDate = new Date(
        invoiceDate.getTime() + dueDays * 24 * 60 * 60 * 1000,
      );

      for (const [providerId, providerTimesheets] of groupedByProvider.entries()) {
        const providerInfo = providerTimesheets[0].shift.service_provider_info;
        const providerTotal = providerTimesheets.reduce(
          (sum, t) => sum + (t.total_pay || 0),
          0,
        );
        const providerHours = providerTimesheets.reduce(
          (sum, t) => sum + (t.total_hours || 0),
          0,
        );

        totalAmountBilled += providerTotal;

        const dateSuffix = invoiceDate.toISOString().slice(0, 10).replace(/-/g, '');
        const refNumber = `INV-W-${dateSuffix}-${providerInfo.organization_name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        let invoiceId = `LOCAL-${Date.now()}-${providerId.slice(0, 6)}`;
        let invoiceNumber = refNumber;
        let xeroStatus = 'AUTHORISED';

        if (isXeroConnected) {
          try {
            const xeroResult =
              await this.xeroService.createConsolidatedWeeklyInvoice(
                providerId,
                providerTimesheets,
                {
                  invoiceDate,
                  dueDate,
                  reference: refNumber,
                },
              );
            invoiceId = xeroResult.invoiceId;
            invoiceNumber = xeroResult.invoiceNumber;
          } catch (xeroErr) {
            this.logger.warn(
              `Xero weekly invoice failed for ${providerId}, fallback to internal reference: ${xeroErr}`,
            );
          }
        }

        const timesheetIds = providerTimesheets.map((t) => t.id);

        // Update all timesheets in batch to invoiced
        await this.prisma.shiftTimesheet.updateMany({
          where: {
            id: { in: timesheetIds },
          },
          data: {
            status: TimesheetStatus.invoiced,
            xero_invoice_id: invoiceId,
            xero_invoice_number: invoiceNumber,
            xero_status: xeroStatus,
          },
        });

        // Record payment transaction
        await this.prisma.paymentTransaction.create({
          data: {
            user_id: providerInfo.user_id,
            type: 'weekly_invoice',
            reference_number: invoiceNumber,
            order_id: invoiceId,
            amount: providerTotal,
            currency: 'GBP',
            status: 'pending',
            raw_status: xeroStatus,
          },
        });

        generatedInvoices.push({
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          supplier_id: providerId,
          supplier_name: providerInfo.organization_name,
          total_shifts: providerTimesheets.length,
          total_hours: Number(providerHours.toFixed(2)),
          total_amount: Number(providerTotal.toFixed(2)),
          issue_date: invoiceDate,
          due_date: dueDate,
          status: 'UNPAID',
          timesheet_ids: timesheetIds,
        });
      }

      return {
        success: true,
        message: `Successfully generated ${generatedInvoices.length} weekly invoice(s) for ${timesheets.length} shifts.`,
        data: {
          total_invoices_created: generatedInvoices.length,
          total_timesheets_invoiced: timesheets.length,
          total_amount_billed: Number(totalAmountBilled.toFixed(2)),
          invoices: generatedInvoices,
        },
      };
    } catch (error) {
      this.logger.error('Failed to generate weekly invoices', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Failed to generate weekly invoices',
      );
    }
  }
}

