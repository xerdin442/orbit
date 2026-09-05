import { CommandService } from './command.service';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

describe('CommandService', () => {
  let service: CommandService;
  let mockChild: MockChildProcess;

  beforeEach(() => {
    service = new CommandService();
    mockChild = new MockChildProcess();
    (spawn as jest.Mock).mockReturnValue(mockChild);
  });

  describe('execute', () => {
    it('resolves with stdout on close', async () => {
      const promise = service.execute('echo', ['hello']);
      mockChild.stdout.emit('data', Buffer.from('hello\n'));
      mockChild.emit('close', 0);

      const result = await promise;
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello\n');
    });

    it('captures stderr', async () => {
      const promise = service.execute('cmd', ['--bad']);
      mockChild.stderr.emit('data', Buffer.from('error occurred\n'));
      mockChild.emit('close', 1);

      const result = await promise;
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('error occurred\n');
    });

    it('rejects on process error', async () => {
      const promise = service.execute('nonexistent', []);
      mockChild.emit('error', new Error('spawn failed'));

      await expect(promise).rejects.toThrow('spawn failed');
    });

    it('calls onStdout callback with data chunks', async () => {
      const onStdout = jest.fn();
      const promise = service.execute('cmd', [], onStdout);
      mockChild.stdout.emit('data', Buffer.from('line1\n'));
      mockChild.stdout.emit('data', Buffer.from('line2\n'));
      mockChild.emit('close', 0);

      await promise;
      expect(onStdout).toHaveBeenCalledTimes(2);
      expect(onStdout).toHaveBeenCalledWith('line1\n');
      expect(onStdout).toHaveBeenCalledWith('line2\n');
    });

    it('calls onStderr callback with data chunks, independently of onStdout', async () => {
      const onStdout = jest.fn();
      const onStderr = jest.fn();
      const promise = service.execute('cmd', [], onStdout, onStderr);
      mockChild.stdout.emit('data', Buffer.from('normal output\n'));
      mockChild.stderr.emit('data', Buffer.from('warning: deprecated\n'));
      mockChild.emit('close', 0);

      await promise;
      expect(onStdout).toHaveBeenCalledTimes(1);
      expect(onStdout).toHaveBeenCalledWith('normal output\n');
      expect(onStderr).toHaveBeenCalledTimes(1);
      expect(onStderr).toHaveBeenCalledWith('warning: deprecated\n');
    });
  });

  describe('gitClone', () => {
    it('spawns git with correct args', async () => {
      const promise = service.gitClone(
        'https://github.com/o/r',
        'main',
        '/tmp/build',
      );
      mockChild.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['clone', '--branch', 'main', 'https://github.com/o/r', '/tmp/build'],
        {
          shell: false,
          env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }),
        },
      );
    });
  });

  describe('gitRevParse', () => {
    it('spawns git rev-parse with correct args', async () => {
      const promise = service.gitRevParse('/tmp/build');
      mockChild.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['-C', '/tmp/build', 'rev-parse', 'HEAD'],
        { shell: false },
      );
    });
  });

  describe('railpackBuild', () => {
    it('spawns railpack build with correct args', async () => {
      const promise = service.railpackBuild('/tmp/build', 'project-1:abc123');
      mockChild.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'railpack',
        [
          'build',
          '/tmp/build',
          '--name',
          'project-1:abc123',
          '--error-missing-start',
        ],
        { shell: false },
      );
    });

    it('appends --start-cmd when a start command is provided', async () => {
      const promise = service.railpackBuild(
        '/tmp/build',
        'project-1:abc123',
        'npm run start:prod',
      );
      mockChild.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'railpack',
        [
          'build',
          '/tmp/build',
          '--name',
          'project-1:abc123',
          '--error-missing-start',
          '--start-cmd',
          'npm run start:prod',
        ],
        { shell: false },
      );
    });

    it('forwards envVars as --env flags for use during the build', async () => {
      const promise = service.railpackBuild(
        '/tmp/build',
        'project-1:abc123',
        undefined,
        ['NODE_ENV=production', 'API_URL=https://api.example.com'],
      );
      mockChild.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'railpack',
        [
          'build',
          '/tmp/build',
          '--name',
          'project-1:abc123',
          '--error-missing-start',
          '--env',
          'NODE_ENV=production',
          '--env',
          'API_URL=https://api.example.com',
        ],
        { shell: false },
      );
    });
  });

  describe('dockerBuild', () => {
    it('spawns docker build with the context, dockerfile and tag', async () => {
      const promise = service.dockerBuild(
        '/tmp/build',
        '/tmp/build/Dockerfile',
        'project-1:abc123',
      );
      mockChild.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'docker',
        [
          'build',
          '--file',
          '/tmp/build/Dockerfile',
          '--tag',
          'project-1:abc123',
          '/tmp/build',
        ],
        {
          shell: false,
          env: expect.objectContaining({ DOCKER_BUILDKIT: '1' }),
        },
      );
    });

    it('forwards buildArgs as --build-arg flags before the context path', async () => {
      const promise = service.dockerBuild(
        '/tmp/build',
        '/tmp/build/Dockerfile',
        'project-1:abc123',
        ['NODE_ENV=production', 'API_URL=https://api.example.com'],
      );
      mockChild.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'docker',
        [
          'build',
          '--file',
          '/tmp/build/Dockerfile',
          '--tag',
          'project-1:abc123',
          '--build-arg',
          'NODE_ENV=production',
          '--build-arg',
          'API_URL=https://api.example.com',
          '/tmp/build',
        ],
        expect.objectContaining({ shell: false }),
      );
    });
  });
});
