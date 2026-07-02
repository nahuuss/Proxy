import type { Connector } from './connectors';
import { buildConnectorAbsoluteCallbackUrl } from './login-entry';
import {
  buildConnectorCoreNtlmLoginUrl,
  buildConnectorNtlmLoginUrl,
  resolveRootEntryPathForConnector,
} from './product-profiles';

export function isProtectedApiRoute(url: string): boolean {
  return url.startsWith('/api/') && !url.startsWith('/api/auth');
}

export function buildAbsoluteCallbackUrl(
  hostHeader: string,
  requestUrl: string,
  connector?: Connector,
): string {
  return buildConnectorAbsoluteCallbackUrl({
    host: hostHeader,
    requestUrl,
    connector,
  });
}

export function buildCoreNtlmRedirect(
  connector: Connector,
  hostHeader: string,
  requestUrl: string,
): string {
  const absoluteCallback = buildAbsoluteCallbackUrl(hostHeader, requestUrl, connector);
  return buildConnectorCoreNtlmLoginUrl(connector, absoluteCallback);
}

export function buildCrmNtlmRedirect(
  connector: Connector,
  hostHeader: string,
  requestUrl: string,
): string {
  const absoluteCallback = buildAbsoluteCallbackUrl(hostHeader, requestUrl, connector);
  return buildConnectorNtlmLoginUrl(connector, absoluteCallback);
}

export function buildSignInRedirect(
  hostHeader: string,
  requestUrl: string,
  connector?: Connector,
): string {
  const absoluteCallback = buildAbsoluteCallbackUrl(hostHeader, requestUrl, connector);
  return `/api/auth/signin?callbackUrl=${encodeURIComponent(absoluteCallback)}`;
}

export function resolveRootEntryRedirect(connector?: Connector): string | undefined {
  if (!connector) return undefined;
  return resolveRootEntryPathForConnector(connector);
}
