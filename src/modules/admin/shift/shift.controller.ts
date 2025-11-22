import { Controller, Get, Query } from '@nestjs/common';
import { ShiftService } from './shift.service';

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
}
