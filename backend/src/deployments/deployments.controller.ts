import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  Sse,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Observable, map } from 'rxjs';
import type { DeploymentLog } from '@generated/client';
import { DeploymentsService } from './deployments.service';
import { LogService } from '@src/infrastructure/log.service';
import type { DeploymentJob, AuthenticatedRequest } from '@src/common/types';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { FilterDeploymentsDto, AbortDeploymentDto } from './dto/deployment.dto';

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
    @Req() req: AuthenticatedRequest,
    @Param('environmentId') environmentId: string,
    @Query('resource_count', ParseIntPipe)
    resourceCount: number,
  ) {
    const deployment = await this.deployments.createDeployment(
      environmentId,
      req.user.id,
    );

    await this.deployQueue.add('deploy', { deployment, resourceCount });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('environments/:environmentId/redeploy')
  async redeploy(
    @Req() req: AuthenticatedRequest,
    @Param('environmentId') environmentId: string,
  ) {
    const deployment = await this.deployments.triggerRedeployment(
      environmentId,
      req.user.id,
    );

    await this.deployQueue.add('redeploy', {
      deployment,
      skipImageBuild: true,
    });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/rollback')
  async rollback(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const deployment = await this.deployments.findForRollback(id, req.user.id);

    await this.deployQueue.add('rollback', {
      deployment,
      skipImageBuild: true,
    });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }

  @Post('deployments/:id/abort')
  @HttpCode(HttpStatus.OK)
  async abort(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AbortDeploymentDto,
  ) {
    return this.deployments.abortDeployment(
      id,
      req.user.id,
      dto.marked_resources,
    );
  }

  @Get('deployments/:id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.deployments.findById(id, req.user.id);
  }

  @Get('environments/:environmentId/deployments')
  listByEnvironment(
    @Req() req: AuthenticatedRequest,
    @Param('environmentId') environmentId: string,
    @Query() filters: FilterDeploymentsDto,
  ) {
    return this.deployments.findByEnvironment(
      environmentId,
      req.user.id,
      filters,
    );
  }

  @Get('deployments/:id/logs')
  async getLogs(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.deployments.findById(id, req.user.id);
    return this.logService.getLogs(id);
  }

  @Sse('deployments/:id/logs/stream')
  async streamLogs(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<Observable<{ data: DeploymentLog }>> {
    await this.deployments.findById(id, req.user.id);

    return this.logService
      .subscribe(id)
      .pipe(map((entry) => ({ data: entry })));
  }
}
