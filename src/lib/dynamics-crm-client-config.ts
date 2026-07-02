import { injectDynamicsCrmLookupShim } from './dynamics-crm-lookup-shim';
import { normalizeDynamicsCrmEntryPath } from './dynamics-crm-paths';

function getPublicPort(incomingHost: string, proto: string): string {
  const explicitPort = incomingHost.split(':')[1];
  if (explicitPort) return explicitPort;
  return proto === 'https' ? '443' : '80';
}

function encodeCrmJsUrl(url: string): string {
  return url.replace(/:/g, '\\x3a').replace(/\//g, '\\x2f');
}

export function rewriteDynamicsCrmClientConfig(
  body: string,
  incomingHost: string,
  proto: string,
  entryPath?: string,
): string {
  if (!body) return body;

  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  const pathSuffix = normalizedEntryPath === '/' ? '' : normalizedEntryPath;
  const publicServerUrl = `${proto}://${incomingHost}${pathSuffix}`;
  const publicServerUrlJs = encodeCrmJsUrl(publicServerUrl);
  const hostOnly = incomingHost.split(':')[0];
  const publicPort = getPublicPort(incomingHost, proto);

  let rewritten = body;
  rewritten = rewritten.replace(/var\s+SERVER_URL\s*=\s*'[^']*';/gi, `var SERVER_URL = '${publicServerUrlJs}';`);
  rewritten = rewritten.replace(/var\s+WEB_SERVER_HOST\s*=\s*'[^']*';/gi, `var WEB_SERVER_HOST = '${hostOnly}';`);
  rewritten = rewritten.replace(/var\s+WEB_SERVER_PORT\s*=\s*[^;]+;/gi, `var WEB_SERVER_PORT = ${publicPort};`);
  rewritten = injectDynamicsCrmLookupShim(rewritten, publicServerUrl);

  return rewritten;
}
