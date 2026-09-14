import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { PortalService } from './portal.service';
import { CreateBookingDto, ListBookingsQueryDto } from './dto/portal.dto';

/**
 * Agent portal endpoints. Every route is scoped server-side to the
 * authenticated user's linked company (ADR-040) — no customerId is ever
 * accepted from the request. Requires a portal link (403 without one).
 */
@ApiTags('portal')
@Controller('portal')
@RequirePermissions('portal:access')
export class PortalController {
  constructor(private readonly service: PortalService) {}

  private actor(req: Request) {
    const user = (req as any).user;
    return { id: (user?.id ?? user?.sub) as string | undefined };
  }

  @Get('me')
  me(@Req() req: Request) {
    return this.service.me(this.actor(req));
  }

  @Get('bookings')
  listOwnBookings(@Req() req: Request, @Query() query: ListBookingsQueryDto) {
    return this.service.listOwnBookings(this.actor(req), query);
  }

  @Post('bookings')
  @RequirePermissions('booking:create')
  createBooking(@Req() req: Request, @Body() dto: CreateBookingDto) {
    return this.service.createBooking(this.actor(req), dto);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelBooking(@Req() req: Request, @Param('id') id: string) {
    return this.service.cancelOwnBooking(this.actor(req), id);
  }

  @Get('shipments')
  shipments(@Req() req: Request, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: string) {
    return this.service.shipments(this.actor(req), {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      status,
    });
  }

  @Get('ports')
  @RequirePermissions('booking:create')
  ports() {
    return this.service.ports();
  }

  @Get('statement')
  statement(@Req() req: Request, @Query('fromDate') fromDate?: string, @Query('toDate') toDate?: string, @Query('currencyCode') currencyCode?: string) {
    return this.service.statement(this.actor(req), { fromDate, toDate, currencyCode });
  }
}
