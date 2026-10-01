import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Sse,
  ParseIntPipe,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Observable, map } from 'rxjs';
import { DeploymentsService } from './deployments.service';
import { LogService } from '@src/infrastructure/log.service';
import type { LogEntry, DeploymentJob } from '@src/common/types';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { DeploymentTrigger } from '@generated/client';
import { FilterDeploymentsDto, MarkedResourcesDto } from './dto/deployment.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DeploymentsController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly logService: LogService,
    @InjectQueue('deployments')
    private readonly deployQueue: Queue<DeploymentJob>,
  ) {}

  @Post('environments/:environmentId/deploy')
  async deploy(
    @Param('environmentId') environmentId: string,
    @Query('resource_count', ParseIntPipe)
    resourceCount: number,
  ) {
    const deployment = await this.deployments.createDeployment(
      environmentId,
      DeploymentTrigger.manual,
    );

    await this.deployQueue.add({ deployment, resourceCount });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/redeploy')
  async redeploy(@Param('id') id: string) {
    const existing = await this.deployments.findById(id);

    const deployment = await this.deployments.createDeployment(
      existing.environmentId,
      DeploymentTrigger.redeploy,
    );

    await this.deployQueue.add({ deployment, skipImageBuild: true });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/rollback')
  async rollback(@Param('id') id: string) {
    const deployment = await this.deployments.findForRollback(id);

    await this.deployQueue.add({ deployment, skipImageBuild: true });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/abort')
  async abort(@Param('id') id: string, @Query() query?: MarkedResourcesDto) {
    return this.deployments.abortDeployment(id, query?.marked_resources);
  }

  @Get('deployments/:id')
  findOne(@Param('id') id: string) {
    return this.deployments.findById(id);
  }

  @Get('environments/:environmentId/deployments')
  listByEnvironment(
    @Param('environmentId') environmentId: string,
    @Query() filters: FilterDeploymentsDto,
  ) {
    return this.deployments.findByEnvironment(environmentId, filters);
  }

  @Get('deployments/:id/logs')
  getLogs(@Param('id') id: string) {
    return this.logService.getLogs(id);
  }

  @Sse('deployments/:id/logs/stream')
  streamLogs(@Param('id') id: string): Observable<{ data: LogEntry }> {
    const stream = this.logService.subscribe(id);

    return stream.pipe(map((entry) => ({ data: entry })));
  }
}
