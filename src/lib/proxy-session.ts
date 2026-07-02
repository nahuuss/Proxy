import { decode } from "@auth/core/jwt";

export const PROXY_SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
];

type DecodeProxySessionToken = (params: {
  token: string;
  secret: string;
  salt: string;
}) => Promise<any | null>;

export type ProxySession = Record<string, unknown> & {
  exp?: number;
};

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  return new Map<string, string>(
    cookieHeader
      .split(";")
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return null;
        return [
          part.slice(0, separator).trim(),
          part.slice(separator + 1).trim(),
        ] as [string, string];
      })
      .filter(Boolean) as [string, string][],
  );
}

export function hasKnownProxySessionCookie(cookieHeader: string): boolean {
  if (!cookieHeader.trim()) return false;
  const cookies = parseCookieHeader(cookieHeader);
  return PROXY_SESSION_COOKIE_NAMES.some((cookieName) => cookies.has(cookieName));
}

export async function verifyProxySession(
  cookieHeader: string,
  input?: {
    secret?: string;
    decodeToken?: DecodeProxySessionToken;
    nowMs?: number;
  },
): Promise<ProxySession | null> {
  const secret = input?.secret ?? process.env.AUTH_SECRET;
  if (!secret) return null;

  const cookies = parseCookieHeader(cookieHeader);
  const nowSeconds = Math.floor((input?.nowMs ?? Date.now()) / 1000);
  const decodeToken = input?.decodeToken ?? decode;

  for (const cookieName of PROXY_SESSION_COOKIE_NAMES) {
    const token = cookies.get(cookieName);
    if (!token) continue;

    try {
      const payload = await decodeToken({
        token,
        secret,
        salt: cookieName,
      });

      if (payload && (payload.exp as number) > nowSeconds) {
        return payload;
      }
    } catch {
      continue;
    }
  }

  return null;
}
