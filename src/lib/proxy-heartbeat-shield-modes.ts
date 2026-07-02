import type http from "http";
import { renderPassiveHeartbeatShell } from "./proxy-heartbeat-view";
import { renderBgJobPage } from "./proxy-bg-job-page";

const HB_INTERVAL_MS = 15000;

function emitInterimProcessingPulse(res: http.ServerResponse): boolean {
  if (res.headersSent || res.writableEnded || res.destroyed) return false;
  const writer = (res as any).writeProcessing;
  if (typeof writer !== "function") return false;
  writer.call(res);
  return true;
}

export function startPassiveHtmlHeartbeatShield(input: {
  res: http.ServerResponse;
  path: string;
  connectorId: string;
  startTime: number;
  now: () => number;
  logHB: (message: string) => void;
  setHtmlCommentOpen: () => void;
  setIntervalFn: typeof setInterval;
  registerInterval: (timer: NodeJS.Timeout) => void;
}) {
  input.logHB(
    `[HB-SHIELD] Pasivo (Spaces/HTML) ${input.path} | Iniciado tras ${Math.round((input.now() - input.startTime) / 1000)}s (${input.connectorId})`,
  );
  input.setHtmlCommentOpen();
  input.res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Transfer-Encoding": "chunked",
  });
  input.res.write(
    renderPassiveHeartbeatShell({
      elapsedSeconds: Math.round((input.now() - input.startTime) / 1000),
    }),
  );
  const interval = input.setIntervalFn(() => {
    if (!input.res.writableEnded && !input.res.destroyed) {
      input.res.write(" ");
      const elapsed = Math.round((input.now() - input.startTime) / 1000);
      input.logHB(`[HB-SHIELD] ${elapsed}s activa - ${input.path} (${input.connectorId})`);
    } else {
      clearInterval(interval);
    }
  }, HB_INTERVAL_MS);
  input.registerInterval(interval);
}

export function startXhrKeepAliveHeartbeatShield(input: {
  res: http.ServerResponse;
  path: string;
  connectorId: string;
  startTime: number;
  now: () => number;
  logHB: (message: string) => void;
  logDebugEntry: (tag: string, extra?: string, status?: number | string, elapsedMs?: number) => void;
  setIntervalFn: typeof setInterval;
  registerInterval: (timer: NodeJS.Timeout) => void;
}) {
  const sentInterimPulse = emitInterimProcessingPulse(input.res);
  input.logHB(
    `[HB-SHIELD] Pasivo (${sentInterimPulse ? "HTTP-102/TCP-KA" : "TCP-KA"}) ${input.path} | Iniciado tras ${Math.round((input.now() - input.startTime) / 1000)}s (${input.connectorId})`,
  );
  input.logDebugEntry(
    "[HB-XHR-KA]",
    `XHR mode | interim102=${sentInterimPulse}`,
    undefined,
    input.now() - input.startTime,
  );
  try {
    input.res.socket?.setKeepAlive(true, HB_INTERVAL_MS);
  } catch {}

  const interval = input.setIntervalFn(() => {
    if (!input.res.writableEnded && !input.res.destroyed) {
      const pulseMode = emitInterimProcessingPulse(input.res) ? "102" : "tcp-ka";
      const elapsed = Math.round((input.now() - input.startTime) / 1000);
      input.logHB(
        `[HB-SHIELD] ${elapsed}s activa - ${input.path} (${input.connectorId}) [${pulseMode}]`,
      );
    } else {
      clearInterval(interval);
    }
  }, HB_INTERVAL_MS);
  input.registerInterval(interval);
}

export function startBackgroundJobHeartbeatShield(input: {
  res: http.ServerResponse;
  req: http.IncomingMessage;
  path: string;
  connectorId: string;
  incomingHost: string;
  jobId: string | null;
  startTime: number;
  now: () => number;
  logHB: (message: string) => void;
}) {
  input.logHB(
    `[HB-SHIELD] Activo (Polling/Job) ${input.path} tras ${Math.round((input.now() - input.startTime) / 1000)}s (${input.connectorId})`,
  );
  input.res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  input.res.end(
    renderBgJobPage(input.jobId || "error", input.req.headers.referer || "", input.incomingHost),
  );
}
