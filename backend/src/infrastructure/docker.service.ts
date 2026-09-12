import { Injectable } from '@nestjs/common';
import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { Secrets } from '@src/common/secrets';

@Injectable()
export class DockerService {
  private readonly docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: Secrets.DOCKER_SOCKET });
  }

  async createContainer(options: Docker.ContainerCreateOptions) {
    return this.docker.createContainer(options);
  }

  async startContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  async stopContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    await container.stop();
  }

  async removeContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force: true });
  }

  async inspectContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    return container.inspect();
  }

  async followContainerLogs(containerId: string): Promise<PassThrough> {
    const container = this.docker.getContainer(containerId);
    const rawStream = await container.logs({
      follow: true as const,
      tail: 0,
      stdout: true,
      stderr: true,
    });

    const merged = new PassThrough();
    this.docker.modem.demuxStream(rawStream, merged, merged);
    return merged;
  }

  async getContainerLogs(containerId: string, tailLines = 60): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const rawLogs = await container.logs({
      follow: false,
      tail: tailLines,
      stdout: true,
      stderr: true,
    });

    const rawStream = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    this.docker.modem.demuxStream(rawStream, stdout, stderr);

    const chunks: Buffer[] = [];
    stdout.on('data', (c: Buffer) => chunks.push(c));
    stderr.on('data', (c: Buffer) => chunks.push(c));

    rawStream.on('end', () => {
      stdout.end();
      stderr.end();
    });

    rawStream.end(rawLogs);

    await new Promise<void>((resolve, reject) => {
      let ended = 0;
      const done = () => {
        if (++ended === 2) resolve();
      };
      const onError = (err: Error) => reject(err);

      stdout.on('end', done);
      stderr.on('end', done);
      stdout.on('error', onError);
      stderr.on('error', onError);
    });

    return Buffer.concat(chunks).toString('utf-8').trim();
  }

  async inspectImage(imageTag: string) {
    const image = this.docker.getImage(imageTag);
    return image.inspect();
  }

  async removeImage(imageTag: string) {
    const image = this.docker.getImage(imageTag);
    await image.remove();
  }

  async listImages() {
    return this.docker.listImages();
  }

  async pullImage(imageTag: string) {
    return this.docker.pull(imageTag);
  }

  async getOrCreateProjectNetwork(projectId: string) {
    const networkName = `project-${projectId}-network`;

    const existing = await this.getNetwork(networkName);
    if (existing) return existing;

    return this.docker.createNetwork({ Name: networkName, Driver: 'bridge' });
  }

  async connectContainerToNetwork(networkId: string, containerId: string) {
    const network = this.docker.getNetwork(networkId);
    await network.connect({ Container: containerId });
  }

  async removeNetwork(networkId: string) {
    const network = this.docker.getNetwork(networkId);
    await network.remove();
  }

  async createVolume(name: string) {
    return this.docker.createVolume({ Name: name });
  }

  async getVolume(name: string) {
    const volume = this.docker.getVolume(name);
    try {
      await volume.inspect();
      return volume;
    } catch {
      return null;
    }
  }

  async removeVolume(name: string) {
    const volume = this.docker.getVolume(name);
    await volume.remove();
  }

  async deleteVolumeData(name: string, mountPath: string): Promise<void> {
    const container = await this.docker.createContainer({
      Image: 'busybox',
      Cmd: ['sh', '-c', `rm -rf ${mountPath}/{*,.[!.]*} 2>/dev/null || true`],
      HostConfig: {
        Binds: [`${name}:${mountPath}`],
        AutoRemove: true,
      },
    });

    await container.start();
    await container.wait();
  }

  async checkContainerHealth(
    containerId: string,
    waitTime: number,
    resourceCheck: boolean = false,
  ): Promise<boolean> {
    const deadline = Date.now() + waitTime;

    while (Date.now() < deadline) {
      try {
        const container = await this.inspectContainer(containerId);
        const state = container.State;

        if (state.Status === 'running') {
          if (resourceCheck && state.Health?.Status !== 'healthy') {
            throw new Error('Resource container not ready yet');
          }

          return true;
        }

        if (state.Status === 'exited' || state.Status === 'dead') {
          return false;
        }
      } catch {
        // not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return false;
  }

  private async getNetwork(name: string) {
    const networks = await this.docker.listNetworks({
      filters: { name: [name] },
    });

    if (networks.length === 0) {
      return null;
    }

    return this.docker.getNetwork(networks[0].Id);
  }
}
