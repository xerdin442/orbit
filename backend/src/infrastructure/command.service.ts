import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { CommandResult } from '@src/common/types';

@Injectable()
export class CommandService {
  execute(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: false });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ exitCode: code, stdout, stderr });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  async gitClone(repoUrl: string, branch: string, targetPath: string) {
    return this.execute('git', [
      'clone',
      '--branch',
      branch,
      repoUrl,
      targetPath,
    ]);
  }

  async gitRevParse(targetPath: string) {
    return this.execute('git', ['-C', targetPath, 'rev-parse', 'HEAD']);
  }

  async gitLog(targetPath: string) {
    return this.execute('git', [
      '-C',
      targetPath,
      'log',
      '-1',
      '--format=%H%n%s%n%an%n%aI',
    ]);
  }

  async railpackBuild(sourcePath: string, imageTag: string) {
    return this.execute('railpack', ['build', sourcePath, '--tag', imageTag]);
  }
}
