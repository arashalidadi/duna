import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { ListLetterQueryDto } from '../letters/dto/letter.dto';
import { ArchiveService } from './archive.service';
import { UpdateRetentionPolicyDto } from './dto/retention-policy.dto';

class ReopenDto {
  @IsString() @IsNotEmpty() @MinLength(10) @MaxLength(500)
  reason!: string;
}

export class ArchiveHistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number;
}

@ApiTags('archive')
@Controller('archive')
export class ArchiveController {
  constructor(private readonly archive: ArchiveService) {}

  @Get('policies')
  @RequirePermissions('retention:read')
  policies(@CurrentUser() actor: AuthenticatedUser) { return this.archive.policies(actor); }

  @Patch('policies/:scope')
  @RequirePermissions('retention:manage')
  @ApiOperation({ summary: 'Configure a compliance-provided retention floor or letter archive criterion' })
  policy(@Param('scope') scope: string, @Body() dto: UpdateRetentionPolicyDto,
    @CurrentUser() actor: AuthenticatedUser) { return this.archive.setPolicy(scope, dto, actor); }

  @Get('letters')
  @RequirePermissions('letter:read')
  letters(@Query() query: ListLetterQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.archive.archivedLetters(query, actor);
  }

  @Get('letters/:id/history')
  @RequirePermissions('letter:read')
  history(@Param('id') id: string, @Query() query: ArchiveHistoryQueryDto,
    @CurrentUser() actor: AuthenticatedUser) {
    return this.archive.history(id, actor, query);
  }

  @Post('letters/:id/reopen')
  @HttpCode(200)
  @RequirePermissions(['archive:reopen', 'letter:read'])
  reopen(@Param('id') id: string, @Body() dto: ReopenDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.archive.reopen(id, dto.reason, actor);
  }

  @Post('letters/run')
  @HttpCode(200)
  @RequirePermissions(['archive:create', 'letter:archive'])
  @ApiOperation({ summary: 'Run a bounded automatic archive batch using the configured criterion' })
  run(@CurrentUser() actor: AuthenticatedUser) { return this.archive.runAutomatic(actor); }
}
