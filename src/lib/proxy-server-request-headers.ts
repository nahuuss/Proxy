import http from 'http';

import type { Connector } from './connectors';

export type ProxyForwardedHeaders = Record<string, string | string[] | undefined>;

export type ProxyRequestTransportContext = {
  forwardedHeaders: ProxyForwardedHeaders;
  bizguardClientId: string;
  bizguardRequestId: string;
  incomingHost: string;
  isInternalAuth: boolean;
  hostToSend: string;
  proto: 'http' | 'https';
  options: http.RequestOptions;
};

export function buildProxyServerTransportContext(input: {
  connector: Connector;
  req: http.IncomingMessage;
  targetUrl: URL;
  isHttps: boolean;
  agent: http.RequestOptions['agent'];
  effectiveReqUrl: string;
}): ProxyRequestTransportContext {
  const forwardedHeaders = { ...input.req.headers };
  const bizguardClientId = String(forwardedHeaders['x-bizguard-client-id'] || '').slice(0, 80);
  const bizguardRequestId = String(forwardedHeaders['x-bizguard-request-id'] || '').slice(0, 80);

  Object.keys(forwardedHeaders).forEach((headerName) => {
    if (headerName.startsWith('cf-') || headerName.startsWith('x-forwarded-')) {
      delete forwardedHeaders[headerName];
    }
  });
  delete forwardedHeaders['x-bizguard-client-id'];
  delete forwardedHeaders['x-bizguard-request-id'];

  const incomingHost = input.req.headers.host || input.connector.publicHost;
  const isInternalAuth = input.connector.id === 'internal-dashboard';
  const hostToSend = isInternalAuth ? incomingHost : input.targetUrl.host;
  const proto =
    incomingHost.includes('localhost') || incomingHost.includes('127.0.0.1') ? 'http' : 'https';

  return {
    forwardedHeaders,
    bizguardClientId,
    bizguardRequestId,
    incomingHost,
    isInternalAuth,
    hostToSend,
    proto,
    options: {
      hostname: input.targetUrl.hostname,
      port: input.targetUrl.port || (input.isHttps ? 443 : 80),
      path: input.effectiveReqUrl,
      method: input.req.method,
      headers: {
        ...forwardedHeaders,
        host: hostToSend,
        'x-forwarded-host': incomingHost,
        'x-forwarded-proto': proto,
        'x-forwarded-for':
          input.req.headers['x-forwarded-for'] || input.req.socket.remoteAddress || '127.0.0.1',
        'x-real-ip': input.req.headers['x-real-ip'] || input.req.socket.remoteAddress || '127.0.0.1',
        'accept-encoding': 'identity',
      },
      agent: input.agent,
    },
  };
}
