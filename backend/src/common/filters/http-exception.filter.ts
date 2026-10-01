import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import Logger from '../logger';
import { ErrorResponse } from '../types';

const appExceptionLogger = Logger('ExceptionFilter');

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const responseObj =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as Record<string, unknown>)
          : null;

      const rawMessage: unknown = responseObj?.message ?? exception.message;
      const rawCode: unknown = responseObj?.error ?? exception.name;

      const message: string = Array.isArray(rawMessage)
        ? rawMessage.map((m) => String(m)).join('; ')
        : String(rawMessage);
      const code: string =
        typeof rawCode === 'string' ? rawCode : String(rawCode);

      const body: ErrorResponse = {
        error: { code, message },
      };

      if (status >= 500) {
        appExceptionLogger.error(JSON.stringify(body));
      }

      response.status(status).json(body);
      return;
    }

    appExceptionLogger.error(
      `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
