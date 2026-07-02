import type { ConnectorPingResult, HttpProbeResult } from './proxy-monitoring';
import { probeHttpUrl } from './proxy-monitoring-http';

export function buildConnectorPingCandidates(targetUrl: string): string[] {
  if (targetUrl.startsWith('http')) {
    return [targetUrl];
  }

  return [`https://${targetUrl}`, `http://${targetUrl}`];
}

export async function probeConnectorTarget(
  targetUrl: string,
  probe: (url: string) => Promise<HttpProbeResult> = probeHttpUrl,
): Promise<ConnectorPingResult> {
  const startedAt = Date.now();
  const candidates = buildConnectorPingCandidates(targetUrl);
  const details: string[] = [];

  for (const candidate of candidates) {
    const result = await probe(candidate);
    const prefix = targetUrl.startsWith('http')
      ? ''
      : `${candidate.startsWith('https://') ? 'https' : 'http'}:`;
    details.push(`${prefix}${result.detail}`);
    if (result.online) {
      return {
        online: true,
        detail: details.join(' | '),
        latency: Date.now() - startedAt,
      };
    }
  }

  return {
    online: false,
    detail: details.join(' | '),
    latency: Date.now() - startedAt,
  };
}
