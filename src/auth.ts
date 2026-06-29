import NextAuth from "next-auth";
import { skipCSRFCheck } from "@auth/core";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import http from "http";
import https from "https";
import { getSettings } from "./lib/settings";
import { logSSO } from "./lib/logger-sso";
import { getConnectorById, getConnectors } from "./lib/connectors";
import { buildCoreNtlmValidationUrl } from "./lib/core-ntlm";
import { buildDynamicsCrmEntryUrl } from "./lib/dynamics-crm";
import { resolveAuthOrigin } from "./lib/auth-origin";

// Exportar como función dinámica para soportar múltiples hosts
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
  let fullHost = origin.effectiveHost;
  const resolvedConnector = origin.matchedConnector;

  // ─── PRIORIZACIÓN POR CONECTOR ──────────────────────────────────────────────
  // Si la petición viene por un puerto que coincide con un conector configurado
  // usamos preferentemente su 'publicHost'.
  logSSO(
    resolvedConnector?.id,
    `[AUTH-ORIGIN] source=${origin.source} forwarded=${origin.forwardedHost || "(empty)"} request=${origin.requestHost || "(empty)"} canonical=${origin.canonicalConnectorHost || "(empty)"} effective=${origin.effectiveHost || "(empty)"} protocol=${origin.effectiveProtocol} local=${origin.isLocalRequest}`,
  );

  if (!fullHost) {
    const headerDump: Record<string, string> = {};
    // Si el conector tiene un host público, lo usamos como base.
    // Si el puerto no es estándar (80/443), lo mantenemos.
    req?.headers.forEach((v, k) => { headerDump[k] = v; });
    logSSO(undefined, `[Dynamic-Fallback] Host still empty for URL: ${req?.url}`, { headers: headerDump });
  } else if (false) {
    // Si el host sigue vacío (ej: req sin headers), fallback a settings globales
    const settings = await getSettings();
    if (settings.publicHost) {
      fullHost = settings.publicHost;
      logSSO(undefined, `[Global-Settings-Match] Host was empty. Using fallback: ${fullHost}`);
    } else {
      const headerDump: Record<string, string> = {};
      req?.headers.forEach((v, k) => { headerDump[k] = v; });
      logSSO(undefined, `[Dynamic-Fallback] Host still empty for URL: ${req?.url}`, { headers: headerDump });
    }
  } else {
    logSSO(resolvedConnector?.id, `[AUTH-ORIGIN-APPLIED] host=${fullHost} protocol=${origin.effectiveProtocol} source=${origin.source}`);
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const hostOnly = fullHost?.split(":")[0] || "";
  let cookieDomain: string | undefined;

  if (hostOnly && !hostOnly.includes("localhost") && !hostOnly.includes("127.0.0.1") && !hostOnly.startsWith("10.") && !hostOnly.startsWith("192.")) {
    const parts = hostOnly.split(".");
    if (parts.length >= 3) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.length === 2 && parts.length >= 3) {
        cookieDomain = "." + parts.slice(-3).join(".");
      } else {
        cookieDomain = "." + parts.slice(-2).join(".");
      }
    } else if (parts.length === 2) {
      cookieDomain = "." + hostOnly;
    }
  }

  const protocol = origin.effectiveProtocol;
  const dynamicCallbackUrl = fullHost ? `${protocol}://${fullHost}/api/auth/callback/microsoft-entra-id` : undefined;

  const dynamicProviders = [
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?
      MicrosoftEntraID({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
      }) : null,
    Credentials({
      id: "ntlm-login",
      name: "NTLM Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        domain: { label: "Domain", type: "text" },
        connectorId: { label: "Connector", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password || !credentials?.connectorId) return null;
        const username = credentials.username as string;
        const password = credentials.password as string;
        const domain = (credentials.domain as string) || "SERENASEGUROS";
        const connectorId = credentials.connectorId as string;

        // Validar credenciales contra el CRM real antes de crear sesión
        const httpntlm = await import("httpntlm");
        const ntlmConnector = await getConnectorById(connectorId);
        if (!ntlmConnector || !ntlmConnector.isActive || (!ntlmConnector.isNtlm && ntlmConnector.connectorType !== "dynamics-crm")) {
          logSSO(connectorId, `[NTLM-AUTH] Conector inválido o no habilitado para CRM NTLM.`);
          return null;
        }

        try {
          // Usar entryPath si está configurado (ej: /Inicio/ o /SERENAART/).
          // La raíz / puede devolver 404 o redirect en algunos CRM — no es indicador fiable.
          const testUrl = buildDynamicsCrmEntryUrl(ntlmConnector.targetUrl, ntlmConnector.entryPath);
          const testIsHttps = testUrl.startsWith("https://");
          const agent = testIsHttps
            ? new https.Agent({ keepAlive: true, rejectUnauthorized: ntlmConnector.strictTls === true })
            : new http.Agent({ keepAlive: true });
          logSSO(connectorId, `[NTLM-AUTH] Validando credenciales CRM contra ${testUrl} | strictTls=${ntlmConnector.strictTls === true}`);
          const valid = await new Promise<boolean>((resolve) => {
            httpntlm.get({
              username, password, domain, workstation: '',
              url: testUrl,
              agent,
              timeout: 15000,
            }, (err: any, res: any) => {
              if (err) { resolve(false); return; }
              // 401 = credenciales incorrectas. 200/302/404/500 = servidor respondió = credenciales OK
              resolve(res.statusCode !== 401);
            });
          });
          if (!valid) {
            logSSO(connectorId, `[NTLM-AUTH] Credenciales rechazadas para usuario=${username}.`);
            return null;
          }
        } catch (error: any) {
          logSSO(connectorId, `[NTLM-AUTH] Excepción inesperada durante validación: ${error?.message || error}`);
          return null;
        }

        return {
          id: `${connectorId}:${username}`,
          email: `${username}@${domain}`,
          name: username,
          crmUser: username,
          crmPass: password,
          crmDomain: domain,
          crmConnectorId: connectorId,
        };
      }
    }),
    Credentials({
      id: "core-ntlm-login",
      name: "Core NTLM Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        domain: { label: "Domain", type: "text" },
        connectorId: { label: "Connector", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password || !credentials?.connectorId) return null;
        const username = credentials.username as string;
        const password = credentials.password as string;
        const domain = (credentials.domain as string) || "";
        const connectorId = credentials.connectorId as string;

        const httpntlm = await import("httpntlm");
        const connector = await getConnectorById(connectorId);
        if (!connector || connector.connectorType !== "core" || !connector.isActive || !connector.coreNtlmDomain) {
          logSSO(connectorId, `[CORE-NTLM-AUTH] Conector inválido o sin dominio NTLM configurado.`);
          return null;
        }

        const validationUrl = buildCoreNtlmValidationUrl(connector);
        const validationIsHttps = validationUrl.startsWith("https://");
        const agent = validationIsHttps
          ? new https.Agent({ keepAlive: true, rejectUnauthorized: connector.strictTls === true })
          : new http.Agent({ keepAlive: true });

        try {
          logSSO(connectorId, `[CORE-NTLM-AUTH] Validando credenciales contra ${validationUrl} | strictTls=${connector.strictTls === true}`);
          const valid = await new Promise<boolean>((resolve) => {
            httpntlm.get({
              username,
              password,
              domain: domain || connector.coreNtlmDomain || "",
              workstation: '',
              url: validationUrl,
              agent,
              timeout: 15000,
            }, (err: any, res: any) => {
              if (err) {
                logSSO(connectorId, `[CORE-NTLM-AUTH] Error validando NTLM: ${err.message || err}`);
                resolve(false);
                return;
              }
              logSSO(connectorId, `[CORE-NTLM-AUTH] Respuesta NTLM status=${res?.statusCode}`);
              resolve(res.statusCode !== 401);
            });
          });
          if (!valid) return null;
        } catch {
          logSSO(connectorId, `[CORE-NTLM-AUTH] Excepción inesperada durante validación.`);
          return null;
        }

        return {
          id: `${connectorId}:${username}`,
          email: `${username}@${domain || connector.coreNtlmDomain}`,
          name: username,
          coreUser: username,
          corePass: password,
          coreDomain: domain || connector.coreNtlmDomain,
          coreConnectorId: connectorId,
        };
      }
    })
  ].filter(Boolean) as any[];

  // redirectProxyUrl tells auth.js to use the public host for BOTH the
  // authorization redirect_uri AND the token exchange redirect_uri.
  // Without it, the token exchange uses the internal server URL (0.0.0.0:3000)
  // which doesn't match Azure AD's registered redirect URI → OAuthCallbackError.
  const redirectProxyUrl = fullHost ? `${protocol}://${fullHost}/api/auth` : process.env.AUTH_URL ? `${process.env.AUTH_URL}/api/auth` : undefined;

  logSSO(resolvedConnector?.id, `[INIT] fullHost=${fullHost || "(empty)"} | cookieDomain=${cookieDomain || "(none)"} | protocol=${protocol}`);
  logSSO(resolvedConnector?.id, `[INIT] redirectProxyUrl=${redirectProxyUrl || "(undefined)"} | dynamicCallbackUrl=${dynamicCallbackUrl || "(undefined)"}`);

  return {
    pages: { signIn: '/login' },
    trustHost: true,
    redirectProxyUrl,
    debug: true,
    // ─── BEHIND-PROXY COOKIE FIX ──────────────────────────────────────────────
    // Problema: Auth.js detecta HTTPS (via x-forwarded-proto) y usa cookies con
    // prefijo __Secure- y flag Secure:true. Pero la conexión proxy→Next.js es HTTP,
    // lo que causa que las cookies de state/pkce no sobrevivan el roundtrip.
    // Solución: Forzar cookies sin prefijo __Secure- y sin flag Secure.
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
        logSSO(undefined, `Auth ERROR: ${error?.message || error}`, { detail: error, cause: cause?.message || cause });
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
        const port = parseInt(host.split(":")[1] || "80");
        const authorizedOrigin = resolveAuthOrigin({
          forwardedHost,
          requestHost,
          forwardedProto: request.headers.get("x-forwarded-proto"),
          connectors,
          settings,
          fallbackAuthUrl: process.env.AUTH_URL,
        });
        const conn = authorizedOrigin.matchedConnector ?? connectors.find(c => c.port === port);
        const connectorId = conn?.id;
        const isLoggedIn = !!auth?.user;
        logSSO(connectorId, `[authorized] path=${nextUrl.pathname} | host=${host} | effectiveHost=${authorizedOrigin.effectiveHost || "(empty)"} | source=${authorizedOrigin.source} | isLoggedIn=${isLoggedIn} | user=${auth?.user?.email || "none"}`);

        if (host.includes(":3000")) { logSSO(connectorId, `[authorized] -> BYPASS (localhost:3000)`); return true; }
        if (conn?.bypassAuth) { logSSO(connectorId, `[authorized] -> BYPASS (connector.bypassAuth=true)`); return true; }
        if (settings.bypassAuth) { logSSO(connectorId, `[authorized] -> BYPASS (bypassAuth=true)`); return true; }

        const isProxyRoute = nextUrl.pathname.startsWith("/proxy") || nextUrl.pathname === "/";

        if (isProxyRoute) {
          if (isLoggedIn) { logSSO(connectorId, `[authorized] -> ALLOW (logged in, proxy route)`); return true; }
          logSSO(connectorId, `[authorized] -> DENY (not logged in, proxy route)`);
          return false;
        }
        logSSO(connectorId, `[authorized] -> ALLOW (non-proxy route)`);
        return true;
      },

      // redirect dentro del scope dinámico para acceder a fullHost y protocol
      async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
        let port = 80;
        try {
          const u = new URL(url.startsWith("/") ? baseUrl : url);
          port = parseInt(u.port || (u.protocol === "https:" ? "443" : "80"));
        } catch {}
        const connectors = await getConnectors();
        const conn = connectors.find(c => c.port === port);
        const connectorId = conn?.id;

        // ── Determinar el host efectivo real para esta redirección ──────────
        // fullHost puede ser vacío (llamadas internas de NextAuth sin req context)
        // o ser localhost:3000 (la semilla del .env.local).
        // En esos casos, intentamos extraer el host real de la propia URL de destino.
        const isLocalOrEmpty = !fullHost || origin.isLocalRequest;
        
        let resolvedHost = fullHost;
        let resolvedProtocol = protocol;

        if (isLocalOrEmpty && url.startsWith("http")) {
          try {
            const urlParsed = new URL(url);
            const urlHost = urlParsed.hostname;
            const notInternal = !urlHost.includes("localhost") && !urlHost.includes("127.0.0.1") && !urlHost.includes("0.0.0.0");
            if (notInternal && !origin.isLocalRequest) {
              resolvedHost = urlParsed.port ? `${urlHost}:${urlParsed.port}` : urlHost;
              resolvedProtocol = urlParsed.protocol.replace(":", "");
              logSSO(connectorId, `[URL-Hint] Extracted real host from redirect URL: ${resolvedHost}`);
            }
          } catch (e) { /* no parseable, continuar */ }
        }

        logSSO(connectorId, `Redirect callback: URL=${url}, BaseURL=${baseUrl}, DynamicHost=${resolvedHost || "(empty)"}`);
        
        // El 'baseUrl' viene del AUTH_URL del .env (localhost:3000 - semilla)
        // Solo es "incorrecto" si tenemos un host alternativo real para sustituirlo
        const baseIsInternal = baseUrl.includes("0.0.0.0") || baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost");
        const canFix = baseIsInternal && resolvedHost && !origin.isLocalRequest;
        const effectiveBase = canFix
          ? `${resolvedProtocol}://${resolvedHost}`
          : baseUrl;

        if (canFix) {
          logSSO(connectorId, `[BaseURL-Fix] Mapping internal base: ${baseUrl} -> ${effectiveBase}`);
        }

        // URL relativa: completar con effectiveBase
        if (url.startsWith("/")) {
          const result = `${effectiveBase}${url}`;
          logSSO(connectorId, `[redirect->RETURN] Relative path resolved: ${result}`);
          return result;
        }

        // URL absoluta apuntando a host interno: reemplazar con resolvedHost
        if (canFix) {
          try {
            const u = new URL(url, effectiveBase);
            const hostIsInternal = u.hostname.includes("localhost") || u.hostname.includes("127.0.0.1") || u.hostname.includes("0.0.0.0");
            if (hostIsInternal && resolvedHost) {
              const fixed = `${resolvedProtocol}://${resolvedHost}${u.pathname}${u.search}`;
              logSSO(connectorId, `[URL-Fix] Rewrote internal URL: ${url} -> ${fixed}`);
              logSSO(connectorId, `[redirect->RETURN] ${fixed}`);
              return fixed;
            }
            logSSO(connectorId, `[redirect->RETURN] URL as-is (non-internal host): ${u.toString()}`);
            return u.toString();
          } catch(e) {
            logSSO(connectorId, `[URL-Error] URL parsing failed for ${url}: ${e}`);
          }
        }

        // Same-domain check
        try {
          const urlObj = new URL(url, effectiveBase);
          const baseObj = new URL(effectiveBase);
          const getDomain = (h: string) => h.split(":")[0].split(".").slice(-2).join(".");
          const urlDomain = getDomain(urlObj.hostname);
          const baseDomain = getDomain(baseObj.hostname);
          logSSO(connectorId, `[same-domain-check] urlDomain=${urlDomain} | baseDomain=${baseDomain}`);
          if (urlDomain === baseDomain) { logSSO(connectorId, `[redirect->RETURN] Same domain, pass-through: ${url}`); return url; }
        } catch (e) { logSSO(connectorId, `[same-domain-check] error: ${e}`); }

        logSSO(connectorId, `[redirect->RETURN] Fallback to effectiveBase: ${effectiveBase}`);
        return effectiveBase;
      },

      async signIn({ user, account }: any) {
        logSSO(undefined, `[signIn] user=${user?.email} | provider=${account?.provider} | type=${account?.type}`);
        return true;
      },
      async jwt({ token, user, account }: any) {
        if (user && account?.provider === "ntlm-login") {
          token.crmUser = (user as any).crmUser;
          token.crmPass = (user as any).crmPass;
          token.crmDomain = (user as any).crmDomain;
          token.crmConnectorId = (user as any).crmConnectorId;
        }
        if (user && account?.provider === "core-ntlm-login") {
          token.coreUser = (user as any).coreUser;
          token.corePass = (user as any).corePass;
          token.coreDomain = (user as any).coreDomain;
          token.coreConnectorId = (user as any).coreConnectorId;
        }
        return token;
      },
      async session({ session, token }: any) {
        if (token.crmUser) {
          (session as any).crmUser = token.crmUser;
          (session as any).crmPass = token.crmPass;
          (session as any).crmDomain = token.crmDomain;
          (session as any).crmConnectorId = token.crmConnectorId;
        }
        if (token.coreUser) {
          (session as any).coreUser = token.coreUser;
          (session as any).corePass = token.corePass;
          (session as any).coreDomain = token.coreDomain;
          (session as any).coreConnectorId = token.coreConnectorId;
        }
        return session;
      },
    },
    // Cookie config: dejamos que Auth.js maneje los defaults automáticamente.
    // Configurar nombres/dominios personalizados interfiere con el state de OAuth.
  };
});
