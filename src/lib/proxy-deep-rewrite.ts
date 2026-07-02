/**
 * REESCRITOR PROFUNDO DE URLS (v1.3.1)
 * Maneja variantes literales, hexadecimales (\x3a) y URL-encoded (%3a)
 * para asegurar que el CRM no escape al proxy en JS dinamico.
 */
export function applyDeepRewrite(body: string, targetUrl: URL, incomingHost: string): string {
  if (!body) return body;

  const targetHost = targetUrl.host;
  const targetHostname = targetUrl.hostname;

  const escapedHost = targetHost.replace(/\./g, "\\.");
  const escapedHostname = targetHostname.replace(/\./g, "\\.");

  let newBody = body;

  const absolutePattern = (host: string) => new RegExp(`https?:\\\\?\/\\\\?\/${host}(:\\d+)?`, "gi");
  newBody = newBody.replace(absolutePattern(escapedHost), "");
  newBody = newBody.replace(absolutePattern(escapedHostname), "");

  const hexHost = escapedHost.replace(":", "\\\\x3a");
  const hexHostname = escapedHostname.replace(":", "\\\\x3a");
  newBody = newBody.replace(new RegExp(hexHost, "gi"), incomingHost);
  newBody = newBody.replace(new RegExp(hexHostname, "gi"), incomingHost);

  const urlHost = escapedHost.replace(":", "%3a");
  const urlHostname = escapedHostname.replace(":", "%3a");
  newBody = newBody.replace(new RegExp(urlHost, "gi"), incomingHost);
  newBody = newBody.replace(new RegExp(urlHostname, "gi"), incomingHost);

  const portSuffixPattern = targetUrl.port ? `(:${targetUrl.port})?` : "";
  newBody = newBody.replace(new RegExp(escapedHost, "gi"), incomingHost);
  newBody = newBody.replace(new RegExp(escapedHostname + portSuffixPattern, "gi"), incomingHost);

  const urlEncodedSlashHost = urlHost.replace("/", "%2f");
  newBody = newBody.replace(new RegExp(urlEncodedSlashHost, "gi"), incomingHost);

  return newBody;
}
