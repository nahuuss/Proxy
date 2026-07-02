export const RATE_LIMIT_WINDOW_MS = 60_000;

export class RateLimiter {
  private readonly store = new Map<string, number[]>();
  private readonly getNow: () => number;

  constructor(
    private readonly maxRequests: number,
    input?: {
      getNow?: () => number;
      cleanupIntervalMs?: number;
    },
  ) {
    this.getNow = input?.getNow ?? (() => Date.now());

    const cleanupIntervalMs = input?.cleanupIntervalMs ?? 300_000;
    setInterval(() => this.cleanup(), cleanupIntervalMs).unref();
  }

  check(ip: string): boolean {
    const now = this.getNow();
    const cut = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = (this.store.get(ip) || []).filter((timestamp) => timestamp > cut);

    if (timestamps.length >= this.maxRequests) {
      this.store.set(ip, timestamps);
      return false;
    }

    this.store.set(ip, [...timestamps, now]);
    return true;
  }

  private cleanup() {
    const cut = this.getNow() - RATE_LIMIT_WINDOW_MS;

    for (const [ip, timestamps] of this.store) {
      if (timestamps.every((timestamp) => timestamp <= cut)) {
        this.store.delete(ip);
      }
    }
  }
}

export function resolveRequestClientIp(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string | null,
): string {
  const cloudflareIp = headers["cf-connecting-ip"];
  if (typeof cloudflareIp === "string" && cloudflareIp.trim()) {
    return cloudflareIp.trim();
  }

  const forwardedFor = headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return remoteAddress || "unknown";
}
