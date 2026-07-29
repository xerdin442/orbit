import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
} from './dto/environment.dto';
import {
  CreateVariableDto,
  UpdateVariableDto,
  BulkCreateVariablesDto,
} from './dto/variable.dto';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';

@Controller('projects/:projectId/environments')
@UseGuards(JwtAuthGuard)
export class EnvironmentsController {
  constructor(private readonly environments: EnvironmentsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateEnvironmentDto,
  ) {
    return this.environments.create(projectId, req.user.id, dto);
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.environments.findAllByProject(projectId, req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.environments.findById(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEnvironmentDto,
  ) {
    return this.environments.update(id, req.user.id, dto);
  }

  @Delete(':id')
  delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.environments.delete(id, req.user.id);
  }

  @Get(':id/variables')
  getVariables(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.environments.getVariables(id, req.user.id);
  }

  @Post(':id/variables')
  createVariable(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateVariableDto,
    @Query('skip_redeploy') skipRedeploy?: string,
  ) {
    return this.environments.createVariable(
      id,
      req.user.id,
      dto,
      skipRedeploy === 'true',
    );
  }

  @Post(':id/variables/bulk')
  bulkCreateVariables(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: BulkCreateVariablesDto,
    @Query('skip_redeploy') skipRedeploy?: string,
  ) {
    return this.environments.bulkCreateVariables(
      id,
      req.user.id,
      dto,
      skipRedeploy === 'true',
    );
  }

  @Patch('variables/:id')
  updateVariable(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateVariableDto,
    @Query('skip_redeploy') skipRedeploy?: string,
  ) {
    return this.environments.updateVariable(
      id,
      req.user.id,
      dto,
      skipRedeploy === 'true',
    );
  }

  @Delete('variables/:id')
  deleteVariable(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('skip_redeploy') skipRedeploy?: string,
  ) {
    return this.environments.deleteVariable(
      id,
      req.user.id,
      skipRedeploy === 'true',
    );
  }
}
