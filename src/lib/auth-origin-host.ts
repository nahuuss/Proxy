export function normalizeHost(host?: string | null): string {
  return (host || '').trim().toLowerCase();
}

export function normalizeProto(proto?: string | null): string {
  const cleaned = (proto || '').trim().toLowerCase();
  if (!cleaned) return '';
  return cleaned.replace(/:$/, '');
}

export function getHostname(host: string): string {
  return host.split(':')[0] || '';
}

export function getPort(host: string): number | undefined {
  const portCandidate = host.split(':')[1];
  if (!portCandidate) return undefined;
  const parsed = parseInt(portCandidate, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

export function isLocalHost(host: string): boolean {
  return isLocalHostname(getHostname(normalizeHost(host)));
}

export function inferProtocol(host: string, forwardedProto: string): string {
  if (forwardedProto) return forwardedProto;
  return isLocalHost(host) ? 'http' : 'https';
}
