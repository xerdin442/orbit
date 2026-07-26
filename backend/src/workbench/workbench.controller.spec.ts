import { Test, TestingModule } from '@nestjs/testing';
import { WorkbenchController } from './workbench.controller';
import { WorkbenchService } from './workbench.service';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest } from '@src/common/types';

const mockService = {
  getSchema: jest.fn(),
  getTables: jest.fn(),
  getTableData: jest.fn(),
  executeQuery: jest.fn(),
};

describe('WorkbenchController', () => {
  let controller: WorkbenchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkbenchController],
      providers: [
        {
          provide: WorkbenchService,
          useValue: mockService,
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<WorkbenchController>(WorkbenchController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const req = { user: { id: 'user-1' } } as AuthenticatedRequest;

  it('calls getSchema with resource id and user id', async () => {
    mockService.getSchema.mockResolvedValue({ databases: [] });

    await controller.getSchema('r1', req);

    expect(mockService.getSchema).toHaveBeenCalledWith('r1', 'user-1');
  });

  it('calls getTables', async () => {
    mockService.getTables.mockResolvedValue({ tables: [] });

    await controller.getTables('r1', req);

    expect(mockService.getTables).toHaveBeenCalledWith('r1', 'user-1');
  });

  it('calls getTableData with parsed options', async () => {
    mockService.getTableData.mockResolvedValue({
      columns: [],
      rows: [],
      meta: {},
    });

    await controller.getTableData('r1', 'users', req, {
      page: 2,
      limit: 50,
      sort: 'email:desc',
      filter: '{"active":true}',
    });

    expect(mockService.getTableData).toHaveBeenCalledWith(
      'r1',
      'user-1',
      'users',
      expect.objectContaining({
        page: 2,
        limit: 50,
        sort: [{ column: 'email', direction: 'desc' }],
        filter: { active: true },
      }),
    );
  });

  it('calls executeQuery', async () => {
    mockService.executeQuery.mockResolvedValue({
      columns: [],
      rows: [],
      rowCount: 0,
    });

    await controller.executeQuery('r1', req, { query: 'SELECT 1' });

    expect(mockService.executeQuery).toHaveBeenCalledWith(
      'r1',
      'user-1',
      'SELECT 1',
    );
  });
});
