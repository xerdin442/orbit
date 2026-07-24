import { HealthCheckStep } from '../health-check.step';
import { DockerService } from '@src/infrastructure/docker.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';
import { DeploymentStepExecutionError } from '@src/common/types';

describe('HealthCheckStep', () => {
  let step: HealthCheckStep;
  let docker: jest.Mocked<
    Pick<
      DockerService,
      'inspectContainer' | 'stopContainer' | 'removeContainer'
    >
  >;
  let log: jest.Mocked<Pick<LogService, 'append'>>;

  beforeEach(() => {
    docker = {
      inspectContainer: jest.fn().mockResolvedValue({
        NetworkSettings: {
          Networks: { bridge: { IPAddress: '172.17.0.2' } },
        },
      }),
      stopContainer: jest.fn(),
      removeContainer: jest.fn(),
    };
    log = { append: jest.fn() };
    step = new HealthCheckStep(docker as DockerService, log as LogService);
  });

  it('skips when healthCheck is disabled', async () => {
    const ctx = {
      deployment: { id: 'dep-1' },
      project: { healthCheck: false },
      containerId: 'container-1',
    } as DeploymentContext;

    await step.execute(ctx);
    expect(docker.inspectContainer).not.toHaveBeenCalled();
  });

  it('passes when health endpoint responds ok', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true });
    const ctx = {
      deployment: { id: 'dep-1' },
      project: { healthCheck: true },
      containerId: 'container-1',
    } as DeploymentContext;

    await step.execute(ctx);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://172.17.0.2:3000/health',
    );
    delete (global as any).fetch;
  });

  it('throws on error response', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    });
    const ctx = {
      deployment: { id: 'dep-1' },
      project: { healthCheck: true },
      containerId: 'container-1',
    } as DeploymentContext;

    await expect(step.execute(ctx)).rejects.toThrow(
      DeploymentStepExecutionError,
    );
    delete (global as any).fetch;
  });

  it('retries on connection error', async () => {
    (global as any).fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true });

    const ctx = {
      deployment: { id: 'dep-1' },
      project: { healthCheck: true },
      containerId: 'container-1',
    } as DeploymentContext;

    await step.execute(ctx);

    expect((global as any).fetch).toHaveBeenCalledTimes(2);
    delete (global as any).fetch;
  });
});
