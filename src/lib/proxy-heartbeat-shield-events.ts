import type http from 'http';

export function emitProxyHeartbeatEnd(input: {
  state: {
    isHeartbeatActive: boolean;
    heartbeatEndEmitted: boolean;
  };
  emitStatus: (event: Record<string, unknown>) => void;
  req: http.IncomingMessage;
  path: string;
  startTime: number;
  now: () => number;
  status?: number;
  failed?: boolean;
}): void {
  if (!input.state.isHeartbeatActive || input.state.heartbeatEndEmitted) return;
  input.state.heartbeatEndEmitted = true;
  input.emitStatus({
    type: 'heartbeat-end',
    method: input.req.method || 'GET',
    path: input.path,
    elapsedMs: input.now() - input.startTime,
    status: input.status,
    failed: input.failed === true,
  });
}

export function emitProxyHeartbeatStart(input: {
  emitStatus: (event: Record<string, unknown>) => void;
  req: http.IncomingMessage;
  path: string;
  startTime: number;
  now: () => number;
}): void {
  input.emitStatus({
    type: 'heartbeat-start',
    method: input.req.method || 'GET',
    path: input.path,
    elapsedMs: input.now() - input.startTime,
  });
}
