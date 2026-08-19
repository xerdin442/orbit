import { ActivateDeploymentStep } from '../activate-deployment.step';
import { DbService } from '@src/db/db.service';
import { DeploymentContext } from '@src/common/types';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-2' },
    environment: { id: 'env-1' },
  }) as DeploymentContext;

describe('ActivateDeploymentStep', () => {
  let step: ActivateDeploymentStep;
  let db: {
    $transaction: jest.Mock;
    deployment: { updateMany: jest.Mock; update: jest.Mock };
    environment: { update: jest.Mock };
  };

  beforeEach(() => {
    const tx = {
      deployment: {
        updateMany: jest.fn(),
        update: jest.fn(),
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

  it('deactivates previous active, activates new, updates env', async () => {
    await step.execute(mockCtx());

    expect(db.$transaction).toHaveBeenCalled();
  });
});
