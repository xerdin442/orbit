import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import {
  App,
  ExpressReceiver,
  type AnyMiddlewareArgs,
  type AllMiddlewareArgs,
  type Middleware,
  type RespondFn,
  type SlashCommand,
  type SlackCommandMiddlewareArgs,
} from '@slack/bolt';
import { ChatPostMessageResponse } from '@slack/web-api';
import type { Queue } from 'bullmq';
import type { RedisClientType } from 'redis';
import { Secrets } from '@src/common/secrets';
import { REDIS_CLIENT } from '@src/common/cache';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';
import { DeploymentsService } from '@src/deployments/deployments.service';
import { SlackInstallationStore } from './slack-installation.store';
import { SlackApiService } from './slack-api.service';
import {
  BUILD_STATUS_TO_CARD_STATUS,
  buildDeploymentStatusBlocks,
  formatDuration,
} from './blocks/deployment-status.blocks';
import type { DeploymentJob } from '@src/common/types';
import {
  DeploymentTrigger,
  ActivityType,
  LifecycleStatus,
  BuildStatus,
} from '@generated/client';
import { Logger } from '@src/common/logger';

interface SlackCommandContext {
  isAuthorized: boolean;
  isInstaller: boolean;
  installationId: string;
  ownerId: string;
}

type SlackCommandArgs = SlackCommandMiddlewareArgs &
  AllMiddlewareArgs<SlackCommandContext>;

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_COMMANDS = 10;
const RATE_LIMIT_MAX_DEPLOYMENTS = 2;

@Injectable()
export class SlackBoltService implements OnModuleInit {
  private readonly logger = Logger(SlackBoltService.name);
  public readonly receiver: ExpressReceiver;
  public readonly app: App<SlackCommandContext>;

  constructor(
    private readonly installationStore: SlackInstallationStore,
    private readonly slackApi: SlackApiService,
    private readonly activity: ActivityService,
    private readonly db: DbService,
    private readonly deployments: DeploymentsService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    @InjectQueue('deployments')
    private readonly deployQueue: Queue<DeploymentJob>,
  ) {
    this.receiver = new ExpressReceiver({
      signingSecret: Secrets.SLACK_SIGNING_SECRET,
      installationStore: this.installationStore,
      processBeforeResponse: true,
    });

    this.app = new App<SlackCommandContext>({
      receiver: this.receiver,
    });

    this.registerMiddleware();
    this.registerLifecycleEvents();
    this.registerCommands();
    this.registerViewSubmissions();
  }

  async onModuleInit(): Promise<void> {
    await this.app.init();
  }

  private registerMiddleware(): void {
    this.app.use(this.authorizationMiddleware());
    this.app.use(this.rateLimitMiddleware());
  }

  private authorizationMiddleware(): Middleware<
    AnyMiddlewareArgs,
    SlackCommandContext
  > {
    return async (args) => {
      if (!this.isSlashCommandBody(args.body)) {
        await args.next();
        return;
      }

      const { context, ack, respond, next } =
        args as SlackCommandMiddlewareArgs &
          AllMiddlewareArgs<SlackCommandContext>;
      const teamId = context.teamId;
      const userId = context.userId;

      if (!teamId || !userId) {
        await ack();
        await respond({
          text: 'Unable to identify the Slack workspace or user.',
          response_type: 'ephemeral',
        });
        return;
      }

      const record = await this.installationStore.getRecord(teamId);
      if (!record) {
        await ack();
        await respond({
          text: 'No linked Orbit account found for this workspace.',
          response_type: 'ephemeral',
        });
        return;
      }

      context.isInstaller = record.installerSlackUserId === userId;
      context.isAuthorized =
        context.isInstaller || record.authorizedSlackUserIds.includes(userId);
      context.installationId = record.id;
      context.ownerId = record.userId;

      await next();
    };
  }

