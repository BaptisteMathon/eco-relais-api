/**
 * Simple request/application logger (morgan handles HTTP; this is for app logs)
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
  },
  error(message: string, err?: Error | unknown, meta?: Record<string, unknown>): void {
    const payload: Record<string, unknown> = {
      level: 'error',
      message,
      ...meta,
      timestamp: new Date().toISOString(),
    };
    if (err instanceof Error) {
      payload.stack = err.stack;
      payload.errorName = err.name;
    }
    console.error(JSON.stringify(payload));
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
  },
  debug(message: string, meta?: Record<string, unknown>): void {
    if (isDev) {
      console.debug(JSON.stringify({ level: 'debug', message, ...meta, timestamp: new Date().toISOString() }));
    }
  },
};
