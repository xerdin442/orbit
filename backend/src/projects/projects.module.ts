import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { GitHubModule } from '@src/github/github.module';
import { CleanupModule } from '@src/cleanup/cleanup.module';

@Module({
  imports: [GitHubModule, CleanupModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
