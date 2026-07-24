import { ResponseInterceptor } from './response.interceptor';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  const mockContext = (contentType?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({
          getHeader: () => contentType,
        }),
      }),
    }) as unknown as ExecutionContext;

  const mockHandler = (data: any): CallHandler => ({
    handle: () => of(data),
  });

  it('wraps plain object in { data }', (done) => {
    const ctx = mockContext();
    const handler = mockHandler({ id: 1 });

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual({ data: { id: 1 } });
      done();
    });
  });

  it('passes through SSE streams unchanged', (done) => {
    const ctx = mockContext('text/event-stream');
    const handler = mockHandler('sse data');

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toBe('sse data');
      done();
    });
  });

  it('wraps null in { data }', (done) => {
    const ctx = mockContext();
    const handler = mockHandler(null);

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual({ data: null });
      done();
    });
  });

  it('wraps string in { data }', (done) => {
    const ctx = mockContext();
    const handler = mockHandler('hello');

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual({ data: 'hello' });
      done();
    });
  });
});
