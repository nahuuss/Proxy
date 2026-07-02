import http from 'http';

import { prepareNtlmForwardResponse } from './proxy-ntlm-response';
import type {
  NtlmCallbackBaseInput,
  NtlmCallbackResponse,
} from './proxy-ntlm-callbacks';

export function writeNtlmCallbackError(res: http.ServerResponse, error: Error): void {
  if (!res.headersSent) {
    res.writeHead(502);
    res.end(`NTLM Error: ${error.message}`);
  }
}

export function resolvePreparedNtlmSuccess(input: NtlmCallbackBaseInput & {
  response: NtlmCallbackResponse;
  onDecode?: (encoding: string) => void;
  onDecodeError?: (error: Error) => void;
}) {
  const elapsedMs = Date.now() - input.startTime;
  const preparedResponse = prepareNtlmForwardResponse({
    connector: input.connector,
    responseHeaders: input.response.headers,
    responseBody: input.response.body,
    targetUrl: input.targetUrl,
    incomingHost: input.incomingHost,
    urlPart: input.urlPart,
    proto: input.proto,
    onDecode: input.onDecode,
    onDecodeError: input.onDecodeError,
  });

  return {
    elapsedMs,
    responseStatusCode: input.response.statusCode,
    responseHeaders: preparedResponse.headers,
    responseBody: preparedResponse.body,
    isFileDownload: preparedResponse.isFileDownload,
  };
}
