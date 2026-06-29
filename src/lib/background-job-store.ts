export interface BgJob {
  status: "pending" | "done" | "error";
  startedAt: number;
  connectorId: string;
  method: string;
  path: string;
  statusCode?: number;
  responseHeaders?: Record<string, string | string[] | undefined>;
  responseBody?: Buffer;
  error?: string;
}

const bgJobs = new Map<string, BgJob>();

export function getBgJob(jobId: string) {
  return bgJobs.get(jobId);
}

export function setBgJob(jobId: string, job: BgJob) {
  bgJobs.set(jobId, job);
}

export function updateBgJob(jobId: string, updater: (job: BgJob) => BgJob) {
  const current = bgJobs.get(jobId);
  if (!current) return;
  bgJobs.set(jobId, updater(current));
}

export function deleteBgJob(jobId: string) {
  bgJobs.delete(jobId);
}

export function cleanupExpiredBgJobs(maxAgeMs: number) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [id, job] of bgJobs) {
    if (job.startedAt < cutoff) bgJobs.delete(id);
  }
}

export function startBgJobCleanup(maxAgeMs: number, intervalMs: number) {
  setInterval(() => cleanupExpiredBgJobs(maxAgeMs), intervalMs).unref();
}

