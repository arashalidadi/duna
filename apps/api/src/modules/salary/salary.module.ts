import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { SalaryRecordController } from './salary-record.controller';
import { SalaryRecordService } from './salary-record.service';

/** Phase 16 — HR & payroll: employees (master data) + salary records (payslips). */
@Module({
  controllers: [EmployeeController, SalaryRecordController],
  providers: [EmployeeService, SalaryRecordService],
  exports: [EmployeeService, SalaryRecordService],
})
export class SalaryModule {}
