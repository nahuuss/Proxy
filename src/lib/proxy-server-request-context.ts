import http from "http";
import type { Connector } from "./connectors";
import type { ProductExecutionMode } from "./product-catalog";
import { normalizeProxyRequestUrlForConnector } from "./product-profiles";
import {
  buildProxyServerExecutionContext,
  normalizeHeartbeatPathCandidate,
  resolveProfileLabel,
} from "./proxy-server-request-execution";
import { buildProxyServerTransportContext } from "./proxy-server-request-headers";

export interface CreateProxyServerRequestContextInput {
  connector: Connector;
  req: http.IncomingMessage;
  targetUrl: URL;
  isHttps: boolean;
  agent: http.RequestOptions["agent"];
}

export interface ProxyServerRequestContext {
  forwardedHeaders: Record<string, string | string[] | undefined>;
  bizguardClientId: string;
  bizguardRequestId: string;
  incomingHost: string;
  isInternalAuth: boolean;
  hostToSend: string;
  proto: "http" | "https";
  effectiveReqUrl: string;
  options: http.RequestOptions;
  urlPart: string;
  path: string;
  isImage: boolean;
  isStatic: boolean;
  isPostLike: boolean;
  isAjax: boolean;
  isMultipartUpload: boolean;
  hasForcedHeartbeatPath: boolean;
  executionMode: ProductExecutionMode;
  hbEligible: boolean;
  internalHost: string;
  suspiciousHosts: string[];
  encodedHosts: string[];
  uniqueSuspiciousHosts: string[];
}

export { normalizeHeartbeatPathCandidate, resolveProfileLabel };

export function createProxyServerRequestContext(
  input: CreateProxyServerRequestContextInput,
): ProxyServerRequestContext {
  const effectiveReqUrl = normalizeProxyRequestUrlForConnector(input.connector, input.req.url || "/");
  const transportContext = buildProxyServerTransportContext({
    connector: input.connector,
    req: input.req,
    targetUrl: input.targetUrl,
    isHttps: input.isHttps,
    agent: input.agent,
    effectiveReqUrl,
  });
  const executionContext = buildProxyServerExecutionContext({
    connector: input.connector,
    req: input.req,
    targetUrl: input.targetUrl,
    effectiveReqUrl,
  });

  return {
    forwardedHeaders: transportContext.forwardedHeaders,
    bizguardClientId: transportContext.bizguardClientId,
    bizguardRequestId: transportContext.bizguardRequestId,
    incomingHost: transportContext.incomingHost,
    isInternalAuth: transportContext.isInternalAuth,
    hostToSend: transportContext.hostToSend,
    proto: transportContext.proto,
    effectiveReqUrl,
    options: transportContext.options,
    urlPart: executionContext.urlPart,
    path: executionContext.path,
    isImage: executionContext.isImage,
    isStatic: executionContext.isStatic,
    isPostLike: executionContext.isPostLike,
    isAjax: executionContext.isAjax,
    isMultipartUpload: executionContext.isMultipartUpload,
    hasForcedHeartbeatPath: executionContext.hasForcedHeartbeatPath,
    executionMode: executionContext.executionMode,
    hbEligible: executionContext.hbEligible,
    internalHost: executionContext.internalHost,
    suspiciousHosts: executionContext.suspiciousHosts,
    encodedHosts: executionContext.encodedHosts,
    uniqueSuspiciousHosts: executionContext.uniqueSuspiciousHosts,
  };
}

export function describeProxyExecutionMode(
  context: Pick<ProxyServerRequestContext, "isAjax" | "hbEligible" | "hasForcedHeartbeatPath" | "executionMode">,
): string {
  return `XHR=${context.isAjax} hbEligible=${context.hbEligible} forcedHB=${context.hasForcedHeartbeatPath} mode=${context.executionMode}`;
}
