import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { Secrets } from './common/secrets';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { applyThrottlerConfig } from './common/util';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { EnvironmentsModule } from './environments/environments.module';
import { InfrastructureModule } from '@src/infrastructure/infrastructure.module';
import { DeploymentsModule } from '@src/deployments/deployments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      redis: {
        host: Secrets.REDIS_HOST,
        port: Secrets.REDIS_PORT,
        password: Secrets.REDIS_PASSWORD,
        family: 0,
      },
    }),
    ThrottlerModule.forRoot(applyThrottlerConfig()),
    DbModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    EnvironmentsModule,
    InfrastructureModule,
    DeploymentsModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
