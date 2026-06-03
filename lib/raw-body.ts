import type { IncomingMessage } from 'http';

/**
 * Read the raw body from an incoming HTTP request.
 * Used when Next.js body parsing is disabled (for webhook signature verification).
 */
export function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}
