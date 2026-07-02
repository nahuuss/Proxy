import type http from "http";
import type { ProductExecutionMode } from "./product-catalog";
import {
  createHeartbeatBackgroundJob,
  type ProxyHeartbeatState,
} from "./proxy-heartbeat";
import {
  activateProxyHeartbeatShieldByMode,
} from "./proxy-heartbeat-shield-activation";
import { emitProxyHeartbeatEnd } from "./proxy-heartbeat-shield-events";

export interface CreateProxyHeartbeatShieldControllerInput {
  hbEligible: boolean;
  hbFirstPulseMs: number;
  executionMode: ProductExecutionMode;
  isPostLike: boolean;
  state: ProxyHeartbeatState;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  connectorId: string;
  incomingHost: string;
  path: string;
  startTime: number;
  heartbeatCounter?: { heartbeatCount: number };
  emitStatus: (event: Record<string, unknown>) => void;
  logHB: (message: string) => void;
  logDebugEntry: (
    tag: string,
    extra?: string,
    status?: number | string,
    elapsedMs?: number,
  ) => void;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  setIntervalFn?: typeof setInterval;
}

export interface ProxyHeartbeatShieldController {
  emitHeartbeatEnd: (status?: number, failed?: boolean) => void;
  start: () => void;
}

export function createProxyHeartbeatShieldController(
  input: CreateProxyHeartbeatShieldControllerInput,
): ProxyHeartbeatShieldController {
  const now = input.now || Date.now;
  const scheduleTimeout = input.setTimeoutFn || setTimeout;
  const scheduleInterval = input.setIntervalFn || setInterval;

  function emitHeartbeatEnd(status?: number, failed = false) {
    emitProxyHeartbeatEnd({
      state: input.state,
      emitStatus: input.emitStatus,
      req: input.req,
      path: input.path,
      startTime: input.startTime,
      now,
      status,
      failed,
    });
  }

  function start() {
    if (!input.hbEligible || input.state.isHeartbeatActive || input.res.headersSent) return;

    createHeartbeatBackgroundJob(input.state, {
      startTime: input.startTime,
      connectorId: input.connectorId,
      method: input.req.method || "POST",
      path: input.req.url || "/",
    });

    input.state.hbTimer = scheduleTimeout(() => {
      if (!input.req.complete && input.isPostLike) {
        const elapsed = Math.round((now() - input.startTime) / 1000);
        input.logHB(
          `[HB-WAIT] Request incompleto (upload activo - ${elapsed}s) - postergando HB para ${input.path}`,
        );
        input.state.hbTimer = scheduleTimeout(() => start(), 5000);
        return;
      }

      if (input.res.headersSent || input.res.destroyed) return;

      activateProxyHeartbeatShieldByMode({
        state: input.state,
        heartbeatCounter: input.heartbeatCounter,
        executionMode: input.executionMode,
        req: input.req,
        res: input.res,
        connectorId: input.connectorId,
        incomingHost: input.incomingHost,
        path: input.path,
        startTime: input.startTime,
        emitStatus: input.emitStatus,
        logHB: input.logHB,
        logDebugEntry: input.logDebugEntry,
        now,
        setIntervalFn: scheduleInterval,
      });
    }, input.hbFirstPulseMs);
  }

  return {
    emitHeartbeatEnd,
    start,
  };
}