  private rateLimitMiddleware(): Middleware<
    AnyMiddlewareArgs,
    SlackCommandContext
  > {
    return async (args) => {
      if (!this.isSlashCommandBody(args.body)) {
        await args.next();
        return;
      }

      const { context, ack, respond, next } =
        args as SlackCommandMiddlewareArgs &
          AllMiddlewareArgs<SlackCommandContext>;
      const command = args.body.command;
      const userId = context.userId;
      const teamId = context.teamId;

      if (!teamId || !userId) {
        await next();
        return;
      }

      const isDeploymentCommand =
        command === '/deploy' || command === '/rollback';
      const limit = isDeploymentCommand
        ? RATE_LIMIT_MAX_DEPLOYMENTS
        : RATE_LIMIT_MAX_COMMANDS;
      const key = `slack:rate:${teamId}:${userId}:${command}`;

      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
      }

      if (count > limit) {
        await ack();
        await respond({
          text: `Rate limit exceeded. Please wait 60s before using ${command} again.`,
          response_type: 'ephemeral',
        });
        return;
      }

      await next();
    };
  }

  private registerLifecycleEvents(): void {
    this.app.event('app_uninstalled', async ({ context }) => {
      const { teamId, enterpriseId, isEnterpriseInstall } = context;
      await this.installationStore.deleteInstallation({
        teamId,
        enterpriseId,
        isEnterpriseInstall,
      });

      this.slackApi.invalidateClient(teamId as string);

      try {
        await this.activity.log(
          ActivityType.slack_installation_removed,
          'system',
          {
            teamId,
            enterpriseId,
          },
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

      this.slackApi.invalidateClient(teamId as string);

      try {
        await this.activity.log(ActivityType.slack_token_revoked, 'system', {
          teamId,
          enterpriseId,
        });
      } catch {
        // activity logging does not block event processing
      }
    });
  }

  private registerCommands(): void {
    this.app.command('/deploy', async (args) => {
      await this.handleCommand(args, async ({ command, context, respond }) => {
        if (!context.isAuthorized) {
          await respond({
            text: "You're not authorized. Ask the workspace admin to run `/slack add @you`.",
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

        const project = await this.resolveProject(projectName, context.ownerId);
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

        await this.openConfirmationModal(
          command,
          project.id,
          project.name,
          env.id,
          env.name,
          'deploy',
        );
      });
    });

    this.app.command('/rollback', async (args) => {
      await this.handleCommand(args, async ({ command, context, respond }) => {
        if (!context.isAuthorized) {
          await respond({
            text: "You're not authorized. Ask the workspace admin to run `/slack add @you`.",
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

        const project = await this.resolveProject(projectName, context.ownerId);
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

        await this.openConfirmationModal(
          command,
          project.id,
          project.name,
          env.id,
          env.name,
          'rollback',
        );
      });
    });

    this.app.command('/status', async (args) => {
      await this.handleCommand(args, async ({ command, context, respond }) => {
        const parts = command.text.trim().split(/\s+/);
        const projectName = parts[0];
        const envName = parts[1] || null;

        if (!projectName) {
          await respond({
            text: 'Usage: `/status <project> [environment]`',
            response_type: 'ephemeral',
          });
          return;
        }

        const project = await this.resolveProject(projectName, context.ownerId);
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

        await respond({
          blocks: buildDeploymentStatusBlocks({
            project: project.name,
            environment: env.name,
            status: BUILD_STATUS_TO_CARD_STATUS[latestDeployment.buildStatus],
            commitSha: latestDeployment.commitSha,
            commitMessage: latestDeployment.commitMessage ?? undefined,
            startedAt: latestDeployment.createdAt.toISOString(),
            duration: latestDeployment.completedAt
              ? formatDuration(
                  latestDeployment.createdAt.getTime(),
                  latestDeployment.completedAt.getTime(),
                )
              : undefined,
          }),
          response_type: 'ephemeral',
        });
      });
    });

    this.app.command('/slack', async (args) => {
      await this.handleCommand(args, async ({ command, context, respond }) => {
        if (!context.isInstaller) {
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
          await this.handleAddUser(command, targetUserId, respond);
        } else if (action === 'revoke') {
          await this.handleRevokeUser(command, targetUserId, respond);
        } else {
          await respond({
            text: 'Usage: `/slack add @user` or `/slack revoke @user`',
            response_type: 'ephemeral',
          });
        }
      });
    });
  }

  private registerViewSubmissions(): void {
    this.app.view('deploy_confirm', async ({ ack, body, respond }) => {
      await ack();

      const metadata = JSON.parse(body.view.private_metadata) as {
        teamId: string;
        channelId: string;
        userId: string;
        projectId: string;
        projectName: string;
        environmentId: string;
        environmentName: string;
        action: 'deploy' | 'rollback';
      };

      const record = await this.installationStore.getRecord(metadata.teamId);
      if (!record) {
        this.logger.error(
          `No installation record found for team ${metadata.teamId} during view submission`,
        );
        return;
      }

      const startedAt = new Date().toISOString();
      const blocks = buildDeploymentStatusBlocks({
        project: metadata.projectName,
        environment: metadata.environmentName,
        status: 'queued',
        triggeredBy: metadata.userId,
        startedAt,
      });

      let messageTs: string;
      try {
        const msg: ChatPostMessageResponse = await this.slackApi.call(
          metadata.teamId,
          'chat.postMessage',
          {
            channel: metadata.channelId,
            blocks,
            text: `Deploying ${metadata.projectName} (${metadata.environmentName})...`,
          },
        );
        messageTs = msg.ts as string;
      } catch (error) {
        this.logger.error(
          `Failed to post Slack status card: ${error instanceof Error ? error.message : String(error)}`,
        );

        await respond({
          text: `Unable to start ${metadata.action} for ${metadata.projectName} (${metadata.environmentName}): the status card could not be displayed.`,
          response_type: 'ephemeral',
        });
        return;
      }

      const slackMetadata = {
        teamId: metadata.teamId,
        channelId: metadata.channelId,
        userId: metadata.userId,
        messageTs,
        startedAt,
      };

      if (metadata.action === 'deploy') {
        const deployment = await this.deployments.createDeployment(
          metadata.environmentId,
          record.userId,
          DeploymentTrigger.manual,
        );

        await this.deployQueue.add('deploy', {
          deployment,
          slackMetadata,
        });
      } else {
        const previousDeployment = await this.db.deployment.findFirst({
          where: {
            environmentId: metadata.environmentId,
            lifecycleStatus: LifecycleStatus.inactive,
            buildStatus: BuildStatus.ready,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!previousDeployment) {
          await this.slackApi.call(metadata.teamId, 'chat.postMessage', {
            channel: metadata.channelId,
            text: `No previous successful deployment to rollback to in ${metadata.projectName} (${metadata.environmentName}).`,
          });
          return;
        }

        const deployment = await this.deployments.findForRollback(
          previousDeployment.id,
          record.userId,
        );

        await this.deployQueue.add('rollback', {
          deployment,
          skipImageBuild: true,
          slackMetadata,
        });
      }
    });
  }

  private isSlashCommandBody(
    body: AnyMiddlewareArgs['body'],
  ): body is SlashCommand {
    return (
      typeof body === 'object' &&
      body !== null &&
      'command' in body &&
      typeof (body as Record<string, unknown>).command === 'string'
    );
  }

  private async handleAddUser(
    command: SlashCommand,
    targetUserId: string | null,
    respond: RespondFn,
  ): Promise<void> {
    if (!targetUserId) {
      await respond({
        text: 'Usage: `/slack add @user` — mention the user to authorize.',
        response_type: 'ephemeral',
      });
      return;
    }

    const record = await this.installationStore.getRecord(command.team_id);
    if (!record) {
      await respond({
        text: 'No linked Orbit account found for this workspace.',
        response_type: 'ephemeral',
      });
      return;
    }

    if (targetUserId === record.installerSlackUserId) {
      await respond({
        text: 'The installer is already authorized.',
        response_type: 'ephemeral',
      });
      return;
    }

    if (record.authorizedSlackUserIds.includes(targetUserId)) {
      await respond({
        text: `<@${targetUserId}> is already authorized.`,
        response_type: 'ephemeral',
      });
      return;
    }

    try {
      await this.slackApi.call(command.team_id, 'users.info', {
        user: targetUserId,
      });
    } catch {
      await respond({
        text: `<@${targetUserId}> is not a valid Slack user in this workspace.`,
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
  }

  private async handleRevokeUser(
    command: SlashCommand,
    targetUserId: string | null,
    respond: RespondFn,
  ): Promise<void> {
    if (!targetUserId) {
      await respond({
        text: 'Usage: `/slack revoke @user` — mention the user to revoke.',
        response_type: 'ephemeral',
      });
      return;
    }

    const record = await this.installationStore.getRecord(command.team_id);
    if (!record) {
      await respond({
        text: 'No linked Orbit account found for this workspace.',
        response_type: 'ephemeral',
      });
      return;
    }

    if (targetUserId === record.installerSlackUserId) {
      await respond({
        text: "The installer's permissions cannot be revoked.",
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
  }

  private async openConfirmationModal(
    command: SlashCommand,
    projectId: string,
    projectName: string,
    environmentId: string,
    environmentName: string,
    action: 'deploy' | 'rollback',
  ): Promise<void> {
    const title =
      action === 'deploy' ? 'Confirm Deployment' : 'Confirm Rollback';
    const submitText = action === 'deploy' ? 'Deploy' : 'Rollback';
    const description =
      action === 'deploy'
        ? `Start a new deployment of *${projectName}* to *${environmentName}*?`
        : `Rollback *${projectName}* to the previous deployment in *${environmentName}*?`;

    await this.slackApi.call(command.team_id, 'views.open', {
      trigger_id: command.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'deploy_confirm',
        title: { type: 'plain_text', text: title },
        submit: { type: 'plain_text', text: submitText },
        close: { type: 'plain_text', text: 'Cancel' },
        private_metadata: JSON.stringify({
          teamId: command.team_id,
          channelId: command.channel_id,
          userId: command.user_id,
          projectId,
          projectName,
          environmentId,
          environmentName,
          action,
        }),
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: description,
            },
          },
        ],
      },
    });
  }

  private async handleCommand(
    args: SlackCommandArgs,
    handler: (args: SlackCommandArgs) => Promise<void>,
  ): Promise<void> {
    const { ack, respond } = args;
    await ack();

    try {
      await handler(args);
    } catch (error) {
      this.logger.error(
        `Slack command error: ${error instanceof Error ? error.message : String(error)}`,
      );
      await respond({
        text: 'Something went wrong while processing your command. Please try again.',
        response_type: 'ephemeral',
      });
    }
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
