import type http from 'http';
import { EventEmitter } from 'events';

import { getPreferredSessionUsername } from './auth-ntlm';
import type { Connector } from './connectors';
import { trafficLogger } from './logger-traffic';
import { buildProxyDebugEntry, buildProxyTrafficEntry } from './proxy-traffic';

export type ProxyRequestSessionCarrier = http.IncomingMessage & {
  session?: Record<string, unknown> | null;
};

export function createProxyServerStatusEvents(): EventEmitter {
  const statusEvents = new EventEmitter();
  statusEvents.setMaxListeners(200);
  return statusEvents;
}

export function createProxyStatusEmitter(statusEvents: EventEmitter, connectorId: string) {
  return (event: Record<string, unknown>): void => {
    statusEvents.emit('status', {
      connectorId,
      at: Date.now(),
      ...event,
    });
  };
}

export function createProxyDebugLogger(input: {
  connector: Connector;
  req: ProxyRequestSessionCarrier;
}) {
  return (tag: string, extra?: string, status?: number | string, elapsedMs?: number): void => {
    if (!input.connector.trafficLog) return;
    const username = getPreferredSessionUsername(input.req.session);
    trafficLogger.log(
      buildProxyDebugEntry({
        username,
        connectorId: input.connector.id,
        tag,
        method: input.req.method,
        requestUrl: input.req.url || '/',
        status,
        elapsedMs,
        extra,
      })
    );
  };
}

export function createProxyTrafficEntryBuilder(input: {
  connector: Connector;
  req: ProxyRequestSessionCarrier;
  startTime: number;
  isAjax: boolean;
}) {
  return (opts: {
    elapsed: number;
    ttfb?: number;
    status: number;
    reqSize: number;
    resSize: number;
    err?: string;
    resHeaders?: Record<string, string | string[] | undefined>;
  }) => {
    const username = getPreferredSessionUsername(input.req.session);
    return buildProxyTrafficEntry({
      startTime: input.startTime,
      connectorId: input.connector.id,
      username,
      method: input.req.method,
      requestUrl: input.req.url || '/',
      requestHeaders: input.req.headers as Record<string, string | string[] | undefined>,
      isAjax: input.isAjax,
      elapsed: opts.elapsed,
      ttfb: opts.ttfb,
      status: opts.status,
      reqSize: opts.reqSize,
      resSize: opts.resSize,
      err: opts.err,
      resHeaders: opts.resHeaders,
    });
  };
}
