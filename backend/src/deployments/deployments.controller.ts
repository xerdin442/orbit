import { Controller, Get, Post, Param, UseGuards, Sse } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Observable, map } from 'rxjs';
import { DeploymentsService } from './deployments.service';
import { LogService } from '@src/infrastructure/log.service';
import type { LogEntry } from '@src/common/types';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { DeploymentTrigger } from '@generated/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class DeploymentsController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly logService: LogService,
    @InjectQueue('deployments') private readonly deployQueue: Queue,
  ) {}

  @Post('environments/:environmentId/deploy')
  async deploy(@Param('environmentId') environmentId: string) {
    const deployment = await this.deployments.createDeployment(
      environmentId,
      DeploymentTrigger.manual,
    );

    await this.deployQueue.add({ deploymentId: deployment.id });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/redeploy')
  async redeploy(@Param('id') id: string) {
    const existing = await this.deployments.findById(id);

    const deployment = await this.deployments.createDeployment(
      existing.environmentId,
      DeploymentTrigger.redeploy,
    );

    await this.deployQueue.add({ deploymentId: deployment.id });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/rollback')
  async rollback(@Param('id') id: string) {
    const deployment = await this.deployments.findForRollback(id);

    await this.deployQueue.add({ deploymentId: deployment.id });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/abort')
  abort(@Param('id') id: string) {
    return this.deployments.abortDeployment(id);
  }

  @Get('deployments/:id')
  findOne(@Param('id') id: string) {
    return this.deployments.findById(id);
  }

  @Get('environments/:environmentId/deployments')
  listByEnvironment(@Param('environmentId') environmentId: string) {
    return this.deployments.findByEnvironment(environmentId);
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
