import { Injectable } from '@nestjs/common';
import { Secrets } from '../common/secrets';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/client';

@Injectable()
export class DbService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({ connectionString: Secrets.DATABASE_URL });
    super({ adapter });
  }
}
