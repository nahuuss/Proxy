import http from 'http';

import type { Connector } from './connectors';
import type { ProxyHeartbeatState } from './proxy-heartbeat';
import type { BuildProxyOutcomeTraffic } from './proxy-standard-observability';
import type { BuildStandardTrafficEntry } from './proxy-standard-stream';

export interface HandleStandardProxyResponseInput {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  proxyRes: http.IncomingMessage;
  heartbeatState: ProxyHeartbeatState;
  startTime: number;
  ttfbMs: number;
  path: string;
  incomingHost: string;
  targetUrl: URL;
  urlPart: string;
  proto: string;
  responseHeaders: Record<string, string | string[] | undefined>;
  requestBody: Buffer | null;
  clearHeartbeatTimers: () => void;
  onMetric: (bytes: number) => void;
  buildTrafficEntry: BuildStandardTrafficEntry & BuildProxyOutcomeTraffic;
  logHB: (message: string) => void;
  logDebugEntry: (tag: string, extra: string, status?: number | string, elapsedMs?: number) => void;
  getRedirectScript: (location: string, isHtmlCommentOpen: boolean) => string;
}
