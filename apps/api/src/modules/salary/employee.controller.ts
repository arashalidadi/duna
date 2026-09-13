import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { EmployeeService } from './employee.service';
import {
  CreateEmployeeDto,
  ListEmployeeQueryDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';

@ApiTags('employee')
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employees: EmployeeService) {}

  @Get()
  @RequirePermissions('employee:read')
  list(@Query() q: ListEmployeeQueryDto) {
    return this.employees.list(q);
  }

  @Post()
  @RequirePermissions('employee:create')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.create(dto, user);
  }

  @Get(':id')
  @RequirePermissions('employee:read')
  detail(@Param('id') id: string) {
    return this.employees.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('employee:update')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('employee:delete')
  remove(@Param('id') id: string) {
    return this.employees.remove(id);
  }
}
