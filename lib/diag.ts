import type { NextApiRequest } from 'next';

export interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Create a tagged logger for consistent log output.
 */
export function createLogger(tag: string): Logger {
  const prefix = `[${tag}]`;
  return {
    log: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}

/**
 * Log useful request diagnostics for debugging webhooks.
 */
export function logRequestDiagnostics(
  req: NextApiRequest,
  options: { tag?: string } = {}
): void {
  const prefix = options.tag ? `[${options.tag}]` : '';
  const headers = {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
    'user-agent': req.headers['user-agent'],
    'x-forwarded-for': req.headers['x-forwarded-for'],
  };
  console.log(prefix, 'request diagnostics:', {
    method: req.method,
    url: req.url,
    headers,
  });
}
