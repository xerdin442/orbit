import { Global, Module } from '@nestjs/common';
import { DockerService } from '@src/infrastructure/docker.service';
import { CommandService } from '@src/infrastructure/command.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { LogService } from '@src/infrastructure/log.service';

@Global()
@Module({
  providers: [
    DockerService,
    CommandService,
    CaddyService,
    EncryptionService,
    LogService,
  ],
  exports: [
    DockerService,
    CommandService,
    CaddyService,
    EncryptionService,
    LogService,
  ],
})
export class InfrastructureModule {}
