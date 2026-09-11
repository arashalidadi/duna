import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './common/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get()
  getInfo() {
    return {
      name: 'Shipping Operations & Accounting ERP - API',
      version: '1.0.0',
      environment: this.configService.get<string>('config.app.environment'),
    };
  }
}
