import http from 'http';
import https from 'https';

import type { HttpProbeResult } from './proxy-monitoring';

export function probeHttpUrl(url: string): Promise<HttpProbeResult> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const options: http.RequestOptions & { rejectUnauthorized: boolean; timeout: number } = {
        method: 'HEAD',
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        timeout: 5000,
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'BizGuard-Monitor/1.2',
          Connection: 'close',
        },
      };

      const req = client.request(options, (res) => {
        const isOnline = (res.statusCode || 0) > 0;
        res.resume();
        resolve({ online: isOnline, detail: `status=${res.statusCode}` });
      });

      req.on('error', (err: Error & { code?: string }) => {
        resolve({ online: false, detail: `error=${err.code || err.message}` });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ online: false, detail: 'timeout' });
      });
      req.end();
    } catch (error: unknown) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      resolve({ online: false, detail: `exception=${normalizedError.message}` });
    }
  });
}
