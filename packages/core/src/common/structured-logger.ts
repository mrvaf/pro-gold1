export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: Record<string, unknown> | undefined;
  readonly tenantId?: string | undefined;
  readonly traceId?: string | undefined;
}

export class StructuredLogger {
  constructor(private readonly defaultContext: Record<string, unknown> = {}) {}

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    meta?: { tenantId?: string; traceId?: string }
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
      tenantId: meta?.tenantId,
      traceId: meta?.traceId,
    };

    const serialized = JSON.stringify(entry);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }

    return entry;
  }

  info(message: string, context?: Record<string, unknown>, meta?: { tenantId?: string; traceId?: string }): StructuredLogEntry {
    return this.log('info', message, context, meta);
  }

  warn(message: string, context?: Record<string, unknown>, meta?: { tenantId?: string; traceId?: string }): StructuredLogEntry {
    return this.log('warn', message, context, meta);
  }

  error(message: string, context?: Record<string, unknown>, meta?: { tenantId?: string; traceId?: string }): StructuredLogEntry {
    return this.log('error', message, context, meta);
  }

  debug(message: string, context?: Record<string, unknown>, meta?: { tenantId?: string; traceId?: string }): StructuredLogEntry {
    return this.log('debug', message, context, meta);
  }
}

export const appLogger = new StructuredLogger({ service: 'v-gold-core' });
