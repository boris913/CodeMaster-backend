import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { User } from '@prisma/client';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { user?: User }>();
    const response = ctx.getResponse<Response>();

    // Utilisation de Record<string, unknown> au lieu de any
    const { method, originalUrl, body } = request as {
      method: string;
      originalUrl: string;
      body: Record<string, unknown>;
    };
    const user = request.user;

    // On nettoie les données et on s'assure qu'elles sont utilisées
    const safeBody = body ? this.sanitizeData(body) : {};

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        // On retire '_data' car il n'est pas utilisé
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log({
          message: 'Request completed',
          method,
          url: originalUrl,
          userId: user?.id,
          statusCode,
          duration: `${duration}ms`,
          body: safeBody,
        });
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;

        let statusCode = 500;
        if (error instanceof HttpException) {
          statusCode = error.getStatus();
        } else if (error instanceof Error && 'status' in error) {
          statusCode = (error as { status: number }).status;
        }

        this.logger.error({
          message: 'Request failed',
          method,
          url: originalUrl,
          userId: user?.id,
          statusCode,
          duration: `${duration}ms`,
          // On évite String(error) qui fâche ESLint
          error: error instanceof Error ? error.message : JSON.stringify(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        throw error;
      }),
    );
  }

  // Typage strict de la fonction de nettoyage
  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    if (!data) return data;

    const clone = { ...data };
    const sensitiveFields = [
      'password',
      'refreshToken',
      'token',
      'newPassword',
      'confirmPassword',
      'oldPassword',
    ];

    sensitiveFields.forEach((field) => {
      if (field in clone) {
        delete clone[field];
      }
    });

    return clone;
  }
}
