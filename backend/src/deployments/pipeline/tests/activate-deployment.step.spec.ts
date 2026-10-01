import { ActivateDeploymentStep } from '../activate-deployment.step';
import { DbService } from '@src/db/db.service';
import {
  DeploymentContext,
  DeploymentStepExecutionError,
} from '@src/common/types';
import { BuildStatus, LifecycleStatus } from '@generated/client';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-2' },
    environment: { id: 'env-1' },
  }) as DeploymentContext;

describe('ActivateDeploymentStep', () => {
  let step: ActivateDeploymentStep;
  let db: {
    $transaction: jest.Mock;
    deployment: { updateMany: jest.Mock };
    environment: { update: jest.Mock };
  };

  beforeEach(() => {
    const tx = {
      deployment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      environment: {
        update: jest.fn(),
      },
    };

    db = {
      $transaction: jest.fn((cb: Function) => cb(tx)),
      deployment: tx.deployment,
      environment: tx.environment,
    };

    step = new ActivateDeploymentStep(db as unknown as DbService);
  });

  it('activates the new deployment, deactivates the previous one and updates the env', async () => {
    await step.execute(mockCtx());

    expect(db.deployment.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'dep-2', buildStatus: { not: BuildStatus.aborted } },
      data: {
        buildStatus: BuildStatus.ready,
        lifecycleStatus: LifecycleStatus.active,
      },
    });
    expect(db.deployment.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        environmentId: 'env-1',
        lifecycleStatus: LifecycleStatus.active,
        id: { not: 'dep-2' },
      },
      data: { lifecycleStatus: LifecycleStatus.inactive },
    });
    expect(db.environment.update).toHaveBeenCalledWith({
      where: { id: 'env-1' },
      data: { currentDeploymentId: 'dep-2' },
    });
  });

  it('throws before touching the live deployment if this one was aborted', async () => {
    db.deployment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(step.execute(mockCtx())).rejects.toThrow(
      DeploymentStepExecutionError,
    );

    expect(db.deployment.updateMany).toHaveBeenCalledTimes(1);
    expect(db.environment.update).not.toHaveBeenCalled();
  });
});
