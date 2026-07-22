import { Global, Module } from '@nestjs/common';
import { DockerService } from '@src/infrastructure/docker.service';
import { CommandService } from '@src/infrastructure/command.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';

@Global()
@Module({
  providers: [DockerService, CommandService, CaddyService, EncryptionService],
  exports: [DockerService, CommandService, CaddyService, EncryptionService],
})
export class InfrastructureModule {}
