import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        error = (body.error as string) ?? exception.message;
        details = body.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = this.mapPrismaError(exception);
      message = `Database operation failed: ${exception.code}`;
      error = 'Database Error';
      details = exception.meta;
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // Never leak internal error details in production.
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Request ${request.method} ${request.url} failed:`,
        exception instanceof Error ? exception.stack : String(exception)
      );
      if (process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
        error = 'Internal Server Error';
        details = undefined;
      }
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        error,
        path: request.url,
        timestamp: new Date().toISOString(),
        ...(details !== undefined ? { details } : {}),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): HttpStatus {
    switch (error.code) {
      case 'P2002':
        return HttpStatus.CONFLICT;
      case 'P2025':
        return HttpStatus.NOT_FOUND;
      case 'P2003':
      case 'P2014':
      case 'P2018':
        return HttpStatus.BAD_REQUEST;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}
