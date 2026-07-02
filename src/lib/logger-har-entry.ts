import http from "http";
import {
  buildHarRequestPostData,
  buildHarResponseContent,
  calculateHarHeadersSize,
} from "./logger-har-content";
import {
  parseHarHeaders,
  parseHarQueryString,
  parseHarRequestCookies,
  parseHarResponseCookies,
} from "./logger-har-parsers";
import type { HarEntryParams } from "./logger-har-types";

export function buildHarEntry(params: HarEntryParams) {
  const reqUrl = params.req.url || "";
  const reqHeaders = params.req.headers || {};
  const reqHeadersSize = calculateHarHeadersSize(reqHeaders);
  const resHeadersSize = calculateHarHeadersSize(params.resHeaders);
  const { bodySize: reqBodySize, postData } = buildHarRequestPostData({
    headers: reqHeaders,
    body: params.reqBody,
  });
  const { bodySize: resBodySize, content } = buildHarResponseContent({
    headers: params.resHeaders,
    body: params.resBody,
    requestUrl: reqUrl,
    overrideBodySize: params.overrideResBodySize,
  });

  return {
    startedDateTime: new Date(params.startTime).toISOString(),
    time: params.elapsedMs,
    _username: params.username || "anonymous",
    request: {
      method: params.req.method || "GET",
      url: reqUrl,
      httpVersion: "HTTP/1.1",
      headers: parseHarHeaders(reqHeaders),
      queryString: parseHarQueryString(reqUrl),
      cookies: parseHarRequestCookies(reqHeaders.cookie as string | undefined),
      headersSize: reqHeadersSize,
      bodySize: reqBodySize,
      postData,
    },
    response: {
      status: params.resStatusCode,
      statusText: http.STATUS_CODES[params.resStatusCode] || "Unknown",
      httpVersion: "HTTP/1.1",
      headers: parseHarHeaders(params.resHeaders),
      cookies: parseHarResponseCookies(params.resHeaders["set-cookie"]),
      content,
      redirectURL: (params.resHeaders.location || "") as string,
      headersSize: resHeadersSize,
      bodySize: resBodySize,
    },
    cache: {},
    timings: {
      send: 0,
      wait: params.elapsedMs,
      receive: 0,
    },
  };
}
