import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Secrets } from '@src/common/secrets';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/client';

@Injectable()
export class DbService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({ connectionString: Secrets.DATABASE_URL });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
