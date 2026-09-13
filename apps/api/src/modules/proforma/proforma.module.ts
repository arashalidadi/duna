import { Module } from '@nestjs/common';
import { ProformaController } from './proforma.controller';
import { ProformaService } from './proforma.service';

@Module({
  controllers: [ProformaController],
  providers: [ProformaService],
})
export class ProformaModule {}
