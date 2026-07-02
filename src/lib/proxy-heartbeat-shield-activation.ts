import type http from 'http';

import { activateProxyHeartbeat, type ProxyHeartbeatState } from './proxy-heartbeat';
import type { ProductExecutionMode } from './product-catalog';
import {
  startBackgroundJobHeartbeatShield,
  startPassiveHtmlHeartbeatShield,
  startXhrKeepAliveHeartbeatShield,
} from './proxy-heartbeat-shield-modes';
import { emitProxyHeartbeatStart } from './proxy-heartbeat-shield-events';

export function activateProxyHeartbeatShieldByMode(input: {
  state: ProxyHeartbeatState;
  heartbeatCounter?: { heartbeatCount: number };
  executionMode: ProductExecutionMode;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  connectorId: string;
  incomingHost: string;
  path: string;
  startTime: number;
  emitStatus: (event: Record<string, unknown>) => void;
  logHB: (message: string) => void;
  logDebugEntry: (
    tag: string,
    extra?: string,
    status?: number | string,
    elapsedMs?: number,
  ) => void;
  now: () => number;
  setIntervalFn: typeof setInterval;
}): void {
  activateProxyHeartbeat(input.state, input.heartbeatCounter);
  emitProxyHeartbeatStart({
    emitStatus: input.emitStatus,
    req: input.req,
    path: input.path,
    startTime: input.startTime,
    now: input.now,
  });

  if (input.executionMode === 'passive-html') {
    startPassiveHtmlHeartbeatShield({
      res: input.res,
      path: input.path,
      connectorId: input.connectorId,
      startTime: input.startTime,
      now: input.now,
      logHB: input.logHB,
      setHtmlCommentOpen: () => {
        input.state.isHtmlCommentOpen = true;
      },
      setIntervalFn: input.setIntervalFn,
      registerInterval: (timer) => {
        input.state.hbInterval = timer;
      },
    });
    return;
  }

  if (input.executionMode === 'xhr-keepalive') {
    startXhrKeepAliveHeartbeatShield({
      res: input.res,
      path: input.path,
      connectorId: input.connectorId,
      startTime: input.startTime,
      now: input.now,
      logHB: input.logHB,
      logDebugEntry: input.logDebugEntry,
      setIntervalFn: input.setIntervalFn,
      registerInterval: (timer) => {
        input.state.hbInterval = timer;
      },
    });
    return;
  }

  if (input.executionMode === 'background-job') {
    startBackgroundJobHeartbeatShield({
      res: input.res,
      req: input.req,
      path: input.path,
      connectorId: input.connectorId,
      incomingHost: input.incomingHost,
      jobId: input.state.jobId,
      startTime: input.startTime,
      now: input.now,
      logHB: input.logHB,
    });
    return;
  }

  input.logHB(
    `[HB-SHIELD] Modo sin proteccion activa ${input.executionMode} para ${input.path} (${input.connectorId})`,
  );
}
