function hasFileSegment(pathname: string): boolean {
  const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
  return lastSegment.includes('.');
}

export function normalizeDynamicsCrmEntryPath(entryPath?: string): string {
  if (!entryPath) return '/';
  const trimmed = entryPath.trim();
  if (!trimmed) return '/';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

export function resolveDynamicsCrmMainPath(entryPath?: string): string {
  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  if (hasFileSegment(normalizedEntryPath)) return normalizedEntryPath;
  return normalizedEntryPath === '/' ? '/main.aspx' : `${normalizedEntryPath}/main.aspx`;
}

export function buildDynamicsCrmEntryUrl(targetUrl: string, entryPath?: string): string {
  const baseUrl = targetUrl.replace(/\/$/, '');
  return `${baseUrl}${resolveDynamicsCrmMainPath(entryPath)}`;
}

export function normalizeDynamicsCrmProxyPath(requestUrl: string, entryPath?: string): string {
  const url = new URL(requestUrl || '/', 'http://bizguard.local');
  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  const normalizedEntryPathWithSlash = normalizedEntryPath === '/' ? '/' : `${normalizedEntryPath}/`;

  if (url.pathname === normalizedEntryPath || url.pathname === normalizedEntryPathWithSlash) {
    url.pathname = resolveDynamicsCrmMainPath(entryPath);
  }

  return `${url.pathname}${url.search}`;
}
