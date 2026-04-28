import http from "http";
import { logHB } from "./logger-hb";

/**
 * REESCRITOR PROFUNDO DE URLS (v1.3.1)
 * Maneja variantes literales, hexadecimales (\x3a) y URL-encoded (%3a)
 * para asegurar que el CRM no escape al proxy en JS dinámico.
 */
export function applyDeepRewrite(body: string, targetUrl: URL, incomingHost: string): string {
  if (!body) return body;
  
  const targetHost = targetUrl.host;      // ej: arbuewvcrmapp50:5555
  const targetHostname = targetUrl.hostname; // ej: arbuewvcrmapp50
  
  const escapedHost = targetHost.replace(/\./g, '\\.');
  const escapedHostname = targetHostname.replace(/\./g, '\\.');
  
  let newBody = body;

  // 1. URLs absolutas (http/https) -> root-relative
  const absolutePattern = (h: string) => new RegExp(`https?:\\\\?\/\\\\?\/` + h + `(:\\d+)?`, 'gi');
  newBody = newBody.replace(absolutePattern(escapedHost), '');
  newBody = newBody.replace(absolutePattern(escapedHostname), '');
  
  // 2. Variantes codificadas en Hex (\x3a, \x2f) comunes en CRM JS
  const hexHost = escapedHost.replace(':', '\\\\x3a');
  const hexHostname = escapedHostname.replace(':', '\\\\x3a');
  newBody = newBody.replace(new RegExp(hexHost, 'gi'), incomingHost);
  newBody = newBody.replace(new RegExp(hexHostname, 'gi'), incomingHost);

  // 3. Variantes codificadas por URL (%3a)
  const urlHost = escapedHost.replace(':', '%3a');
  const urlHostname = escapedHostname.replace(':', '%3a');
  newBody = newBody.replace(new RegExp(urlHost, 'gi'), incomingHost);
  newBody = newBody.replace(new RegExp(urlHostname, 'gi'), incomingHost);

  // 4. Hostname literal sin protocolo
  const portSuffixPattern = targetUrl.port ? `(:${targetUrl.port})?` : '';
  newBody = newBody.replace(new RegExp(escapedHost, 'gi'), incomingHost);
  newBody = newBody.replace(new RegExp(escapedHostname + portSuffixPattern, 'gi'), incomingHost);

  // 5. Soporte para / encodado (%2f)
  const urlEncodedSlashHost = urlHost.replace('\/', '%2f');
  newBody = newBody.replace(new RegExp(urlEncodedSlashHost, 'gi'), incomingHost);

  return newBody;
}

/**
 * Blob Download via JavaScript (patrón del wrapper v48)
 */
