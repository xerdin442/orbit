import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { App, ExpressReceiver } from '@slack/bolt';
import { ChatPostMessageResponse } from '@slack/web-api';
import type { Queue } from 'bullmq';
import { Secrets } from '@src/common/secrets';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';
import { SlackInstallationStore } from './slack-installation.store';
import { SlackApiService } from './slack-api.service';
import { buildDeploymentStatusBlocks } from './blocks/deployment-status.blocks';
import type { DeploymentJob } from '@src/common/types';
import {
  ActivityType,
  BuildStatus,
  DeploymentTrigger,
  LifecycleStatus,
} from '@generated/client';

@Injectable()
export class SlackBoltService implements OnModuleInit {
  private readonly logger = new Logger(SlackBoltService.name);
  public readonly receiver: ExpressReceiver;
  public readonly app: App;

  constructor(
    private readonly installationStore: SlackInstallationStore,
    private readonly slackApi: SlackApiService,
    private readonly activity: ActivityService,
    private readonly db: DbService,
    @InjectQueue('deployments')
    private readonly deployQueue: Queue<DeploymentJob>,
  ) {
    this.receiver = new ExpressReceiver({
      signingSecret: Secrets.SLACK_SIGNING_SECRET,
      installationStore: this.installationStore,
      processBeforeResponse: true,
    });

    this.app = new App({
      receiver: this.receiver,
    });

    this.registerListeners();
  }

  async onModuleInit(): Promise<void> {
    await this.app.init();
  }

  private registerListeners(): void {
    this.registerLifecycleEvents();
    this.registerCommands();
  }

  private registerLifecycleEvents(): void {
    this.app.event('app_uninstalled', async ({ context }) => {
      const { teamId, enterpriseId, isEnterpriseInstall } = context;
      await this.installationStore.deleteInstallation({
        teamId,
        enterpriseId,
        isEnterpriseInstall,
      });

      this.logger.log(`App uninstalled from team ${teamId}`);

      try {
        await this.activity.log(
          ActivityType.slack_installation_removed,
          'system',
          { teamId, enterpriseId },
        );
      } catch {
        // activity logging does not block event processing
      }
    });

    this.app.event('tokens_revoked', async ({ context }) => {
      const { teamId, enterpriseId, isEnterpriseInstall } = context;
      await this.installationStore.deleteInstallation({
        teamId,
        enterpriseId,
        isEnterpriseInstall,
      });

      this.logger.warn(`Tokens revoked for team ${teamId}`);
    });
  }

