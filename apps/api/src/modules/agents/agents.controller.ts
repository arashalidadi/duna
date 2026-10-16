import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { AgentsService } from './agents.service';
import {
  CreateAgentDestinationDto,
  CreateAgentDto,
  ListAgentDestinationQueryDto,
  ListAgentQueryDto,
  SetAgentActiveDto,
  UpdateAgentDestinationDto,
  UpdateAgentDto,
} from './dto/agents.dto';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @RequirePermissions('agent:read')
  list(@Query() query: ListAgentQueryDto, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'agent:read');
    return this.agentsService.list(query);
  }

  @Get(':id')
  @RequirePermissions('agent:read')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'agent:read');
    return this.agentsService.findById(id);
  }

  @Post()
  @RequirePermissions('agent:create')
  create(@Body() dto: CreateAgentDto, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'agent:create');
    return this.agentsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('agent:update')
  update(@Param('id') id: string, @Body() dto: UpdateAgentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.update(id, dto, user);
  }

  @Patch(':id/active')
  @RequirePermissions('agent:update')
  setActive(@Param('id') id: string, @Body() dto: SetAgentActiveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.setActive(id, dto.isActive, user);
  }

  @Delete(':id')
  @RequirePermissions('agent:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.remove(id, user);
  }

  @Get(':id/destinations')
  @RequirePermissions('agent:read')
  listDestinations(
    @Param('id') id: string,
    @Query() query: ListAgentDestinationQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    requireOffice(user, 'agent:read');
    return this.agentsService.listDestinations(id, query);
  }

  @Post(':id/destinations')
  @RequirePermissions('agent:update')
  createDestination(
    @Param('id') id: string,
    @Body() dto: CreateAgentDestinationDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    requireOffice(user, 'agent:update');
    return this.agentsService.createDestination(id, dto, user);
  }

  @Patch(':id/destinations/:destinationId')
  @RequirePermissions('agent:update')
  updateDestination(
    @Param('id') id: string,
    @Param('destinationId') destinationId: string,
    @Body() dto: UpdateAgentDestinationDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.agentsService.updateDestination(id, destinationId, dto, user);
  }

  @Delete(':id/destinations/:destinationId')
  @RequirePermissions('agent:update')
  removeDestination(
    @Param('id') id: string,
    @Param('destinationId') destinationId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.agentsService.removeDestination(id, destinationId, user);
  }
}
