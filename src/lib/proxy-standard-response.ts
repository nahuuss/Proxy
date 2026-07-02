import type { Connector } from "./connectors";
import { rewriteResponseBodyForConnector } from "./product-profiles";
import {
  decodeProxyResponseBody,
  detectBinaryPayload,
  type ProxyBinaryDetection,
} from "./proxy-response";
import { applyDeepRewrite } from "./proxy-deep-rewrite";

export interface PrepareStandardProxyBufferInput {
  connector: Connector;
  body: Buffer;
  contentEncoding: string;
  contentType: string;
  incomingHost: string;
  targetUrl: URL;
  urlPart: string;
  proto: string;
  allowShortPk?: boolean;
  onDecode?: (encoding: string) => void;
  onDecodeError?: (error: Error) => void;
}

export interface PreparedStandardProxyBuffer {
  body: Buffer;
  binaryDetection: ProxyBinaryDetection | null;
}

export function prepareStandardProxyBuffer(input: PrepareStandardProxyBufferInput): PreparedStandardProxyBuffer {
  let body = input.body;

  if (body.length > 0 && (input.contentEncoding === "gzip" || input.contentEncoding === "deflate")) {
    try {
      body = decodeProxyResponseBody(body, input.contentEncoding);
      input.onDecode?.(input.contentEncoding);
    } catch (error) {
      input.onDecodeError?.(error as Error);
    }
  }

  const binaryDetection = detectBinaryPayload(body, input.allowShortPk);

  if (!binaryDetection && body.length > 0) {
    let rewrittenBody = body.toString("utf8");
    rewrittenBody = applyDeepRewrite(rewrittenBody, input.targetUrl, input.incomingHost);
    rewrittenBody = rewriteResponseBodyForConnector(input.connector, rewrittenBody, {
      incomingHost: input.incomingHost,
      proto: input.proto,
    });
    body = Buffer.from(rewrittenBody, "utf8");
  }

  return {
    body,
    binaryDetection,
  };
}
