import type http from 'http';
import type { Connector } from './connectors';
import type { ProxyPortWebSocketLikeSocket } from './proxy-port-websocket';
import {
  describeWebSocketProxyConnection,
  describeWebSocketProxyError,
  isExpectedWebSocketBackendClose,
} from './proxy-websocket';

export function bridgeProxyPortWebSocketConnection(input: {
  connector: Connector;
  req: http.IncomingMessage;
  clientSocket: ProxyPortWebSocketLikeSocket;
  backendSocket: ProxyPortWebSocketLikeSocket;
  requestPayload: string | Buffer;
  head: Buffer;
  onReadyEvent: string;
  log: (message: string, type?: 'info' | 'error' | 'system') => void;
}): void {
  input.backendSocket.once(input.onReadyEvent, () => {
    input.backendSocket.write(input.requestPayload);
    if (input.head.length > 0) {
      input.backendSocket.write(input.head);
    }
    input.backendSocket.pipe(input.clientSocket);
    input.clientSocket.pipe(input.backendSocket);
    input.log(describeWebSocketProxyConnection(input.connector, input.req.url), 'info');
  });

  input.backendSocket.on('error', (error: unknown) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    const code = (normalizedError as Error & { code?: string }).code || '';
    if (!isExpectedWebSocketBackendClose(code)) {
      input.log(describeWebSocketProxyError(input.connector, normalizedError.message), 'error');
    }
    if (!input.clientSocket.destroyed) {
      input.clientSocket.destroy();
    }
  });

  input.clientSocket.on('error', () => {
    if (!input.backendSocket.destroyed) {
      input.backendSocket.destroy();
    }
  });

  input.backendSocket.on('close', () => {
    if (!input.clientSocket.destroyed) {
      input.clientSocket.destroy();
    }
  });

  input.clientSocket.on('close', () => {
    if (!input.backendSocket.destroyed) {
      input.backendSocket.destroy();
    }
  });
}
