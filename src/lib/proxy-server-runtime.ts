import { startBgJobCleanup } from './background-job-store';

const DEFAULT_MAX_REQUEST_BODY_MB = 500;
let runtimeInitialized = false;

export function getProxyServerMaxBodyBytes(): number {
  return parseInt(process.env.MAX_REQUEST_BODY_MB || String(DEFAULT_MAX_REQUEST_BODY_MB), 10) * 1024 * 1024;
}

export function ensureProxyServerRuntime(): void {
  if (runtimeInitialized) return;
  startBgJobCleanup(30 * 60 * 1000, 10 * 60 * 1000);
  runtimeInitialized = true;
}
