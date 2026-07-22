import { Global, Module } from '@nestjs/common';
import { DockerService } from '@src/infrastructure/docker.service';
import { CommandService } from '@src/infrastructure/command.service';
import { CaddyService } from '@src/infrastructure/caddy.service';

@Global()
@Module({
  providers: [DockerService, CommandService, CaddyService],
  exports: [DockerService, CommandService, CaddyService],
})
export class InfrastructureModule {}
