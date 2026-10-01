import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { CommandResult } from '@src/common/types';
import { Logger } from '@src/common/logger';

const logger = Logger('CommandService');

export type OnStdout = (data: string) => void;

@Injectable()
export class CommandService {
  execute(
    command: string,
    args: string[],
    onStdout?: OnStdout,
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      logger.info(`Executing: ${command} ${args.join(' ')}`);

      const child = spawn(command, args, { shell: false });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;

        if (onStdout) {
          onStdout(text);
        }
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

  async gitClone(
    repoUrl: string,
    branch: string,
    targetPath: string,
    onStdout?: OnStdout,
  ) {
    return this.execute(
      'git',
      ['clone', '--branch', branch, repoUrl, targetPath],
      onStdout,
    );
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

  async railpackBuild(
    sourcePath: string,
    imageTag: string,
    onStdout?: OnStdout,
  ) {
    return this.execute(
      'railpack',
      ['build', sourcePath, '--tag', imageTag],
      onStdout,
    );
  }
}
