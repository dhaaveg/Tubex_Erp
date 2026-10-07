import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';
import { getCurrentSession } from './auth';

export type ApiRouteHandler = (
  request: Request,
  context?: any
) => Promise<Response | NextResponse> | Response | NextResponse;

export interface ApiHandlerOptions {
  requireAuth?: boolean;
  allowedRoles?: string[];
}

/**
 * Higher-order wrapper for API route handlers providing:
 * - High-precision performance timing
 * - Daily file-based request & exception logging (logs/)
 * - Uncaught exception recovery & database sanitization
 * - Consistent sanitized JSON responses: { success: false, error: ... }
 */
export function withApiHandler(handler: ApiRouteHandler, options?: ApiHandlerOptions) {
  return async (request: Request, context?: any): Promise<Response> => {
    const startTime = performance.now();
    const method = request.method;
    const url = new URL(request.url).pathname;
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    let userId: string | null = null;
    let role: string | null = null;

    try {
      const sessionContext = await getCurrentSession().catch(() => null);
      if (sessionContext?.user) {
        userId = sessionContext.user.id || null;
        role = sessionContext.user.role || null;
      }
    } catch {
      // Ignore auth extraction errors for public endpoints
    }

    // Role-based pre-check if options specified
    if (options?.requireAuth && !userId) {
      const durationMs = Math.round(performance.now() - startTime);
      logger.logRequest({
        method,
        url,
        statusCode: 401,
        durationMs,
        userId,
        role,
        clientIp,
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid authentication session required.' },
        { status: 401 }
      );
    }

    if (options?.allowedRoles && role && !options.allowedRoles.includes(role)) {
      const durationMs = Math.round(performance.now() - startTime);
      logger.logRequest({
        method,
        url,
        statusCode: 403,
        durationMs,
        userId,
        role,
        clientIp,
      });
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient privileges for this operation.' },
        { status: 403 }
      );
    }

    try {
      const response = await handler(request, context);
      const durationMs = Math.round(performance.now() - startTime);
      const status = response.status || 200;

      // If handler responded with a client/server error code, inspect and log
      if (status >= 400) {
        let errorMsg = `HTTP Error ${status}`;
        try {
          const cloned = response.clone();
          const json = await cloned.json();
          if (json?.error) errorMsg = json.error;
        } catch {
          // Response was not JSON
        }
        logger.logRequest({
          method,
          url,
          statusCode: status,
          durationMs,
          userId,
          role,
          clientIp,
          error: new Error(errorMsg),
        });
      } else {
        logger.logRequest({
          method,
          url,
          statusCode: status,
          durationMs,
          userId,
          role,
          clientIp,
        });
      }

      return response;
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);

      let statusCode = 500;
      let sanitizedMessage = 'An unexpected internal server error occurred. Please contact the administrator.';

      if (err instanceof ZodError) {
        statusCode = 400;
        sanitizedMessage = `Validation error: ${err.errors.map((e) => e.message).join(', ')}`;
      } else if (err?.name === 'SyntaxError') {
        statusCode = 400;
        sanitizedMessage = 'Malformed JSON payload received in request.';
      } else if (typeof err?.message === 'string') {
        const msg = err.message.toLowerCase();
        if (msg.includes('unauthorized') || msg.includes('session required') || msg.includes('invalid credentials')) {
          statusCode = 401;
          sanitizedMessage = err.message;
        } else if (msg.includes('forbidden') || msg.includes('access denied') || msg.includes('insufficient privileges')) {
          statusCode = 403;
          sanitizedMessage = err.message;
        } else if (msg.includes('not found')) {
          statusCode = 404;
          sanitizedMessage = err.message;
        } else if (msg.includes('already exists') || msg.includes('unique constraint') || msg.includes('duplicate')) {
          statusCode = 409;
          sanitizedMessage = 'A resource with these unique specifications already exists.';
        } else if (statusCode === 500) {
          // Ensure database internal errors are sanitized
          sanitizedMessage = 'Internal server exception. The error has been logged for review.';
        }
      }

      // Record full error trace to logs/error-YYYY-MM-DD.log
      logger.logError({
        method,
        url,
        statusCode,
        durationMs,
        userId,
        role,
        clientIp,
        error: err,
        meta: { sanitizedMessage },
      });

      return NextResponse.json(
        {
          success: false,
          error: sanitizedMessage,
        },
        { status: statusCode }
      );
    }
  };
}

export function apiSuccess<T = any>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}
