import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Response } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map<unknown, unknown>((data) => {
        if (isStreamOrBuffer(data, response)) {
          return data;
        }

        return { data };
      }),
    );
  }
}

function isStreamOrBuffer(data: unknown, response: Response): boolean {
  if (data === undefined || data === null) {
    return false;
  }

  const contentType = response.getHeader('Content-Type');
  if (
    typeof contentType === 'string' &&
    contentType.startsWith('text/event-stream')
  ) {
    return true;
  }

  if (Buffer.isBuffer(data)) {
    return true;
  }

  if (typeof data === 'object' && data !== null && 'pipe' in data) {
    return true;
  }

  return false;
}
