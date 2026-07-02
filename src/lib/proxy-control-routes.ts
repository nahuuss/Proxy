import { EventEmitter } from "events";
import http from "http";
import { deleteBgJob, getBgJob } from "./background-job-store";

const STATUS_STREAM_PATH = "/__bizguard_status/stream";
const JOB_ROUTE_PREFIX = "/__bizguard_job/";
const SAFE_JOB_HEADER_NAMES = [
  "content-type",
  "content-disposition",
  "cache-control",
  "location",
  "set-cookie",
] as const;

export interface HandleProxyControlRouteInput {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  statusEvents: EventEmitter;
}

function writeJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function resolveStreamClientId(requestUrl: string): string {
  try {
    const statusUrl = new URL(requestUrl || "/", "http://bizguard.local");
    return (statusUrl.searchParams.get("clientId") || "").slice(0, 80);
  } catch {
    return "";
  }
}

function handleStatusStream(input: HandleProxyControlRouteInput): boolean {
  const streamClientId = resolveStreamClientId(input.req.url || "/");

  input.res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  input.res.write(": open\n\n");

  const onStatus = (event: Record<string, unknown>) => {
    if (streamClientId && event.clientId && event.clientId !== streamClientId) {
      return;
    }
    if (!input.res.destroyed) {
      input.res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  const heartbeat = setInterval(() => {
    if (!input.res.destroyed) {
      input.res.write(": heartbeat\n\n");
    }
  }, 15000);

  input.statusEvents.on("status", onStatus);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    input.statusEvents.off("status", onStatus);
  };

  input.req.on("close", cleanup);
  input.req.on("aborted", cleanup);
  input.res.on("close", cleanup);
  input.res.on("finish", cleanup);
  return true;
}

function copySafeJobHeaders(headers?: Record<string, string | string[] | undefined>) {
  const safeHeaders: Record<string, string | string[]> = {};
  for (const headerName of SAFE_JOB_HEADER_NAMES) {
    const value = headers?.[headerName];
    if (value) {
      safeHeaders[headerName] = value;
    }
  }
  return safeHeaders;
}

function handleJobRoute(input: HandleProxyControlRouteInput, rawUrlPath: string): boolean {
  const parts = rawUrlPath.replace(JOB_ROUTE_PREFIX, "").split("/");
  const jobId = parts[0];
  const action = parts[1] || "status";
  const job = getBgJob(jobId);

  if (!job) {
    writeJson(input.res, 404, { error: "Job no encontrado o expirado" });
    return true;
  }

  if (action === "status") {
    const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
    writeJson(input.res, 200, {
      status: job.status,
      elapsed,
      error: job.error || null,
    });
    return true;
  }

  if (action === "result") {
    if (job.status !== "done" || !job.responseBody) {
      writeJson(input.res, 202, { status: job.status });
      return true;
    }

    const safeHeaders = copySafeJobHeaders(job.responseHeaders);
    safeHeaders["content-length"] = String(job.responseBody.length);
    input.res.writeHead(job.statusCode || 200, safeHeaders);
    input.res.end(job.responseBody);
    deleteBgJob(jobId);
    return true;
  }

  input.res.writeHead(404);
  input.res.end();
  return true;
}

export function handleProxyControlRoute(input: HandleProxyControlRouteInput): boolean {
  const rawUrlPath = (input.req.url || "").split("?")[0].toLowerCase();

  if (rawUrlPath === STATUS_STREAM_PATH) {
    return handleStatusStream(input);
  }

  if (rawUrlPath.startsWith(JOB_ROUTE_PREFIX)) {
    return handleJobRoute(input, rawUrlPath);
  }

  return false;
}
