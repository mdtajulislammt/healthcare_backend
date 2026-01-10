import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { Response } from 'express';

@Controller('admin/shifts')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) { }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.shiftService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
    });
  }

  // Keep static route above dynamic ':id' to avoid misrouting
  @Get('export')
  async export(
    @Query('type') type: string,
    @Query('search') search: string,
    @Res() res: Response,
  ) {
    const csv = await this.shiftService.exportShifts(type, { search });
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="shifts_${type || 'all'}_${date}.csv"`);
    res.send(csv);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shiftService.findOne(id);
  }
}
