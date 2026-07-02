import NextAuth from "next-auth";
import { skipCSRFCheck } from "@auth/core";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import {
  applyNtlmJwtClaims,
  applyNtlmSessionClaims,
  CORE_NTLM_PROVIDER_ID,
  createCoreNtlmAuthUser,
  createCrmNtlmAuthUser,
  CRM_NTLM_PROVIDER_ID,
} from "./lib/auth-ntlm";
import { getSettings } from "./lib/settings";
import { logSSO } from "./lib/logger-sso";
import { getConnectorById, getConnectors } from "./lib/connectors";
import { resolveAuthOrigin } from "./lib/auth-origin";
import { getAuthAuthorizedDecision } from "./lib/auth-access-rules";
import { validateCoreNtlmCredentials, validateCrmNtlmCredentials } from "./lib/auth-ntlm-validation";
import {
  buildAuthCallbackUrl,
  buildAuthRedirectProxyUrl,
  resolveAuthRedirectTarget,
  resolveCookieDomain,
} from "./lib/auth-runtime";

export const { handlers, auth, signIn, signOut } = NextAuth(async (req) => {
  const connectors = await getConnectors();
  const settings = await getSettings();
  const origin = resolveAuthOrigin({
    forwardedHost: req?.headers.get("x-forwarded-host"),
    requestHost: req?.headers.get("host"),
    forwardedProto: req?.headers.get("x-forwarded-proto"),
    connectors,
    settings,
    fallbackAuthUrl: process.env.AUTH_URL,
  });
  const fullHost = origin.effectiveHost;
  const resolvedConnector = origin.matchedConnector;

  logSSO(
    resolvedConnector?.id,
    `[AUTH-ORIGIN] source=${origin.source} forwarded=${origin.forwardedHost || "(empty)"} request=${origin.requestHost || "(empty)"} canonical=${origin.canonicalConnectorHost || "(empty)"} effective=${origin.effectiveHost || "(empty)"} protocol=${origin.effectiveProtocol} local=${origin.isLocalRequest}`,
  );

  if (!fullHost) {
    const headerDump: Record<string, string> = {};
    req?.headers.forEach((value, key) => {
      headerDump[key] = value;
    });
    logSSO(undefined, `[Dynamic-Fallback] Host still empty for URL: ${req?.url}`, { headers: headerDump });
  } else {
    logSSO(
      resolvedConnector?.id,
      `[AUTH-ORIGIN-APPLIED] host=${fullHost} protocol=${origin.effectiveProtocol} source=${origin.source}`,
    );
  }

  const cookieDomain = resolveCookieDomain(fullHost);
  const protocol = origin.effectiveProtocol;
  const dynamicCallbackUrl = buildAuthCallbackUrl({ fullHost, protocol });
  const redirectProxyUrl = buildAuthRedirectProxyUrl({
    fullHost,
    protocol,
    fallbackAuthUrl: process.env.AUTH_URL,
  });

  logSSO(
    resolvedConnector?.id,
    `[INIT] fullHost=${fullHost || "(empty)"} | cookieDomain=${cookieDomain || "(none)"} | protocol=${protocol}`,
  );
  logSSO(
    resolvedConnector?.id,
    `[INIT] redirectProxyUrl=${redirectProxyUrl || "(undefined)"} | dynamicCallbackUrl=${dynamicCallbackUrl || "(undefined)"}`,
  );

  const dynamicProviders = [
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
      ? MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
          issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
        })
      : null,
    Credentials({
      id: CRM_NTLM_PROVIDER_ID,
      name: "NTLM Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        domain: { label: "Domain", type: "text" },
        connectorId: { label: "Connector", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password || !credentials?.connectorId) return null;
        const username = credentials.username as string;
        const password = credentials.password as string;
        const connectorId = credentials.connectorId as string;
        const httpntlm = await import("httpntlm");
        const connector = await getConnectorById(connectorId);
        const validation = await validateCrmNtlmCredentials({
          connector,
          connectorId,
          username,
          password,
          domain: credentials.domain as string,
          httpntlm,
        });
        if (!validation.valid) {
          return null;
        }

        return createCrmNtlmAuthUser({
          connectorId,
          username,
          password,
          domain: validation.domain,
        });
      },
    }),
    Credentials({
      id: CORE_NTLM_PROVIDER_ID,
      name: "Core NTLM Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        domain: { label: "Domain", type: "text" },
        connectorId: { label: "Connector", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password || !credentials?.connectorId) return null;
        const username = credentials.username as string;
        const password = credentials.password as string;
        const connectorId = credentials.connectorId as string;
        const httpntlm = await import("httpntlm");
        const connector = await getConnectorById(connectorId);
        const validation = await validateCoreNtlmCredentials({
          connector,
          connectorId,
          username,
          password,
          domain: credentials.domain as string,
          httpntlm,
        });
        if (!validation.valid) {
          return null;
        }

        return createCoreNtlmAuthUser({
          connectorId,
          username,
          password,
          domain: validation.domain,
        });
      },
    }),
  ].filter(Boolean) as any[];

  return {
    pages: { signIn: "/login" },
    trustHost: true,
    redirectProxyUrl,
    debug: true,
    useSecureCookies: false,
    skipCSRFCheck: skipCSRFCheck,
    cookies: {
      sessionToken: {
        name: "authjs.session-token",
        options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
      },
      callbackUrl: {
        name: "authjs.callback-url",
        options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
      },
      csrfToken: {
        name: "authjs.csrf-token",
        options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
      },
      pkceCodeVerifier: {
        name: "authjs.pkce.code_verifier",
        options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true },
      },
      state: {
        name: "authjs.state",
        options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
      },
      nonce: {
        name: "authjs.nonce",
        options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
      },
    },
    logger: {
      error(error: any) {
        const cause = error?.cause;
        logSSO(undefined, `Auth ERROR: ${error?.message || error}`, {
          detail: error,
          cause: cause?.message || cause,
        });
        if (cause) console.error("[Auth ERROR CAUSE]", cause?.message || cause, cause?.stack || "");
      },
      warn(code: string) {
        console.warn("[Auth WARN]", code);
      },
      debug(message: string, metadata: any) {
        console.log("[Auth TRACE]", message, metadata ? JSON.stringify(metadata).substring(0, 500) : "");
      },
    },
    providers: dynamicProviders,
    callbacks: {
      async authorized({ auth, request }: any) {
        const { nextUrl } = request;
        const connectors = await getConnectors();
        const settings = await getSettings();
        const forwardedHost = request.headers.get("x-forwarded-host");
        const requestHost = request.headers.get("host");
        const host = forwardedHost || requestHost || "";
        const port = parseInt(host.split(":")[1] || "80", 10);
        const authorizedOrigin = resolveAuthOrigin({
          forwardedHost,
          requestHost,
          forwardedProto: request.headers.get("x-forwarded-proto"),
          connectors,
          settings,
          fallbackAuthUrl: process.env.AUTH_URL,
        });
        const connector = authorizedOrigin.matchedConnector ?? connectors.find((candidate) => candidate.port === port);
        const connectorId = connector?.id;
        const isLoggedIn = !!auth?.user;
        logSSO(
          connectorId,
          `[authorized] path=${nextUrl.pathname} | host=${host} | effectiveHost=${authorizedOrigin.effectiveHost || "(empty)"} | source=${authorizedOrigin.source} | isLoggedIn=${isLoggedIn} | user=${auth?.user?.email || "none"}`,
        );

        const decision = getAuthAuthorizedDecision({
          host,
          pathname: nextUrl.pathname,
          isLoggedIn,
          settingsBypass: settings.bypassAuth,
          connectorBypass: connector?.bypassAuth === true,
        });
        logSSO(connectorId, `[authorized] -> ${decision.allow ? "ALLOW" : "DENY"} (${decision.reason})`);
        return decision.allow;
      },

      async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
        let port = 80;
        try {
          const parsed = new URL(url.startsWith("/") ? baseUrl : url);
          port = parseInt(parsed.port || (parsed.protocol === "https:" ? "443" : "80"), 10);
        } catch {
          // no-op
        }
        const connectors = await getConnectors();
        const connector = connectors.find((candidate) => candidate.port === port);
        const connectorId = connector?.id;
        const result = resolveAuthRedirectTarget({
          url,
          baseUrl,
          fullHost,
          protocol,
          isLocalRequest: origin.isLocalRequest,
        });
        logSSO(connectorId, `[redirect->RETURN] ${result}`);
        return result;
      },

      async signIn({ user, account }: any) {
        logSSO(undefined, `[signIn] user=${user?.email} | provider=${account?.provider} | type=${account?.type}`);
        return true;
      },

      async jwt({ token, user, account }: any) {
        return applyNtlmJwtClaims(token, user, account?.provider);
      },

      async session({ session, token }: any) {
        return applyNtlmSessionClaims(session, token);
      },
    },
  };
});
