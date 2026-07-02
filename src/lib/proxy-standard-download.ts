import http from "http";
import type { Connector } from "./connectors";
import { serveAsBlobDownload } from "./proxy-blob-download";
import { trimBinaryPayload, type ProxyBinaryDetection } from "./proxy-response";

export interface HandleHeartbeatBinaryDownloadInput {
  connector: Connector;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  buffer: Buffer;
  binaryDetection: ProxyBinaryDetection | null;
  incomingHost: string;
  originalHeaders: http.IncomingHttpHeaders;
  isHtmlCommentOpen: boolean;
  logHB: (message: string) => void;
}

export function handleHeartbeatBinaryDownload(input: HandleHeartbeatBinaryDownloadInput): Buffer {
  const finalBuffer = trimBinaryPayload(input.buffer, input.binaryDetection);
  if (input.binaryDetection && input.binaryDetection.offset > 0) {
    input.logHB(
      `[HB-GUARD] ${input.binaryDetection.kind.toUpperCase()} detectado en offset ${input.binaryDetection.offset}, recortando buffer...`,
    );
  }

  serveAsBlobDownload(
    input.res,
    input.req,
    finalBuffer,
    input.originalHeaders,
    input.incomingHost,
    input.isHtmlCommentOpen,
    input.connector.id,
  );

  return finalBuffer;
}
