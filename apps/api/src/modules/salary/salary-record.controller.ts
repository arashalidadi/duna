import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { SalaryRecordService } from './salary-record.service';
import {
  CancelSalaryRecordDto,
  CreateSalaryRecordDto,
  ListSalaryRecordQueryDto,
  PaySalaryRecordDto,
  UpdateSalaryRecordDto,
} from './dto/salary-record.dto';

@ApiTags('salary')
@Controller('salary-records')
export class SalaryRecordController {
  constructor(private readonly salaryRecords: SalaryRecordService) {}

  @Get()
  @RequirePermissions('salary:read')
  list(@Query() q: ListSalaryRecordQueryDto) {
    return this.salaryRecords.list(q);
  }

  @Post()
  @RequirePermissions('salary:create')
  create(@Body() dto: CreateSalaryRecordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salaryRecords.create(dto, user);
  }

  @Get(':id')
  @RequirePermissions('salary:read')
  detail(@Param('id') id: string) {
    return this.salaryRecords.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('salary:update')
  update(@Param('id') id: string, @Body() dto: UpdateSalaryRecordDto) {
    return this.salaryRecords.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('salary:delete')
  remove(@Param('id') id: string) {
    return this.salaryRecords.remove(id);
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('salary:approve')
  @ApiOperation({ summary: 'Approve a DRAFT payslip (DRAFT -> APPROVED)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salaryRecords.approve(id, user);
  }

  @Post(':id/pay')
  @HttpCode(200)
  @RequirePermissions('salary:pay')
  @ApiOperation({ summary: 'Record the payment of an APPROVED payslip (APPROVED -> PAID)' })
  pay(
    @Param('id') id: string,
    @Body() dto: PaySalaryRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salaryRecords.pay(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('salary:cancel')
  @ApiOperation({ summary: 'Withdraw a payslip (DRAFT|APPROVED -> CANCELLED, reason required)' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelSalaryRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salaryRecords.cancel(id, dto, user);
  }
}
