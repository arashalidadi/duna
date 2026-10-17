import { Module } from '@nestjs/common';
import { LettersModule } from '../letters/letters.module';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';

@Module({ imports: [LettersModule], controllers: [ArchiveController],
  providers: [ArchiveService], exports: [ArchiveService] })
export class ArchiveModule {}
