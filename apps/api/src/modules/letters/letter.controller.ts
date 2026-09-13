import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { LetterService } from './letter.service';
import { CreateLetterDto, ListLetterQueryDto, UpdateLetterDto } from './dto/letter.dto';

@ApiTags('letters')
@Controller('letters')
export class LetterController {
  constructor(private readonly letters: LetterService) {}

  @Get()
  @RequirePermissions('letter:read')
  list(@Query() q: ListLetterQueryDto) {
    return this.letters.list(q);
  }

  @Post()
  @RequirePermissions('letter:create')
  create(@Body() dto: CreateLetterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.letters.create(dto, user);
  }

  @Get(':id')
  @RequirePermissions('letter:read')
  detail(@Param('id') id: string) {
    return this.letters.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('letter:update')
  update(@Param('id') id: string, @Body() dto: UpdateLetterDto) {
    return this.letters.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('letter:delete')
  remove(@Param('id') id: string) {
    return this.letters.remove(id);
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermissions('letter:send')
  @ApiOperation({ summary: 'Send a DRAFT outgoing letter (DRAFT -> SENT)' })
  send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.letters.send(id, user);
  }

  @Post(':id/reply')
  @HttpCode(200)
  @RequirePermissions('letter:create')
  @ApiOperation({ summary: 'One-click reply: OUTGOING DRAFT threaded to this letter' })
  reply(
    @Param('id') id: string,
    @Body() dto: { body?: string; notes?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.letters.reply(id, dto, user);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermissions('letter:archive')
  @ApiOperation({ summary: 'Archive a SENT or RECEIVED letter (terminal)' })
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.letters.archive(id, user);
  }
}