export function serveAsBlobDownload(
  res: http.ServerResponse, 
  req: http.IncomingMessage, 
  dataBuffer: Buffer, 
  originalHeaders: http.IncomingHttpHeaders, 
  publicHost: string,
  isHtmlCommentOpen: boolean
) {
  const contentType = (originalHeaders['content-type'] || '').split(';')[0].trim() || 'application/octet-stream';
  let mimeType = contentType;
  if (mimeType === 'application/octet-stream') {
    if (dataBuffer.length > 2 && dataBuffer[0] === 0x50 && dataBuffer[1] === 0x4B)
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (dataBuffer.length > 4 && dataBuffer[0] === 0x25 && dataBuffer[1] === 0x50)
      mimeType = 'application/pdf';
  }

  const dispMatch = ((originalHeaders['content-disposition'] || '') as string).match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const rawFilename = dispMatch ? dispMatch[1].replace(/["']/g, '') : 'archivo.xlsx';
  const filename = rawFilename.replace(/[^\w\s.\-()[\]]/g, '_');
  const safeFilenameJs = JSON.stringify(filename);
  const safeMimeJs = JSON.stringify(mimeType);

  const b64 = dataBuffer.toString('base64');
  const referer = req.headers['referer'] || '';
  const backUrl = JSON.stringify(referer.includes(publicHost) ? referer : '/');

  const closeTag = isHtmlCommentOpen ? '-->' : '';
  const script = `${closeTag}<script>(function(){if(typeof _iv!=="undefined")clearInterval(_iv);if(typeof _piv!=="undefined"){clearInterval(_piv);var pb=document.getElementById("pb");if(pb){pb.style.transition="width 0.3s ease";pb.style.width="100%";}}try{var d=atob('${b64}'),u=new Uint8Array(d.length);for(var i=0;i<d.length;i++)u[i]=d.charCodeAt(i);var bl=new Blob([u],{type:${safeMimeJs}}),url=URL.createObjectURL(bl),a=document.createElement('a');a.href=url;a.download=${safeFilenameJs};document.body.appendChild(a);a.click();document.getElementById('m').innerHTML='<div style="font-size:52px;margin-bottom:16px">&#10004;</div><h3 style="color:#16a34a;font-size:20px;margin-bottom:8px">Descarga iniciada</h3><p class="sub">'+${safeFilenameJs}+'</p><p class="sub" style="margin-top:6px">La descarga comenz\u00F3 en tu navegador.</p><button onclick="window.history.length > 1 ? window.history.back() : window.location.replace(${backUrl})" style="margin-top:24px;padding:10px 28px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">&#8592; Volver</button>';}catch(e){document.getElementById('m').innerHTML='<h3 style="color:#dc2626">Error</h3><p class="sub">'+e.message+'</p>';}})();</script>`;
  
  if (!res.writableEnded) {
    res.write(script);
    res.end();
  }
  
  logHB(`[HB-BLOB] ${Math.round(dataBuffer.length / 1024)}KB via JS Blob: ${filename}`);
}

/**
 * Página de polling para Background Jobs
 */
export function renderBgJobPage(jobId: string): string {
  const safeId = JSON.stringify(jobId);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>BizGuard \u2014 Procesando...</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}.modal{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 8px 32px rgba(0,0,0,.10);text-align:center;min-width:340px;max-width:480px}.spinner{width:52px;height:52px;border:5px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 20px}@keyframes spin{to{transform:rotate(360deg)}}h3{font-size:18px;font-weight:600;color:#1e293b;margin-bottom:8px}.sub{color:#64748b;font-size:14px;margin-bottom:20px}.timer{font-size:36px;font-weight:700;color:#2563eb;font-variant-numeric:tabular-nums;letter-spacing:3px}.tlabel{font-size:11px;color:#94a3b8;margin-top:6px;text-transform:uppercase;letter-spacing:1px}.pbar-wrap{width:100%;background:#e2e8f0;border-radius:99px;height:8px;margin-top:20px;overflow:hidden}.pbar{height:8px;border-radius:99px;background:linear-gradient(90deg,#2563eb,#60a5fa);width:0%;transition:width 0.8s ease}.note{font-size:11px;color:#94a3b8;margin-top:18px;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:14px}.ic-done{width:52px;height:52px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:#fff}.ic-err{width:52px;height:52px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:#fff}</style></head><body><div class="modal" id="m"><div class="spinner" id="ic"></div><h3 id="tt">\u23f3 Procesando archivo...</h3><p class="sub" id="sb">BizGuard ejecuta la operaci\u00f3n en segundo plano.</p><div class="timer" id="t">00:00</div><div class="tlabel">Tiempo transcurrido</div><div class="pbar-wrap"><div class="pbar" id="pb"></div></div><div class="note">BizGuard mantiene la operaci\u00f3n activa aunque la conexi\u00f3n sea interrumpida.<br>No cierre esta ventana hasta ver el resultado.</div></div><script>
var jid=${safeId},_s=0,_p=0,_done=false;
if(window.self!==window.top){try{window.top.location.href=window.location.href;}catch(e){}}
var _iv=setInterval(function(){_s++;var m=Math.floor(_s/60),s=_s%60;document.getElementById('t').textContent=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);_p=_p+(90-_p)*0.004;document.getElementById('pb').style.width=_p.toFixed(1)+'%';},1000);
function poll(){if(_done)return;fetch('/__bizguard_job/'+jid+'/status').then(function(r){return r.json();}).then(function(d){if(d.status==='done'){_done=true;clearInterval(_iv);getResult();}else if(d.status==='error'){_done=true;clearInterval(_iv);showErr(d.error||'Error desconocido');}else{setTimeout(poll,2000);}}).catch(function(){setTimeout(poll,3000);});}
function getResult(){document.getElementById('pb').style.width='100%';fetch('/__bizguard_job/'+jid+'/result').then(function(r){var ct=r.headers.get('content-type')||'';if(ct.includes('json')){r.json().then(function(j){var msg=j.message||j.Message||j.descripcion||j.Descripcion||j.error||j.Error||JSON.stringify(j).substring(0,300);var ok=!j.error&&!j.Error&&r.ok;showDone(ok?'\u2705 Operaci\u00f3n completada':'\u26a0\ufe0f Servidor respondi\u00f3',msg);});}else if(ct.includes('text/html')){r.text().then(function(){showDone('\u2705 Completado','El servidor proces\u00f3 la solicitud correctamente.');});}else{r.blob().then(function(bl){var url=URL.createObjectURL(bl);var a=document.createElement('a');a.href=url;a.download='resultado';a.click();showDone('\u2705 Archivo descargado','La descarga comenz\u00f3 autom\u00e1ticamente.');});}}).catch(function(e){showErr(e.message);});}
function showDone(t,m){document.getElementById('ic').outerHTML='<div class="ic-done" id="ic">\u2713</div>';document.getElementById('tt').textContent=t;document.getElementById('sb').textContent=m;}
function showErr(m){document.getElementById('ic').outerHTML='<div class="ic-err" id="ic">\u2717</div>';document.getElementById('tt').textContent='Error en el servidor';document.getElementById('sb').textContent=m;}
poll();
</script></body></html>`;
}

/**
 * REESCRITOR DE CABECERAS (Location, Set-Cookie)
 */
export function rewriteHeaders(
  headers: http.IncomingHttpHeaders, 
  targetUrl: URL, 
  incomingHost: string
): http.IncomingHttpHeaders {
  const newHeaders = { ...headers };
  const targetHost = targetUrl.host;
  const targetHostname = targetUrl.hostname;

  // 1. Rewrite Location
  if (newHeaders['location']) {
    let loc = newHeaders['location'] as string;
    const patterns = [
      new RegExp(`https?:\\/\\/${targetHost.replace(/\./g, '\\.')}`, 'gi'),
      new RegExp(`https?:\\/\\/${targetHostname.replace(/\./g, '\\.')}`, 'gi')
    ];
    patterns.forEach(p => {
      loc = loc.replace(p, `${targetUrl.protocol}//${incomingHost}`);
    });
    // Reemplazo literal de host si queda alguno
    loc = loc.replace(new RegExp(targetHost.replace(/\./g, '\\.'), 'gi'), incomingHost);
    newHeaders['location'] = loc;
  }

  // 2. Clean Set-Cookie
  if (newHeaders['set-cookie']) {
    const cookies = Array.isArray(newHeaders['set-cookie']) ? newHeaders['set-cookie'] : [newHeaders['set-cookie']];
    newHeaders['set-cookie'] = cookies.map(c => {
      let nc = c.replace(new RegExp(`domain=${targetHostname.replace(/\./g, '\\.')}`, 'gi'), `domain=${incomingHost.split(':')[0]}`);
      nc = nc.replace(/;\s*Secure\b/gi, '').replace(/;\s*SameSite=None\b/gi, '; SameSite=Lax');
      return nc;
    });
  }

  return newHeaders;
}
