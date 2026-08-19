import {
  Controller,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { EnvironmentsService } from './environments.service';
import { DeploymentsService } from '@src/deployments/deployments.service';
import { ProjectTokenGuard } from '@src/auth/project-token.guard';
import type { ProjectTokenRequest, DeploymentJob } from '@src/common/types';

@Controller('projects/:projectId/deploy')
@UseGuards(ProjectTokenGuard)
export class CiDeployController {
  constructor(
    private readonly environments: EnvironmentsService,
    private readonly deployments: DeploymentsService,
    @InjectQueue('deployments')
    private readonly deployQueue: Queue<DeploymentJob>,
  ) {}

  @Post()
  async deploy(
    @Req() req: ProjectTokenRequest,
    @Param('projectId') projectId: string,
    @Query('branch') branch: string,
  ) {
    if (req.project.id !== projectId) {
      throw new ForbiddenException(
        'Project access token does not grant access to this project',
      );
    }

    const env = await this.environments.findByProjectAndBranch(
      projectId,
      branch,
    );

    const deployment = await this.deployments.createDeployment(
      env.id,
      req.project.ownerId,
      projectId,
    );

    await this.deployQueue.add('deploy', { deployment });

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  }
}
