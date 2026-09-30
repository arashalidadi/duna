import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
  list(@Query() query: ListAgentQueryDto) {
    return this.agentsService.list(query);
  }

  @Get(':id')
  @RequirePermissions('agent:read')
  get(@Param('id') id: string) {
    return this.agentsService.findById(id);
  }

  @Post()
  @RequirePermissions('agent:create')
  create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('agent:update')
  update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.update(id, dto);
  }

  @Patch(':id/active')
  @RequirePermissions('agent:update')
  setActive(@Param('id') id: string, @Body() dto: SetAgentActiveDto) {
    return this.agentsService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @RequirePermissions('agent:delete')
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }

  @Get(':id/destinations')
  @RequirePermissions('agent:read')
  listDestinations(
    @Param('id') id: string,
    @Query() query: ListAgentDestinationQueryDto
  ) {
    return this.agentsService.listDestinations(id, query);
  }

  @Post(':id/destinations')
  @RequirePermissions('agent:update')
  createDestination(
    @Param('id') id: string,
    @Body() dto: CreateAgentDestinationDto
  ) {
    return this.agentsService.createDestination(id, dto);
  }

  @Patch(':id/destinations/:destinationId')
  @RequirePermissions('agent:update')
  updateDestination(
    @Param('id') id: string,
    @Param('destinationId') destinationId: string,
    @Body() dto: UpdateAgentDestinationDto
  ) {
    return this.agentsService.updateDestination(id, destinationId, dto);
  }

  @Delete(':id/destinations/:destinationId')
  @RequirePermissions('agent:update')
  removeDestination(
    @Param('id') id: string,
    @Param('destinationId') destinationId: string
  ) {
    return this.agentsService.removeDestination(id, destinationId);
  }
}
