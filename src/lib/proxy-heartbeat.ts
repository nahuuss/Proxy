import crypto from "crypto";
import { deleteBgJob, setBgJob, updateBgJob } from "./background-job-store";

export interface ProxyHeartbeatState {
  jobId: string | null;
  isHeartbeatActive: boolean;
  isHtmlCommentOpen: boolean;
  hbTimer: NodeJS.Timeout | null;
  hbInterval: NodeJS.Timeout | null;
  heartbeatEndEmitted: boolean;
}

export function createProxyHeartbeatState(): ProxyHeartbeatState {
  return {
    jobId: null,
    isHeartbeatActive: false,
    isHtmlCommentOpen: false,
    hbTimer: null,
    hbInterval: null,
    heartbeatEndEmitted: false,
  };
}

export function clearProxyHeartbeatTimers(state: ProxyHeartbeatState) {
  if (state.hbTimer) {
    clearTimeout(state.hbTimer);
    state.hbTimer = null;
  }
  if (state.hbInterval) {
    clearInterval(state.hbInterval);
    state.hbInterval = null;
  }
}

export function createHeartbeatBackgroundJob(state: ProxyHeartbeatState, input: {
  startTime: number;
  connectorId: string;
  method: string;
  path: string;
}): string {
  state.jobId = crypto.randomUUID();
  setBgJob(state.jobId, {
    status: "pending",
    startedAt: input.startTime,
    connectorId: input.connectorId,
    method: input.method,
    path: input.path,
  });
  return state.jobId;
}

export function activateProxyHeartbeat(state: ProxyHeartbeatState, heartbeatCounter?: { heartbeatCount: number }) {
  if (state.isHeartbeatActive) return;
  state.isHeartbeatActive = true;
  if (heartbeatCounter) {
    heartbeatCounter.heartbeatCount++;
  }
}

export function releaseProxyHeartbeat(state: ProxyHeartbeatState, heartbeatCounter?: { heartbeatCount: number }) {
  if (!state.isHeartbeatActive) return;
  state.isHeartbeatActive = false;
  if (heartbeatCounter) {
    heartbeatCounter.heartbeatCount = Math.max(0, heartbeatCounter.heartbeatCount - 1);
  }
}

export function completeHeartbeatJob(state: ProxyHeartbeatState, input: {
  statusCode?: number;
  responseHeaders: Record<string, string | string[] | undefined>;
  responseBody: Buffer;
}) {
  if (!state.jobId) return;
  if (state.isHeartbeatActive) {
    updateBgJob(state.jobId, (job) => ({
      ...job,
      status: "done",
      statusCode: input.statusCode,
      responseHeaders: input.responseHeaders,
      responseBody: input.responseBody,
    }));
    return;
  }

  deleteBgJob(state.jobId);
}

export function failHeartbeatJob(state: ProxyHeartbeatState, error: string) {
  if (!state.jobId) return;
  if (state.isHeartbeatActive) {
    updateBgJob(state.jobId, (job) => ({
      ...job,
      status: "error",
      error,
    }));
    return;
  }

  deleteBgJob(state.jobId);
}

export function discardHeartbeatJob(state: ProxyHeartbeatState) {
  if (!state.jobId) return;
  deleteBgJob(state.jobId);
}
