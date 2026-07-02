import {
  appendRecentProxyLog,
  type ProxyLogEntry,
} from "./proxy-observability";

export interface ProxyManagerLogState {
  recentLogs: ProxyLogEntry[];
  logsPending: boolean;
}

export interface ApplyProxyManagerLogInput extends ProxyManagerLogState {
  message: string;
  type?: ProxyLogEntry["type"];
  now?: Date;
}

export interface ApplyProxyManagerLogResult {
  entry: ProxyLogEntry;
  nextState: ProxyManagerLogState;
  consoleMessage: string;
}

export function buildProxyLogEntry(input: {
  message: string;
  type?: ProxyLogEntry["type"];
  now?: Date;
}): ProxyLogEntry {
  return {
    timestamp: (input.now || new Date()).toLocaleTimeString(),
    message: input.message,
    type: input.type || "info",
  };
}

export function applyProxyManagerLog(
  input: ApplyProxyManagerLogInput,
): ApplyProxyManagerLogResult {
  const entry = buildProxyLogEntry({
    message: input.message,
    type: input.type,
    now: input.now,
  });

  return {
    entry,
    nextState: {
      recentLogs: appendRecentProxyLog(input.recentLogs, entry),
      logsPending: true,
    },
    consoleMessage: `[${entry.timestamp}] ${entry.message}`,
  };
}
