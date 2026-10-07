import fs from 'fs';
import path from 'path';

export interface LogContext {
  method?: string;
  url?: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string | null;
  role?: string | null;
  clientIp?: string | null;
  error?: Error | unknown;
  meta?: Record<string, any>;
}

class FileLogger {
  private logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to initialize logs directory:', err);
    }
  }

  private getDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private appendToFile(fileName: string, line: string): void {
    try {
      const filePath = path.join(this.logsDir, fileName);
      fs.appendFileSync(filePath, line + '\n', 'utf8');
    } catch (err) {
      // Fallback to console in case disk write fails
      console.error(`[Logger Error] Failed writing to ${fileName}:`, err);
    }
  }

  private formatUser(userId?: string | null, role?: string | null): string {
    if (!userId && !role) return 'Anonymous';
    return `${userId || 'unknown'} (${role || 'unassigned'})`;
  }

  /**
   * Log API requests (Success and Client/Server Responses)
   * Target: logs/api-YYYY-MM-DD.log
   */
  public logRequest(ctx: LogContext): void {
    const timestamp = new Date().toISOString();
    const dateStr = this.getDateString();
    const fileName = `api-${dateStr}.log`;

    const method = ctx.method?.toUpperCase() || 'UNKNOWN';
    const url = ctx.url || '/';
    const status = ctx.statusCode || 200;
    const duration = ctx.durationMs !== undefined ? `${ctx.durationMs}ms` : '-';
    const user = this.formatUser(ctx.userId, ctx.role);
    const ip = ctx.clientIp || '127.0.0.1';

    const logLine = `[${timestamp}] [${method}] ${url} ${status} (${duration}) | IP: ${ip} | User: ${user}`;
    this.appendToFile(fileName, logLine);

    // If status is an error (>= 400), also record it in the error log
    if (status >= 400) {
      this.logError({
        ...ctx,
        error: ctx.error || new Error(`HTTP Error ${status}`),
      });
    }
  }

  /**
   * Log Server Exceptions and Errors with full stack traces
   * Target: logs/error-YYYY-MM-DD.log
   */
  public logError(ctx: LogContext): void {
    const timestamp = new Date().toISOString();
    const dateStr = this.getDateString();
    const fileName = `error-${dateStr}.log`;

    const method = ctx.method?.toUpperCase() || 'UNKNOWN';
    const url = ctx.url || '/';
    const status = ctx.statusCode || 500;
    const duration = ctx.durationMs !== undefined ? `${ctx.durationMs}ms` : '-';
    const user = this.formatUser(ctx.userId, ctx.role);
    const ip = ctx.clientIp || '127.0.0.1';

    let errMessage = 'Unknown Error';
    let errStack = '';

    if (ctx.error instanceof Error) {
      errMessage = ctx.error.message;
      errStack = ctx.error.stack || '';
    } else if (typeof ctx.error === 'string') {
      errMessage = ctx.error;
    } else if (ctx.error && typeof ctx.error === 'object') {
      try {
        errMessage = JSON.stringify(ctx.error);
      } catch {
        errMessage = String(ctx.error);
      }
    }

    let logBlock = `[${timestamp}] ERROR [${method}] ${url} ${status} (${duration}) | IP: ${ip} | User: ${user} | Message: ${errMessage}`;
    if (errStack) {
      logBlock += `\nStack Trace:\n${errStack}`;
    }
    if (ctx.meta && Object.keys(ctx.meta).length > 0) {
      try {
        logBlock += `\nMetadata: ${JSON.stringify(ctx.meta)}`;
      } catch {}
    }

    this.appendToFile(fileName, logBlock);
  }

  public info(message: string, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const dateStr = this.getDateString();
    const line = `[${timestamp}] INFO ${message}${meta ? ` | ${JSON.stringify(meta)}` : ''}`;
    this.appendToFile(`api-${dateStr}.log`, line);
  }

  public warn(message: string, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const dateStr = this.getDateString();
    const line = `[${timestamp}] WARN ${message}${meta ? ` | ${JSON.stringify(meta)}` : ''}`;
    this.appendToFile(`api-${dateStr}.log`, line);
  }

  public error(message: string, error?: Error | unknown): void {
    this.logError({
      method: 'INTERNAL',
      url: '-',
      statusCode: 500,
      error: error || new Error(message),
      meta: { message },
    });
  }
}

export const logger = new FileLogger();
export default logger;
