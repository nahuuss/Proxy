function getDomain(host: string): string {
  return host.split(":")[0].split(".").slice(-2).join(".");
}

export function resolveCookieDomain(host?: string): string | undefined {
  const hostOnly = (host || "").trim().split(":")[0] || "";
  if (!hostOnly) return undefined;
  if (
    hostOnly.includes("localhost") ||
    hostOnly.includes("127.0.0.1") ||
    hostOnly.startsWith("10.") ||
    hostOnly.startsWith("192.")
  ) {
    return undefined;
  }

  const parts = hostOnly.split(".");
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 2 && parts.length >= 3) {
      return "." + parts.slice(-3).join(".");
    }
    return "." + parts.slice(-2).join(".");
  }

  if (parts.length === 2) {
    return "." + hostOnly;
  }

  return undefined;
}

export function buildAuthRedirectProxyUrl(input: {
  fullHost?: string;
  protocol?: string;
  fallbackAuthUrl?: string | null;
}): string | undefined {
  if (input.fullHost) {
    return `${input.protocol || "https"}://${input.fullHost}/api/auth`;
  }

  if (input.fallbackAuthUrl) {
    return `${input.fallbackAuthUrl}/api/auth`;
  }

  return undefined;
}

export function buildAuthCallbackUrl(input: {
  fullHost?: string;
  protocol?: string;
}): string | undefined {
  if (!input.fullHost) {
    return undefined;
  }

  return `${input.protocol || "https"}://${input.fullHost}/api/auth/callback/microsoft-entra-id`;
}

export interface ResolveAuthRedirectInput {
  url: string;
  baseUrl: string;
  fullHost?: string;
  protocol: string;
  isLocalRequest: boolean;
}

export function resolveAuthRedirectTarget(input: ResolveAuthRedirectInput): string {
  let resolvedHost = input.fullHost;
  let resolvedProtocol = input.protocol;
  const isLocalOrEmpty = !input.fullHost || input.isLocalRequest;

  if (isLocalOrEmpty && input.url.startsWith("http")) {
    try {
      const urlParsed = new URL(input.url);
      const urlHost = urlParsed.hostname;
      const notInternal =
        !urlHost.includes("localhost") &&
        !urlHost.includes("127.0.0.1") &&
        !urlHost.includes("0.0.0.0");
      if (notInternal && !input.isLocalRequest) {
        resolvedHost = urlParsed.port ? `${urlHost}:${urlParsed.port}` : urlHost;
        resolvedProtocol = urlParsed.protocol.replace(":", "");
      }
    } catch {
      // ignore malformed external hint
    }
  }

  const baseIsInternal =
    input.baseUrl.includes("0.0.0.0") ||
    input.baseUrl.includes("127.0.0.1") ||
    input.baseUrl.includes("localhost");
  const canFix = baseIsInternal && !!resolvedHost && !input.isLocalRequest;
  const effectiveBase = canFix
    ? `${resolvedProtocol}://${resolvedHost}`
    : input.baseUrl;

  if (input.url.startsWith("/")) {
    return `${effectiveBase}${input.url}`;
  }

  if (canFix) {
    try {
      const parsed = new URL(input.url, effectiveBase);
      const hostIsInternal =
        parsed.hostname.includes("localhost") ||
        parsed.hostname.includes("127.0.0.1") ||
        parsed.hostname.includes("0.0.0.0");
      if (hostIsInternal && resolvedHost) {
        return `${resolvedProtocol}://${resolvedHost}${parsed.pathname}${parsed.search}`;
      }
      return parsed.toString();
    } catch {
      // continue to fallback checks
    }
  }

  try {
    const urlObj = new URL(input.url, effectiveBase);
    const baseObj = new URL(effectiveBase);
    const urlDomain = getDomain(urlObj.hostname);
    const baseDomain = getDomain(baseObj.hostname);
    if (urlDomain === baseDomain) {
      return input.url;
    }
  } catch {
    // ignore parse issues and fall back
  }

  return effectiveBase;
}
