const DEFAULT_RETENTION_MS = 5 * 60 * 60 * 1000;

export function sanitizeFolderName(raw: string): string {
  return raw
    .replace(/[@\\/:\s]+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 64)
    .toLowerCase() || "unknown";
}

export function buildTrafficDatePrefix(now = new Date()): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}`;
}

export function extractCookieNames(cookieHeader?: string | string[]): string[] {
  if (!cookieHeader) return [];
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  return raw
    .split(";")
    .map((part) => {
      const idx = part.indexOf("=");
      return idx > 0 ? part.slice(0, idx).trim() : null;
    })
    .filter(Boolean) as string[];
}

export function calculateTrafficRetentionMs(value?: number, unit?: string): number {
  if (value === undefined || value === null || !unit) {
    return DEFAULT_RETENTION_MS;
  }
  switch (unit) {
    case "seconds":
      return value * 1000;
    case "minutes":
      return value * 60 * 1000;
    case "hours":
      return value * 60 * 60 * 1000;
    case "days":
      return value * 24 * 60 * 60 * 1000;
    default:
      return DEFAULT_RETENTION_MS;
  }
}