  private registerCommands(): void {
    this.app.command('/deploy', async ({ command, ack, respond }) => {
      await ack();

      const teamId = command.team_id;
      const slackUserId = command.user_id;

      const isUserAuthorized = await this.isAuthorized(teamId, slackUserId);
      if (!isUserAuthorized) {
        await respond({
          text: "You're not authorized. Ask the workspace admin to run `/slack add @you`.",
          response_type: 'ephemeral',
        });
        return;
      }

      const record = await this.installationStore.getRecord(teamId);
      if (!record) {
        await respond({
          text: 'No linked Orbit account found for this workspace.',
          response_type: 'ephemeral',
        });
        return;
      }

      const parts = command.text.trim().split(/\s+/);
      const projectName = parts[0];
      const envName = parts[1] || null;

      if (!projectName) {
        await respond({
          text: 'Usage: `/deploy <project> [environment]`',
          response_type: 'ephemeral',
        });
        return;
      }

      const project = await this.resolveProject(projectName, record.userId);
      if (!project) {
        await respond({
          text: `No project named \`${projectName}\`.`,
          response_type: 'ephemeral',
        });
        return;
      }

      const env = envName
        ? await this.resolveEnvironment(project.id, envName)
        : await this.resolveDefaultEnvironment(
            project.id,
            project.source?.defaultBranch ?? 'main',
          );

      if (!env) {
        await respond({
          text: envName
            ? `No environment \`${envName}\` in ${projectName}.`
            : `No environment found for default branch in ${projectName}.`,
          response_type: 'ephemeral',
        });
        return;
      }

      const deployment = await this.db.deployment.create({
        data: {
          environmentId: env.id,
          trigger: DeploymentTrigger.manual,
          imageTag: null,
          commitSha: '',
          buildStatus: BuildStatus.pending,
          lifecycleStatus: LifecycleStatus.inactive,
        },
      });

      await this.activity.log(ActivityType.deployment_started, record.userId, {
        deploymentId: deployment.id,
        environmentId: env.id,
        trigger: 'slack',
        slackUserId,
      });

      const blocks = buildDeploymentStatusBlocks({
        project: project.name,
        environment: env.name,
        status: 'queued',
      });

      let messageTs: string;
      try {
        const msg: ChatPostMessageResponse = await this.slackApi.call(
          teamId,
          'chat.postMessage',
          {
            channel: command.channel_id,
            blocks,
            text: `Deploying ${project.name} (${env.name})...`,
          },
        );
        messageTs = msg.ts as string;
      } catch {
        messageTs = '';
      }

      const slackMetadata = {
        teamId,
        channelId: command.channel_id,
        userId: slackUserId,
        messageTs,
      };

      await this.deployQueue.add('deploy', { deployment, slackMetadata });
    });

    this.app.command('/status', async ({ command, ack, respond }) => {
      await ack();

      const teamId = command.team_id;
      const record = await this.installationStore.getRecord(teamId);
      if (!record) {
        await respond({
          text: 'No linked Orbit account found for this workspace.',
          response_type: 'ephemeral',
        });
        return;
      }

      const projectName = command.text.trim();
      if (!projectName) {
        await respond({
          text: 'Usage: `/status <project>`',
          response_type: 'ephemeral',
        });
        return;
      }

      const project = await this.resolveProject(projectName, record.userId);
      if (!project) {
        await respond({
          text: `No project named \`${projectName}\`.`,
          response_type: 'ephemeral',
        });
        return;
      }

      const env = await this.resolveDefaultEnvironment(
        project.id,
        project.source?.defaultBranch ?? 'main',
      );

      if (!env) {
        await respond({
          text: `No environment found for default branch in ${projectName}.`,
          response_type: 'ephemeral',
        });
        return;
      }

      const latestDeployment = await this.db.deployment.findFirst({
        where: { environmentId: env.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!latestDeployment) {
        await respond({
          blocks: buildDeploymentStatusBlocks({
            project: project.name,
            environment: env.name,
            status: 'no_deployments',
          }),
          response_type: 'ephemeral',
        });
        return;
      }

      const statusMap: Record<
        BuildStatus,
        'queued' | 'building' | 'deploying' | 'success' | 'failed'
      > = {
        pending: 'queued',
        cloning: 'building',
        building: 'building',
        deploying: 'deploying',
        ready: 'success',
        failed: 'failed',
        aborted: 'failed',
      };

      await respond({
        blocks: buildDeploymentStatusBlocks({
          project: project.name,
          environment: env.name,
          status: statusMap[latestDeployment.buildStatus] ?? 'queued',
          commitSha: latestDeployment.commitSha,
          commitMessage: latestDeployment.commitMessage ?? undefined,
        }),
        response_type: 'ephemeral',
      });
    });

    this.app.command('/rollback', async ({ command, ack, respond }) => {
      await ack();

      const teamId = command.team_id;
      const slackUserId = command.user_id;

      const isUserAuthorized = await this.isAuthorized(teamId, slackUserId);
      if (!isUserAuthorized) {
        await respond({
          text: "You're not authorized. Ask the workspace admin to run `/slack add @you`.",
          response_type: 'ephemeral',
        });
        return;
      }

      const record = await this.installationStore.getRecord(teamId);
      if (!record) {
        await respond({
          text: 'No linked Orbit account found for this workspace.',
          response_type: 'ephemeral',
        });
        return;
      }

      const parts = command.text.trim().split(/\s+/);
      const projectName = parts[0];
      const envName = parts[1] || null;

      if (!projectName) {
        await respond({
          text: 'Usage: `/rollback <project> [environment]`',
          response_type: 'ephemeral',
        });
        return;
      }

      const project = await this.resolveProject(projectName, record.userId);
      if (!project) {
        await respond({
          text: `No project named \`${projectName}\`.`,
          response_type: 'ephemeral',
        });
        return;
      }

      const env = envName
        ? await this.resolveEnvironment(project.id, envName)
        : await this.resolveDefaultEnvironment(
            project.id,
            project.source?.defaultBranch ?? 'main',
          );

      if (!env) {
        await respond({
          text: envName
            ? `No environment \`${envName}\` in ${projectName}.`
            : `No environment found for default branch in ${projectName}.`,
          response_type: 'ephemeral',
        });
        return;
      }

      const previousDeployment = await this.db.deployment.findFirst({
        where: {
          environmentId: env.id,
          lifecycleStatus: LifecycleStatus.inactive,
          buildStatus: BuildStatus.ready,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!previousDeployment) {
        await respond({
          text: `No previous successful deployment to rollback to in ${projectName} (${env.name}).`,
          response_type: 'ephemeral',
        });
        return;
      }

      const deployment = await this.db.deployment.create({
        data: {
          environmentId: env.id,
          trigger: DeploymentTrigger.rollback,
          commitSha: previousDeployment.commitSha,
          commitMessage: previousDeployment.commitMessage,
          imageTag: previousDeployment.imageTag,
          buildStatus: BuildStatus.pending,
          lifecycleStatus: LifecycleStatus.inactive,
        },
      });

      await this.activity.log(
        ActivityType.deployment_rolled_back,
        record.userId,
        {
          deploymentId: deployment.id,
          previousDeploymentId: previousDeployment.id,
          environmentId: env.id,
          trigger: DeploymentTrigger.rollback,
          slackUserId,
        },
      );

      const blocks = buildDeploymentStatusBlocks({
        project: project.name,
        environment: env.name,
        status: 'queued',
      });

      let messageTs: string;
      try {
        const msg: ChatPostMessageResponse = await this.slackApi.call(
          teamId,
          'chat.postMessage',
          {
            channel: command.channel_id,
            blocks,
            text: `Rolling back ${project.name} (${env.name})...`,
          },
        );
        messageTs = msg.ts as string;
      } catch {
        messageTs = '';
      }

      const slackMetadata = {
        teamId,
        channelId: command.channel_id,
        userId: slackUserId,
        messageTs,
      };

      await this.deployQueue.add('rollback', {
        deployment,
        skipImageBuild: true,
        slackMetadata,
      });
    });

    this.app.command('/slack', async ({ command, ack, respond }) => {
      await ack();

      const teamId = command.team_id;
      const slackUserId = command.user_id;

      const record = await this.installationStore.getRecord(teamId);
      if (!record) {
        await respond({
          text: 'No linked Orbit account found for this workspace.',
          response_type: 'ephemeral',
        });
        return;
      }

      const isInstaller = await this.isInstaller(teamId, slackUserId);
      if (!isInstaller) {
        await respond({
          text: 'Only the Orbit app installer can manage user permissions.',
          response_type: 'ephemeral',
        });
        return;
      }

      const parts = command.text.trim().split(/\s+/);
      const action = parts[0];
      const mentionText = parts.slice(1).join(' ');
      const targetUserId = this.extractMentionId(mentionText);

      if (action === 'add') {
        if (!targetUserId) {
          await respond({
            text: 'Usage: `/slack add @user` — mention the user to authorize.',
            response_type: 'ephemeral',
          });
          return;
        }

        const isUserAuthorized = await this.isAuthorized(teamId, targetUserId);
        if (isUserAuthorized) {
          await respond({
            text: `<@${targetUserId}> is already authorized.`,
            response_type: 'ephemeral',
          });
          return;
        }

        await this.db.slackInstallation.update({
          where: { id: record.id },
          data: {
            authorizedSlackUserIds: {
              push: targetUserId,
            },
          },
        });

        await respond({
          text: `Added <@${targetUserId}> as an authorized user.`,
          response_type: 'ephemeral',
        });
      } else if (action === 'revoke') {
        if (!targetUserId) {
          await respond({
            text: 'Usage: `/slack revoke @user` — mention the user to revoke.',
            response_type: 'ephemeral',
          });
          return;
        }

        if (targetUserId === record.installerSlackUserId) {
          await respond({
            text: 'Cannot revoke the installer.',
            response_type: 'ephemeral',
          });
          return;
        }

        await this.db.slackInstallation.update({
          where: { id: record.id },
          data: {
            authorizedSlackUserIds: record.authorizedSlackUserIds.filter(
              (id) => id !== targetUserId,
            ),
          },
        });

        await respond({
          text: `Revoked permissions for <@${targetUserId}>.`,
          response_type: 'ephemeral',
        });
      } else {
        await respond({
          text: 'Usage: `/slack add @user` or `/slack revoke @user`',
          response_type: 'ephemeral',
        });
      }
    });
  }

  private async isAuthorized(
    teamId: string,
    slackUserId: string,
  ): Promise<boolean> {
    const record = await this.installationStore.getRecord(teamId);
    if (!record) return false;
    return (
      record.installerSlackUserId === slackUserId ||
      record.authorizedSlackUserIds.includes(slackUserId)
    );
  }

  private async isInstaller(
    teamId: string,
    slackUserId: string,
  ): Promise<boolean> {
    const record = await this.installationStore.getRecord(teamId);
    if (!record) return false;
    return record.installerSlackUserId === slackUserId;
  }

  private async resolveProject(name: string, userId: string) {
    return this.db.project.findFirst({
      where: { name, ownerId: userId },
      include: { source: true, environments: true },
    });
  }

  private async resolveEnvironment(projectId: string, name: string) {
    return this.db.environment.findFirst({
      where: { projectId, name },
    });
  }

  private async resolveDefaultEnvironment(projectId: string, branch: string) {
    return this.db.environment.findFirst({
      where: { projectId, branch },
    });
  }

  private extractMentionId(text: string): string | null {
    const match = text.match(/<@([A-Z0-9]+)(\|[^>]+)?>/);
    return match ? match[1] : null;
  }
}
