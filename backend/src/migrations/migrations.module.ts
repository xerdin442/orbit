import { Module } from '@nestjs/common';
import { MigrationsService } from './migrations.service';
import { MigrationsController } from './migrations.controller';
import { RailwayProvider } from './providers/railway.provider';
import { VercelProvider } from './providers/vercel.provider';

@Module({
  controllers: [MigrationsController],
  providers: [MigrationsService, RailwayProvider, VercelProvider],
})
export class MigrationsModule {}
