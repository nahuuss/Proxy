import type { ProxyRuntimeLoopState } from './proxy-runtime-loop';
import type { ProxySyncPayload } from './proxy-observability';

export function applyProxyManagerRuntimeTickState(
  state: ProxyRuntimeLoopState & { recentLogs: unknown[]; logsPending: boolean },
  nextState: ProxyRuntimeLoopState & { logsPending: boolean },
): void {
  state.statsPending = nextState.statsPending;
  state.logsPending = nextState.logsPending;
  state.lastTotalBytes = nextState.lastTotalBytes;
  state.lastSyncTime = nextState.lastSyncTime;
  state.prevCpus = nextState.prevCpus;
  state.globalMetrics = nextState.globalMetrics;
}

export function scheduleProxyManagerSync(input: {
  shouldStartSync: boolean;
  syncPayload?: ProxySyncPayload;
  writeSyncPayload: (payload: ProxySyncPayload) => Promise<void>;
  setSyncInFlight: (value: boolean) => void;
}): void {
  if (!input.shouldStartSync || !input.syncPayload) return;

  input.setSyncInFlight(true);
  void input
    .writeSyncPayload(input.syncPayload)
    .catch(() => {})
    .finally(() => {
      input.setSyncInFlight(false);
    });
}
