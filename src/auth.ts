import NextAuth from "next-auth";
import { skipCSRFCheck } from "@auth/core";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { getSettings } from "./lib/settings";
import { logSSO } from "./lib/logger-sso";
import { getConnectors } from "./lib/connectors";

// Exportar como función dinámica para soportar múltiples hosts
export const { handlers, auth, signIn, signOut } = NextAuth(async (req) => {
  const xHost = req?.headers.get("x-forwarded-host");
  const hHost = req?.headers.get("host");
  let fullHost = xHost || hHost || "";

  // ─── PRIORIZACIÓN POR CONECTOR ──────────────────────────────────────────────
  // Si la petición viene por un puerto que coincide con un conector configurado
  // usamos preferentemente su 'publicHost'.
  const connectors = await getConnectors();
  const incomingPort = parseInt(fullHost.split(":")[1] || "80");
  const matchingConnector = connectors.find(c => c.port === incomingPort);

  if (matchingConnector && matchingConnector.publicHost) {
    const oldHost = fullHost;
    // Si el conector tiene un host público, lo usamos como base.
    // Si el puerto no es estándar (80/443), lo mantenemos.
    const cleanHost = matchingConnector.publicHost.split(":")[0];
    fullHost = incomingPort !== 80 && incomingPort !== 443 
      ? `${cleanHost}:${incomingPort}` 
      : cleanHost;
    
    logSSO(`[Connector-Match] Port ${incomingPort} matched connector "${matchingConnector.id}". Host: ${oldHost} -> ${fullHost}`);
  } else if (!fullHost) {
    // Si el host sigue vacío (ej: req sin headers), fallback a settings globales
    const settings = await getSettings();
    if (settings.publicHost) {
      fullHost = settings.publicHost;
      logSSO(`[Global-Settings-Match] Host was empty. Using fallback: ${fullHost}`);
    } else {
      const headerDump: Record<string, string> = {};
      req?.headers.forEach((v, k) => { headerDump[k] = v; });
      logSSO(`[Dynamic-Fallback] Host still empty for URL: ${req?.url}`, { headers: headerDump });
    }
  } else {
    logSSO(`[Dynamic-Header] No connector match for port ${incomingPort}. Using detect: host=${fullHost}`);
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const hostOnly = fullHost.split(":")[0];
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

  const protocol = (fullHost.includes("localhost") || fullHost.includes("127.0.0.1")) ? "http" : "https";
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
        domain: { label: "Domain", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const username = credentials.username as string;
        const password = credentials.password as string;
        const domain = (credentials.domain as string) || "SERENASEGUROS";

        // Validar credenciales contra el CRM real antes de crear sesión
        const { getConnectors } = await import("./lib/connectors");
        const httpntlm = await import("httpntlm");
        const connectors = await getConnectors();
        const ntlmConnector = connectors.find(c => c.isNtlm && c.isActive);
        if (!ntlmConnector) return null;

        try {
          // Usar entryPath si está configurado (ej: /Inicio/ o /SERENAART/).
          // La raíz / puede devolver 404 o redirect en algunos CRM — no es indicador fiable.
          const baseUrl = ntlmConnector.targetUrl.replace(/\/$/, '');
          const testPath = ntlmConnector.entryPath ? ntlmConnector.entryPath.replace(/^\//, '') : '';
          const testUrl = `${baseUrl}/${testPath}`;
          const valid = await new Promise<boolean>((resolve) => {
            httpntlm.get({
              username, password, domain, workstation: '',
              url: testUrl,
            }, (err: any, res: any) => {
              if (err) { resolve(false); return; }
              // 401 = credenciales incorrectas. 200/302/404/500 = servidor respondió = credenciales OK
              resolve(res.statusCode !== 401);
            });
          });
          if (!valid) return null;
        } catch { return null; }

        return {
          id: username,
          email: `${username}@${domain}`,
          name: username,
          crmUser: username,
          crmPass: password,
          crmDomain: domain,
        };
      }
    })
  ].filter(Boolean) as any[];

  // redirectProxyUrl tells auth.js to use the public host for BOTH the
  // authorization redirect_uri AND the token exchange redirect_uri.
  // Without it, the token exchange uses the internal server URL (0.0.0.0:3000)
  // which doesn't match Azure AD's registered redirect URI → OAuthCallbackError.
  const redirectProxyUrl = fullHost ? `${protocol}://${fullHost}/api/auth` : process.env.AUTH_URL ? `${process.env.AUTH_URL}/api/auth` : undefined;

  logSSO(`[INIT] fullHost=${fullHost || "(empty)"} | cookieDomain=${cookieDomain || "(none)"} | protocol=${protocol}`);
  logSSO(`[INIT] redirectProxyUrl=${redirectProxyUrl || "(undefined)"} | dynamicCallbackUrl=${dynamicCallbackUrl || "(undefined)"}`);

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
        logSSO(`Auth ERROR: ${error?.message || error}`, { detail: error, cause: cause?.message || cause });
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
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
        const isLoggedIn = !!auth?.user;
        logSSO(`[authorized] path=${nextUrl.pathname} | host=${host} | isLoggedIn=${isLoggedIn} | user=${auth?.user?.email || "none"}`);

        if (host.includes(":3000")) { logSSO(`[authorized] -> BYPASS (localhost:3000)`); return true; }

        const settings = await getSettings();
        if (settings.bypassAuth) { logSSO(`[authorized] -> BYPASS (bypassAuth=true)`); return true; }

        const isProxyRoute = nextUrl.pathname.startsWith("/proxy") || nextUrl.pathname === "/";

        if (isProxyRoute) {
          if (isLoggedIn) { logSSO(`[authorized] -> ALLOW (logged in, proxy route)`); return true; }
          logSSO(`[authorized] -> DENY (not logged in, proxy route)`);
          return false;
        }
        logSSO(`[authorized] -> ALLOW (non-proxy route)`);
        return true;
      },

      // redirect dentro del scope dinámico para acceder a fullHost y protocol
      async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
        // ── Determinar el host efectivo real para esta redirección ──────────
        // fullHost puede ser vacío (llamadas internas de NextAuth sin req context)
        // o ser localhost:3000 (la semilla del .env.local).
        // En esos casos, intentamos extraer el host real de la propia URL de destino.
        const isLocalOrEmpty = !fullHost || fullHost.includes("localhost") || fullHost.includes("127.0.0.1") || fullHost.includes("0.0.0.0");
        
        let resolvedHost = fullHost;
        let resolvedProtocol = protocol;

        if (isLocalOrEmpty && url.startsWith("http")) {
          try {
            const urlParsed = new URL(url);
            const urlHost = urlParsed.hostname;
            const notInternal = !urlHost.includes("localhost") && !urlHost.includes("127.0.0.1") && !urlHost.includes("0.0.0.0");
            if (notInternal) {
              resolvedHost = urlParsed.port ? `${urlHost}:${urlParsed.port}` : urlHost;
              resolvedProtocol = urlParsed.protocol.replace(":", "");
              logSSO(`[URL-Hint] Extracted real host from redirect URL: ${resolvedHost}`);
            }
          } catch (e) { /* no parseable, continuar */ }
        }

        logSSO(`Redirect callback: URL=${url}, BaseURL=${baseUrl}, DynamicHost=${resolvedHost || "(empty)"}`);
        
        // El 'baseUrl' viene del AUTH_URL del .env (localhost:3000 - semilla)
        // Solo es "incorrecto" si tenemos un host alternativo real para sustituirlo
        const baseIsInternal = baseUrl.includes("0.0.0.0") || baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost");
        const canFix = baseIsInternal && resolvedHost && !resolvedHost.includes("localhost");
        const effectiveBase = canFix
          ? `${resolvedProtocol}://${resolvedHost}`
          : baseUrl;

        if (canFix) {
          logSSO(`[BaseURL-Fix] Mapping internal base: ${baseUrl} -> ${effectiveBase}`);
        }

        // URL relativa: completar con effectiveBase
        if (url.startsWith("/")) {
          const result = `${effectiveBase}${url}`;
          logSSO(`[redirect->RETURN] Relative path resolved: ${result}`);
          return result;
        }

        // URL absoluta apuntando a host interno: reemplazar con resolvedHost
        if (canFix) {
          try {
            const u = new URL(url, effectiveBase);
            const hostIsInternal = u.hostname.includes("localhost") || u.hostname.includes("127.0.0.1") || u.hostname.includes("0.0.0.0");
            if (hostIsInternal && resolvedHost) {
              const fixed = `${resolvedProtocol}://${resolvedHost}${u.pathname}${u.search}`;
              logSSO(`[URL-Fix] Rewrote internal URL: ${url} -> ${fixed}`);
              logSSO(`[redirect->RETURN] ${fixed}`);
              return fixed;
            }
            logSSO(`[redirect->RETURN] URL as-is (non-internal host): ${u.toString()}`);
            return u.toString();
          } catch(e) {
            logSSO(`[URL-Error] URL parsing failed for ${url}: ${e}`);
          }
        }

        // Same-domain check
        try {
          const urlObj = new URL(url, effectiveBase);
          const baseObj = new URL(effectiveBase);
          const getDomain = (h: string) => h.split(":")[0].split(".").slice(-2).join(".");
          const urlDomain = getDomain(urlObj.hostname);
          const baseDomain = getDomain(baseObj.hostname);
          logSSO(`[same-domain-check] urlDomain=${urlDomain} | baseDomain=${baseDomain}`);
          if (urlDomain === baseDomain) { logSSO(`[redirect->RETURN] Same domain, pass-through: ${url}`); return url; }
        } catch (e) { logSSO(`[same-domain-check] error: ${e}`); }

        logSSO(`[redirect->RETURN] Fallback to effectiveBase: ${effectiveBase}`);
        return effectiveBase;
      },

      async signIn({ user, account }: any) {
        logSSO(`[signIn] user=${user?.email} | provider=${account?.provider} | type=${account?.type}`);
        return true;
      },
      async jwt({ token, user, account }: any) {
        if (user && account?.provider === "ntlm-login") {
          token.crmUser = (user as any).crmUser;
          token.crmPass = (user as any).crmPass;
          token.crmDomain = (user as any).crmDomain;
        }
        return token;
      },
      async session({ session, token }: any) {
        if (token.crmUser) {
          (session as any).crmUser = token.crmUser;
          (session as any).crmPass = token.crmPass;
          (session as any).crmDomain = token.crmDomain;
        }
        return session;
      },
    },
    // Cookie config: dejamos que Auth.js maneje los defaults automáticamente.
    // Configurar nombres/dominios personalizados interfiere con el state de OAuth.
  };
});
