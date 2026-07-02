import http from "http";
import type { Connector } from "./connectors";
import type { ProxyHeartbeatState } from "./proxy-heartbeat";
import { detectBinaryPayload, trimBinaryPayload } from "./proxy-response";
import { serveAsBlobDownload } from "./proxy-blob-download";

export function writeCoreNtlmResponse(input: {
  res: http.ServerResponse;
  statusCode: number;
  responseHeaders: Record<string, string | string[] | undefined>;
  responseBody: Buffer;
}) {
  input.responseHeaders["content-length"] = String(input.responseBody.length);
  input.res.writeHead(input.statusCode, input.responseHeaders);
  input.res.end(input.responseBody);
}

export function writeCrmNtlmResponse(input: {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  heartbeatState: ProxyHeartbeatState;
  statusCode: number;
  incomingHost: string;
  responseHeaders: Record<string, string | string[] | undefined>;
  responseBody: Buffer;
  isFileDownload: boolean;
}) {
  if (input.heartbeatState.isHeartbeatActive) {
    const binaryDetection = detectBinaryPayload(input.responseBody, true);
    if (binaryDetection || input.isFileDownload) {
      const finalBuffer = trimBinaryPayload(input.responseBody, binaryDetection);
      serveAsBlobDownload(
        input.res,
        input.req,
        finalBuffer,
        input.responseHeaders,
        input.incomingHost,
        input.heartbeatState.isHtmlCommentOpen,
        input.connector.id,
      );
      return;
    }

    if (input.res.headersSent) {
      if (input.heartbeatState.isHtmlCommentOpen) {
        input.res.write("-->");
      }
      input.res.write(input.responseBody);
      input.res.end();
      return;
    }
  }

  input.responseHeaders["content-length"] = String(input.responseBody.length);
  input.res.writeHead(input.statusCode, input.responseHeaders);
  input.res.end(input.responseBody);
}
