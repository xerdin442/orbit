import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Sse,
  Req,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Observable, map } from 'rxjs';
import { DeploymentsService } from './deployments.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import type {
  LogEntry,
  AuthenticatedRequest,
  DeploymentJob,
} from '@src/common/types';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { ActivityType, DeploymentTrigger } from '@generated/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class DeploymentsController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly logService: LogService,
    private readonly activity: ActivityService,
    @InjectQueue('deployments')
    private readonly deployQueue: Queue<DeploymentJob>,
  ) {}

  @Post('environments/:environmentId/deploy')
  async deploy(
    @Req() req: AuthenticatedRequest,
    @Param('environmentId') environmentId: string,
  ) {
    const deployment = await this.deployments.createDeployment(
      environmentId,
      DeploymentTrigger.manual,
    );

    await this.deployQueue.add({ deployment });

    await this.activity.log(ActivityType.deployment_started, req.user.id, {
      deploymentId: deployment.id,
      environmentId,
      trigger: DeploymentTrigger.manual,
    });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/redeploy')
  async redeploy(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const existing = await this.deployments.findById(id);

    const deployment = await this.deployments.createDeployment(
      existing.environmentId,
      DeploymentTrigger.redeploy,
    );

    await this.deployQueue.add({ deployment, skipImageBuild: true });

    await this.activity.log(ActivityType.deployment_started, req.user.id, {
      deploymentId: deployment.id,
      environmentId: existing.environmentId,
      trigger: DeploymentTrigger.redeploy,
    });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/rollback')
  async rollback(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const deployment = await this.deployments.findForRollback(id);

    await this.deployQueue.add({ deployment, skipImageBuild: true });

    await this.activity.log(ActivityType.deployment_rolled_back, req.user.id, {
      deploymentId: deployment.id,
      environmentId: deployment.environmentId,
    });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/abort')
  async abort(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const deployment = await this.deployments.abortDeployment(id);

    await this.activity.log(ActivityType.deployment_aborted, req.user.id, {
      deploymentId: id,
      environmentId: deployment.environmentId,
    });

    return deployment;
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
