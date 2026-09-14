import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { PortalService } from './portal.service';
import { ListBookingsQueryDto, RespondBookingDto } from './dto/portal.dto';

/**
 * Office-side booking desk: review and respond to agent submissions across
 * all portal companies.
 */
@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: PortalService) {}

  private actor(req: Request) {
    const user = (req as any).user;
    return { id: (user?.id ?? user?.sub) as string | undefined };
  }

  @Get()
  @RequirePermissions('booking:read')
  list(@Query() query: ListBookingsQueryDto, @Req() req: Request) {
    return this.service.listAllBookings(query, this.actor(req));
  }

  @Get(':id')
  @RequirePermissions('booking:read')
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.service.bookingDetail(id, this.actor(req));
  }

  @Post(':id/respond')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('booking:respond')
  respond(@Param('id') id: string, @Body() dto: RespondBookingDto, @Req() req: Request) {
    return this.service.respond(id, dto, this.actor(req));
  }
}
