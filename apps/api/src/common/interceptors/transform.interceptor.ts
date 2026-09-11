import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TransformResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Wraps all successful responses in a consistent envelope.
 * Error responses are handled by the global HttpExceptionFilter.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, TransformResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<TransformResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        meta: {
          timestamp: new Date().toISOString(),
        },
      }))
    );
  }
}
