import { Injectable } from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import { User } from '@generated/client';

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async findByGithubUserId(githubUserId: number): Promise<User | null> {
    return this.db.user.findUnique({ where: { githubUserId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async create(data: {
    githubUserId: number;
    githubUsername: string;
    email?: string;
    avatarUrl?: string;
  }): Promise<User> {
    return this.db.user.create({ data });
  }
}
