import http from 'http';

import type { Connector } from './connectors';
import { DEFAULT_PRODUCT_TYPE, getEffectiveProductConfig, type ProductExecutionMode } from './product-catalog';
import { matchesLegacyForcedExecutionPath } from './product-profiles';
import { classifyRequest } from './request-classifier';
import { getRulesFor } from './rules';

export type ProxyRequestExecutionContext = {
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
};

export function normalizeHeartbeatPathCandidate(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function resolveProfileLabel(connector: Pick<Connector, 'connectorType'>): string {
  return connector.connectorType || DEFAULT_PRODUCT_TYPE;
}

export function buildProxyServerExecutionContext(input: {
  connector: Connector;
  req: http.IncomingMessage;
  targetUrl: URL;
  effectiveReqUrl: string;
}): ProxyRequestExecutionContext {
  const urlPart = input.effectiveReqUrl.split('?')[0].toLowerCase();
  const path = input.effectiveReqUrl.split('?')[0];
  const productConfig = getEffectiveProductConfig(input.connector);
  const rules = getRulesFor(input.connector.connectorType);
  const requestShape = classifyRequest(input.req, urlPart);
  const { isImage, isStatic, isPostLike, isAjax, isMultipartUpload } = requestShape;
  const hasForcedHeartbeatPath = matchesLegacyForcedExecutionPath(
    input.connector,
    normalizeHeartbeatPathCandidate(urlPart),
  );
  const isInternalConnector = input.connector.id === 'internal-dashboard';
  const executionMode: ProductExecutionMode = isInternalConnector
    ? 'none'
    : rules.resolveExecutionMode({
        req: input.req,
        connector: input.connector,
        urlPart,
        path,
        isStatic,
        isImage,
        isPostLike,
        isAjax,
        isMultipartUpload,
        hasForcedHeartbeatPath,
        productConfig,
      });

  const internalHost = input.targetUrl.host;
  const suspiciousHosts = [internalHost, 'localhost:3000', '127.0.0.1:3000', '0.0.0.0:3000'];
  const encodedHosts = suspiciousHosts.map((host) => encodeURIComponent(host));
  const uniqueSuspiciousHosts = Array.from(new Set([...suspiciousHosts, ...encodedHosts]));

  return {
    urlPart,
    path,
    isImage,
    isStatic,
    isPostLike,
    isAjax,
    isMultipartUpload,
    hasForcedHeartbeatPath,
    executionMode,
    hbEligible: executionMode !== 'none',
    internalHost,
    suspiciousHosts,
    encodedHosts,
    uniqueSuspiciousHosts,
  };
}
