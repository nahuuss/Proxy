export function normalizeDynamicsCrmEntryPath(entryPath?: string) {
  if (!entryPath) return "/";
  const trimmed = entryPath.trim();
  if (!trimmed) return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

function hasFileSegment(pathname: string) {
  const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
  return lastSegment.includes(".");
}

export function resolveDynamicsCrmMainPath(entryPath?: string) {
  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  if (hasFileSegment(normalizedEntryPath)) return normalizedEntryPath;
  return normalizedEntryPath === "/" ? "/main.aspx" : `${normalizedEntryPath}/main.aspx`;
}

export function buildDynamicsCrmEntryUrl(targetUrl: string, entryPath?: string) {
  const baseUrl = targetUrl.replace(/\/$/, "");
  return `${baseUrl}${resolveDynamicsCrmMainPath(entryPath)}`;
}

export function normalizeDynamicsCrmProxyPath(requestUrl: string, entryPath?: string) {
  const url = new URL(requestUrl || "/", "http://bizguard.local");
  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  const normalizedEntryPathWithSlash = normalizedEntryPath === "/" ? "/" : `${normalizedEntryPath}/`;

  if (url.pathname === normalizedEntryPath || url.pathname === normalizedEntryPathWithSlash) {
    url.pathname = resolveDynamicsCrmMainPath(entryPath);
  }

  return `${url.pathname}${url.search}`;
}

function getPublicPort(incomingHost: string, proto: string) {
  const explicitPort = incomingHost.split(":")[1];
  if (explicitPort) return explicitPort;
  return proto === "https" ? "443" : "80";
}

function encodeCrmJsUrl(url: string) {
  return url
    .replace(/:/g, "\\x3a")
    .replace(/\//g, "\\x2f");
}

export function rewriteDynamicsCrmClientConfig(body: string, incomingHost: string, proto: string, entryPath?: string) {
  if (!body) return body;

  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  const pathSuffix = normalizedEntryPath === "/" ? "" : normalizedEntryPath;
  const publicServerUrl = `${proto}://${incomingHost}${pathSuffix}`;
  const publicServerUrlJs = encodeCrmJsUrl(publicServerUrl);
  const hostOnly = incomingHost.split(":")[0];
  const publicPort = getPublicPort(incomingHost, proto);

  let rewritten = body;
  rewritten = rewritten.replace(/var\s+SERVER_URL\s*=\s*'[^']*';/gi, `var SERVER_URL = '${publicServerUrlJs}';`);
  rewritten = rewritten.replace(/var\s+WEB_SERVER_HOST\s*=\s*'[^']*';/gi, `var WEB_SERVER_HOST = '${hostOnly}';`);
  rewritten = rewritten.replace(/var\s+WEB_SERVER_PORT\s*=\s*[^;]+;/gi, `var WEB_SERVER_PORT = ${publicPort};`);

  return rewritten;
}
