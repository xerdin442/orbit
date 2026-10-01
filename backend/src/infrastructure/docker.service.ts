import { Injectable } from '@nestjs/common';
import Docker from 'dockerode';
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

  async containerLogs(containerId: string, options?: { tail?: number }) {
    const container = this.docker.getContainer(containerId);
    const stream = await container.logs({
      follow: false as const,
      tail: options?.tail,
      stdout: true,
      stderr: true,
    });
    return stream;
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
