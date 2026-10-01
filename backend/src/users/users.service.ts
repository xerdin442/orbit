import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DbService } from '@src/db/db.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async findByGithubUserId(githubUserId: number) {
    return this.db.user.findUnique({ where: { githubUserId } });
  }

  async findById(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        slackInstallation: {
          select: {
            teamId: true,
            teamName: true,
            installerSlackUserId: true,
            isActive: true,
            createdAt: true,
          },
        },
        externalConnections: {
          select: {
            provider: true,
            label: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async create(data: {
    githubUserId: number;
    githubUsername: string;
    email?: string;
    avatarUrl?: string;
  }) {
    return this.db.user.create({ data });
  }
}
