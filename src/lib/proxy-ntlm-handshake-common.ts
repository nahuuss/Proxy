import http from 'http';
import httpntlm from 'httpntlm';

import { resolveNtlmMethod, type NtlmMethodRegistry } from './proxy-ntlm';

export function collectNtlmRequestBody(
  req: http.IncomingMessage,
  onComplete: (body: Buffer) => void,
): void {
  const bodyChunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
  req.on('end', () => {
    onComplete(Buffer.concat(bodyChunks));
  });
}

export function resolveRequestNtlmMethod(input: {
  registry?: NtlmMethodRegistry;
  resolveMethod?: typeof resolveNtlmMethod;
  method?: string | null;
}) {
  const ntlmRegistry = input.registry || (httpntlm as NtlmMethodRegistry);
  const methodResolver = input.resolveMethod || resolveNtlmMethod;
  return methodResolver(ntlmRegistry, (input.method || 'GET').toLowerCase());
}

export function startNtlmHeartbeatShieldIfNeeded(hbEligible: boolean, startHeartbeatShield: () => void): void {
  if (hbEligible) {
    startHeartbeatShield();
  }
}
