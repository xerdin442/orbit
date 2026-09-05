import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { CommandResult } from '@src/common/types';
import { Secrets } from '@src/common/secrets';

export type OnOutput = (data: string) => void;

@Injectable()
export class CommandService {
  execute(
    command: string,
    args: string[],
    onStdout?: OnOutput,
    onStderr?: OnOutput,
    env?: NodeJS.ProcessEnv,
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: false, env });

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
        const text = data.toString();
        stderr += text;

        if (onStderr) {
          onStderr(text);
        }
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
    onStdout?: OnOutput,
    onStderr?: OnOutput,
  ) {
    return this.execute(
      'git',
      ['clone', '--branch', branch, repoUrl, targetPath],
      onStdout,
      onStderr,
      { ...process.env, GIT_TERMINAL_PROMPT: '0' },
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
    startCommand?: string,
    envVars?: string[],
    onStdout?: OnOutput,
    onStderr?: OnOutput,
  ) {
    const args = [
      'build',
      sourcePath,
      '--name',
      imageTag,
      '--error-missing-start',
    ];

    for (const variable of envVars ?? []) {
      args.push('--env', variable);
    }

    if (startCommand) {
      args.push('--start-cmd', startCommand);
    }

    return this.execute('railpack', args, onStdout, onStderr);
  }

  async dockerBuild(
    contextPath: string,
    dockerfilePath: string,
    imageTag: string,
    buildArgs?: string[],
    onStdout?: OnOutput,
    onStderr?: OnOutput,
  ) {
    const args = ['build', '--file', dockerfilePath, '--tag', imageTag];

    for (const arg of buildArgs ?? []) {
      args.push('--build-arg', arg);
    }

    args.push(contextPath);

    return this.execute('docker', args, onStdout, onStderr, {
      ...process.env,
      DOCKER_HOST: `unix://${Secrets.DOCKER_SOCKET}`,
      DOCKER_BUILDKIT: '1',
    });
  }
}
