export function normalizeDynamicsCrmEntryPath(entryPath?: string) {
  if (!entryPath) return "/";
  const trimmed = entryPath.trim();
  if (!trimmed) return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

function hasFileSegment(pathname: string) {
  const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
  return lastSegment.includes(".");
}

export function resolveDynamicsCrmMainPath(entryPath?: string) {
  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  if (hasFileSegment(normalizedEntryPath)) return normalizedEntryPath;
  return normalizedEntryPath === "/" ? "/main.aspx" : `${normalizedEntryPath}/main.aspx`;
}

export function buildDynamicsCrmEntryUrl(targetUrl: string, entryPath?: string) {
  const baseUrl = targetUrl.replace(/\/$/, "");
  return `${baseUrl}${resolveDynamicsCrmMainPath(entryPath)}`;
}

export function normalizeDynamicsCrmProxyPath(requestUrl: string, entryPath?: string) {
  const url = new URL(requestUrl || "/", "http://bizguard.local");
  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  const normalizedEntryPathWithSlash = normalizedEntryPath === "/" ? "/" : `${normalizedEntryPath}/`;

  if (url.pathname === normalizedEntryPath || url.pathname === normalizedEntryPathWithSlash) {
    url.pathname = resolveDynamicsCrmMainPath(entryPath);
  }

  return `${url.pathname}${url.search}`;
}

function getPublicPort(incomingHost: string, proto: string) {
  const explicitPort = incomingHost.split(":")[1];
  if (explicitPort) return explicitPort;
  return proto === "https" ? "443" : "80";
}

function encodeCrmJsUrl(url: string) {
  return url
    .replace(/:/g, "\\x3a")
    .replace(/\//g, "\\x2f");
}

function buildDynamicsCrmLookupShim(publicServerUrl: string) {
  const safeServerUrl = JSON.stringify(publicServerUrl);
  return `<script id="bizguard-dynamics-crm-lookup-shim">(function(){if(window.__bizguardDynamicsLookupShimInstalled)return;window.__bizguardDynamicsLookupShimInstalled=true;var serverUrl=${safeServerUrl};function sanitizeGuid(value){return String(value||"").replace(/[{}]/g,"").trim();}function getRecordUrl(anchor){if(!anchor||!anchor.matches||!anchor.matches("a.ms-crm-List-Link"))return null;var lookupNode=anchor.querySelector(".gridLui[oid][otype]");if(!lookupNode)return null;var oid=sanitizeGuid(lookupNode.getAttribute("oid"));var otype=String(lookupNode.getAttribute("otype")||"").trim();if(!oid||!otype)return null;var extraqs="?etc="+encodeURIComponent(otype)+"&id="+encodeURIComponent("{"+oid+"}");return serverUrl+"/main.aspx?etc="+encodeURIComponent(otype)+"&extraqs="+encodeURIComponent(extraqs)+"&pagemode=iframe&pagetype=entityrecord";}function navigateFromEvent(event){var target=event.target;if(!(target instanceof Element))return;var anchor=target.closest("a.ms-crm-List-Link");var recordUrl=getRecordUrl(anchor);if(!recordUrl)return;event.preventDefault();event.stopPropagation();window.location.assign(recordUrl);}document.addEventListener("click",navigateFromEvent,true);document.addEventListener("keydown",function(event){if(event.key!=="Enter"&&event.key!==" ")return;navigateFromEvent(event);},true);})();</script>`;
}

function looksLikeDynamicsCrmHtmlDocument(body: string) {
  const leadingSlice = body.slice(0, 1024);
  return /^\s*(<!doctype html|<html\b)/i.test(leadingSlice);
}

function looksLikeDynamicsCrmLookupGrid(body: string) {
  return /handleLookupAnchorClick|ms-crm-List-Link|class="gridLui"|class='gridLui'/i.test(body);
}

function injectDynamicsCrmLookupShim(body: string, publicServerUrl: string) {
  if (!body || body.includes("bizguard-dynamics-crm-lookup-shim")) return body;
  if (!looksLikeDynamicsCrmHtmlDocument(body)) return body;
  if (!looksLikeDynamicsCrmLookupGrid(body)) return body;
  const shim = buildDynamicsCrmLookupShim(publicServerUrl);
  if (/<\/body>/i.test(body)) {
    return body.replace(/<\/body>/i, `${shim}</body>`);
  }
  return `${body}${shim}`;
}

export function rewriteDynamicsCrmClientConfig(body: string, incomingHost: string, proto: string, entryPath?: string) {
  if (!body) return body;

  const normalizedEntryPath = normalizeDynamicsCrmEntryPath(entryPath);
  const pathSuffix = normalizedEntryPath === "/" ? "" : normalizedEntryPath;
  const publicServerUrl = `${proto}://${incomingHost}${pathSuffix}`;
  const publicServerUrlJs = encodeCrmJsUrl(publicServerUrl);
  const hostOnly = incomingHost.split(":")[0];
  const publicPort = getPublicPort(incomingHost, proto);

  let rewritten = body;
  rewritten = rewritten.replace(/var\s+SERVER_URL\s*=\s*'[^']*';/gi, `var SERVER_URL = '${publicServerUrlJs}';`);
  rewritten = rewritten.replace(/var\s+WEB_SERVER_HOST\s*=\s*'[^']*';/gi, `var WEB_SERVER_HOST = '${hostOnly}';`);
  rewritten = rewritten.replace(/var\s+WEB_SERVER_PORT\s*=\s*[^;]+;/gi, `var WEB_SERVER_PORT = ${publicPort};`);
  rewritten = injectDynamicsCrmLookupShim(rewritten, publicServerUrl);

  return rewritten;
}
