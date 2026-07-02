function buildDynamicsCrmLookupShim(publicServerUrl: string): string {
  const safeServerUrl = JSON.stringify(publicServerUrl);
  return `<script id="bizguard-dynamics-crm-lookup-shim">(function(){if(window.__bizguardDynamicsLookupShimInstalled)return;window.__bizguardDynamicsLookupShimInstalled=true;var serverUrl=${safeServerUrl};function sanitizeGuid(value){return String(value||"").replace(/[{}]/g,"").trim();}function getRecordUrl(anchor){if(!anchor||!anchor.matches||!anchor.matches("a.ms-crm-List-Link"))return null;var lookupNode=anchor.querySelector(".gridLui[oid][otype]");if(!lookupNode)return null;var oid=sanitizeGuid(lookupNode.getAttribute("oid"));var otype=String(lookupNode.getAttribute("otype")||"").trim();if(!oid||!otype)return null;var extraqs="?etc="+encodeURIComponent(otype)+"&id="+encodeURIComponent("{"+oid+"}");return serverUrl+"/main.aspx?etc="+encodeURIComponent(otype)+"&extraqs="+encodeURIComponent(extraqs)+"&pagemode=iframe&pagetype=entityrecord";}function navigateFromEvent(event){var target=event.target;if(!(target instanceof Element))return;var anchor=target.closest("a.ms-crm-List-Link");var recordUrl=getRecordUrl(anchor);if(!recordUrl)return;event.preventDefault();event.stopPropagation();window.location.assign(recordUrl);}document.addEventListener("click",navigateFromEvent,true);document.addEventListener("keydown",function(event){if(event.key!=="Enter"&&event.key!==" ")return;navigateFromEvent(event);},true);})();</script>`;
}

function looksLikeDynamicsCrmHtmlDocument(body: string): boolean {
  const leadingSlice = body.slice(0, 1024);
  return /^\s*(<!doctype html|<html\b)/i.test(leadingSlice);
}

function looksLikeDynamicsCrmLookupGrid(body: string): boolean {
  return /handleLookupAnchorClick|ms-crm-List-Link|class="gridLui"|class='gridLui'/i.test(body);
}

export function injectDynamicsCrmLookupShim(body: string, publicServerUrl: string): string {
  if (!body || body.includes('bizguard-dynamics-crm-lookup-shim')) return body;
  if (!looksLikeDynamicsCrmHtmlDocument(body)) return body;
  if (!looksLikeDynamicsCrmLookupGrid(body)) return body;
  const shim = buildDynamicsCrmLookupShim(publicServerUrl);
  if (/<\/body>/i.test(body)) {
    return body.replace(/<\/body>/i, `${shim}</body>`);
  }
  return `${body}${shim}`;
}
