import zlib from "zlib";

export interface ProxyBinaryDetection {
  kind: "pk" | "pdf" | "ole";
  offset: number;
}

export function isFileDownloadResponse(contentType: string, contentDisposition: string): boolean {
  return contentDisposition.includes("attachment")
    || /excel|spreadsheetml|zip|pdf|octet-stream|wordprocessingml|presentationml/.test(contentType.toLowerCase());
}

export function isTextResponse(contentType: string, requestPath: string): boolean {
  return (contentType.includes("text")
    || contentType.includes("javascript")
    || contentType.includes("json")
    || contentType.includes("xml"))
    && !/\.(png|jpg|jpeg|gif|ico|cur|svg)$/i.test(requestPath);
}

export function decodeProxyResponseBody(body: Buffer, contentEncoding: string): Buffer {
  if (body.length === 0) {
    return body;
  }

  if (contentEncoding === "gzip") {
    return zlib.gunzipSync(body);
  }

  if (contentEncoding === "deflate") {
    return zlib.inflateSync(body);
  }

  return body;
}

export function detectBinaryPayload(body: Buffer, allowShortPkSignature = false): ProxyBinaryDetection | null {
  const firstKB = body.subarray(0, 2048);
  const pkSignature = allowShortPkSignature
    ? (firstKB.indexOf(Buffer.from([0x50, 0x4B, 0x03, 0x04])) !== -1
      ? firstKB.indexOf(Buffer.from([0x50, 0x4B, 0x03, 0x04]))
      : firstKB.indexOf(Buffer.from([0x50, 0x4B])))
    : firstKB.indexOf(Buffer.from([0x50, 0x4B]));
  if (pkSignature !== -1) {
    return { kind: "pk", offset: pkSignature };
  }

  const pdfSignature = firstKB.indexOf(Buffer.from([0x25, 0x50, 0x44, 0x46]));
  if (pdfSignature !== -1) {
    return { kind: "pdf", offset: pdfSignature };
  }

  const oleSignature = firstKB.indexOf(Buffer.from([0xD0, 0xCF, 0x11, 0xE0]));
  if (oleSignature !== -1) {
    return { kind: "ole", offset: oleSignature };
  }

  return null;
}

export function trimBinaryPayload(body: Buffer, detection: ProxyBinaryDetection | null): Buffer {
  if (!detection || detection.offset <= 0) {
    return body;
  }
  return body.subarray(detection.offset);
}
