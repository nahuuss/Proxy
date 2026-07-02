import http from "http";

/**
 * REESCRITOR DE CABECERAS (Location, Set-Cookie)
 */
export function rewriteHeaders(
  headers: http.IncomingHttpHeaders,
  targetUrl: URL,
  incomingHost: string,
): http.IncomingHttpHeaders {
  const newHeaders = { ...headers };
  const targetHost = targetUrl.host;
  const targetHostname = targetUrl.hostname;

  if (newHeaders.location) {
    let location = newHeaders.location as string;
    const patterns = [
      new RegExp(`https?:\\/\\/${targetHost.replace(/\./g, "\\.")}`, "gi"),
      new RegExp(`https?:\\/\\/${targetHostname.replace(/\./g, "\\.")}`, "gi"),
    ];
    patterns.forEach((pattern) => {
      location = location.replace(pattern, `${targetUrl.protocol}//${incomingHost}`);
    });
    location = location.replace(new RegExp(targetHost.replace(/\./g, "\\."), "gi"), incomingHost);
    newHeaders.location = location;
  }

  if (newHeaders["set-cookie"]) {
    const cookies = Array.isArray(newHeaders["set-cookie"])
      ? newHeaders["set-cookie"]
      : [newHeaders["set-cookie"]];
    newHeaders["set-cookie"] = cookies.map((cookie) => {
      let normalizedCookie = cookie.replace(
        new RegExp(`domain=${targetHostname.replace(/\./g, "\\.")}`, "gi"),
        `domain=${incomingHost.split(":")[0]}`,
      );
      normalizedCookie = normalizedCookie
        .replace(/;\s*Secure\b/gi, "")
        .replace(/;\s*SameSite=None\b/gi, "; SameSite=Lax");
      return normalizedCookie;
    });
  }

  return newHeaders;
}
