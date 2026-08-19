import type { Request, Response } from 'express';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { RequestLogger } from '@src/common/logger';

jest.mock('@src/common/logger', () => ({
  RequestLogger: { info: jest.fn() },
}));

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;

  beforeEach(() => {
    middleware = new RequestLoggerMiddleware();
    jest.clearAllMocks();
  });

  it('calls next without waiting for the response to finish', () => {
    const next = jest.fn();
    const res = { on: jest.fn() } as unknown as Response;
    const req = {
      method: 'GET',
      originalUrl: '/api/projects',
      get: jest.fn(),
    } as unknown as Request;

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(RequestLogger.info).not.toHaveBeenCalled();
  });

  it('logs request details once the response finishes', () => {
    const next = jest.fn();
    let finishHandler: () => void = () => {};
    const res = {
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'finish') finishHandler = handler;
      }),
      statusCode: 201,
    } as unknown as Response;
    const req = {
      method: 'POST',
      originalUrl: '/api/projects',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('orbit-cli/1.0'),
    } as unknown as Request;

    middleware.use(req, res, next);
    finishHandler();

    expect(RequestLogger.info).toHaveBeenCalledWith(
      'request',
      expect.objectContaining({
        method: 'POST',
        path: '/api/projects',
        statusCode: 201,
        ip: '127.0.0.1',
        userAgent: 'orbit-cli/1.0',
        durationMs: expect.any(Number),
      }),
    );
  });
});
