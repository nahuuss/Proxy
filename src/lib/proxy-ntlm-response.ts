import http from "http";
import type { Connector } from "./connectors";
import { rewriteResponseBodyForConnector } from "./product-profiles";
import {
  decodeProxyResponseBody,
  isFileDownloadResponse,
  isTextResponse,
} from "./proxy-response";
import { applyDeepRewrite } from "./proxy-deep-rewrite";
import { rewriteHeaders } from "./proxy-header-rewrite";

export interface PrepareNtlmForwardResponseInput {
  connector: Connector;
  responseHeaders: http.IncomingHttpHeaders;
  responseBody: Buffer | string | undefined;
  targetUrl: URL;
  incomingHost: string;
  urlPart: string;
  proto: string;
  onDecode?: (encoding: string) => void;
  onDecodeError?: (error: Error) => void;
}

export interface PreparedNtlmForwardResponse {
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  isFileDownload: boolean;
}

export function prepareNtlmForwardResponse(input: PrepareNtlmForwardResponseInput): PreparedNtlmForwardResponse {
  const headers = rewriteHeaders(input.responseHeaders, input.targetUrl, input.incomingHost);
  delete headers["transfer-encoding"];
  delete headers["content-length"];

  let body = input.responseBody
    ? Buffer.isBuffer(input.responseBody)
      ? input.responseBody
      : Buffer.from(input.responseBody)
    : Buffer.alloc(0);
  const contentEncoding = (headers["content-encoding"] || "") as string;

  if (body.length > 0 && (contentEncoding === "gzip" || contentEncoding === "deflate")) {
    try {
      body = decodeProxyResponseBody(body, contentEncoding);
      delete headers["content-encoding"];
      input.onDecode?.(contentEncoding);
    } catch (error) {
      input.onDecodeError?.(error as Error);
    }
  }

  const contentType = (headers["content-type"] || "") as string;
  const contentDisposition = (headers["content-disposition"] || "") as string;
  const isText = isTextResponse(contentType, input.urlPart);

  if (isText && body.length > 0) {
    let bodyText = body.toString("utf8");
    bodyText = applyDeepRewrite(bodyText, input.targetUrl, input.incomingHost);
    bodyText = rewriteResponseBodyForConnector(input.connector, bodyText, {
      incomingHost: input.incomingHost,
      proto: input.proto,
    });
    body = Buffer.from(bodyText, "utf8");
  }

  return {
    headers,
    body,
    isFileDownload: isFileDownloadResponse(contentType, contentDisposition),
  };
}
