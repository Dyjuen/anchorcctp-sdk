export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogSink = (formatted: string) => void;

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

const SECRET_KEY_PATTERN = /secret|key|private|mnemonic|seed/i;

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        sanitizedObj[k] = '[REDACTED]';
      } else {
        sanitizedObj[k] = sanitizeValue(v);
      }
    }
    return sanitizedObj;
  }
  return value;
}

function defaultSink(message: string): void {
  process.stderr.write(message + '\n');
}

/**
 * Creates a structured JSON logger that writes to a sink (default: process.stderr).
 * Automatically redacts sensitive fields matching secret/key/private/mnemonic/seed.
 */
export function createLogger(namespace: string, sink: LogSink = defaultSink): Logger {
  const log = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      ns: namespace,
      msg,
    };

    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (SECRET_KEY_PATTERN.test(k)) {
          payload[k] = '[REDACTED]';
        } else {
          payload[k] = sanitizeValue(v);
        }
      }
    }

    sink(JSON.stringify(payload));
  };

  return {
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
  };
}
