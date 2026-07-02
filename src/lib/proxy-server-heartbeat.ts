import type http from 'http';

import type { Connector } from './connectors';
import { clearProxyHeartbeatTimers, releaseProxyHeartbeat, type ProxyHeartbeatState } from './proxy-heartbeat';
import { createProxyHeartbeatShieldController } from './proxy-heartbeat-shield';
import type { ProxyServerRequestContext } from './proxy-server-request-context';

export function createProxyServerHeartbeatController(input: {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  requestContext: ProxyServerRequestContext;
  heartbeatState: ProxyHeartbeatState;
  startTime: number;
  hbFirstPulseMs: number;
  emitStatus: (event: Record<string, unknown>) => void;
  logHB: (message: string) => void;
  logDebugEntry: (
    tag: string,
    extra?: string,
    status?: number | string,
    elapsedMs?: number,
  ) => void;
}): {
  emitHeartbeatEnd: (status?: number, failed?: boolean) => void;
  startHeartbeatShield: () => void;
} {
  const heartbeatShield = createProxyHeartbeatShieldController({
    hbEligible: input.requestContext.hbEligible,
    hbFirstPulseMs: input.hbFirstPulseMs,
    executionMode: input.requestContext.executionMode,
    isPostLike: input.requestContext.isPostLike,
    state: input.heartbeatState,
    req: input.req,
    res: input.res,
    connectorId: input.connector.id,
    incomingHost: input.requestContext.incomingHost,
    path: input.requestContext.path,
    startTime: input.startTime,
    heartbeatCounter: global.proxyManager,
    emitStatus: (event) => {
      input.emitStatus({
        clientId: input.requestContext.bizguardClientId,
        requestId: input.requestContext.bizguardRequestId,
        ...event,
      });
    },
    logHB: input.logHB,
    logDebugEntry: input.logDebugEntry,
  });

  return {
    emitHeartbeatEnd: heartbeatShield.emitHeartbeatEnd,
    startHeartbeatShield: () => {
      heartbeatShield.start();
    },
  };
}

export function bindProxyServerHeartbeatLifecycle(input: {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  requestContext: Pick<ProxyServerRequestContext, 'hbEligible' | 'path'>;
  heartbeatState: ProxyHeartbeatState;
  startTime: number;
  logHB: (message: string) => void;
  startHeartbeatShield: () => void;
  emitHeartbeatEnd: (status?: number, failed?: boolean) => void;
}): void {
  input.res.once('close', () => {
    clearProxyHeartbeatTimers(input.heartbeatState);
    releaseProxyHeartbeat(input.heartbeatState, global.proxyManager);
    input.emitHeartbeatEnd(undefined, input.res.destroyed && !input.res.writableEnded);
  });

  if (!input.requestContext.hbEligible) return;

  if (input.req.complete) {
    input.startHeartbeatShield();
  } else {
    input.req.on('end', () => {
      input.logHB(
        `[UPLOAD-DONE] Subida completada para ${input.requestContext.path}. Iniciando cuenta regresiva de 45s para HB.`,
      );
      input.startHeartbeatShield();
    });
  }

  input.res.on('close', () => {
    clearProxyHeartbeatTimers(input.heartbeatState);
    input.emitHeartbeatEnd(undefined, input.res.destroyed && !input.res.writableEnded);
  });
}
