import http from "http";
import { logHB } from "./logger-hb";

/**
 * Blob Download via JavaScript (patron del wrapper v48)
 */
export function serveAsBlobDownload(
  res: http.ServerResponse,
  req: http.IncomingMessage,
  dataBuffer: Buffer,
  originalHeaders: http.IncomingHttpHeaders,
  publicHost: string,
  isHtmlCommentOpen: boolean,
  connectorId?: string,
) {
  const contentType = (originalHeaders["content-type"] || "").split(";")[0].trim() || "application/octet-stream";
  let mimeType = contentType;
  if (mimeType === "application/octet-stream") {
    const firstKB = dataBuffer.subarray(0, 2048);
    if (firstKB.indexOf(Buffer.from([0x50, 0x4b])) !== -1) {
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (firstKB.indexOf(Buffer.from([0x25, 0x50, 0x44, 0x46])) !== -1) {
      mimeType = "application/pdf";
    } else if (firstKB.indexOf(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])) !== -1) {
      mimeType = "application/vnd.ms-excel";
    }
  }

  const dispMatch = ((originalHeaders["content-disposition"] || "") as string)
    .match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const rawFilename = dispMatch ? dispMatch[1].replace(/["']/g, "") : "archivo.xlsx";
  const filename = rawFilename.replace(/[^\w\s.\-()[\]]/g, "_");
  const safeFilenameJs = JSON.stringify(filename);
  const safeMimeJs = JSON.stringify(mimeType);

  const b64 = dataBuffer.toString("base64");
  const referer = req.headers.referer || "";
  const backUrl = JSON.stringify(referer.includes(publicHost) ? referer : "/");

  const closeTag = isHtmlCommentOpen ? "-->" : "";
  const script = `${closeTag}<script>(function(){var bu=${backUrl};if(typeof _iv!=="undefined")clearInterval(_iv);if(typeof _piv!=="undefined"){clearInterval(_piv);var pb=document.getElementById("pb");if(pb){pb.style.transition="width 0.3s ease";pb.style.width="100%";}}try{var d=atob('${b64}'),u=new Uint8Array(d.length);for(var i=0;i<d.length;i++)u[i]=d.charCodeAt(i);var bl=new Blob([u],{type:${safeMimeJs}}),url=URL.createObjectURL(bl),a=document.createElement('a');a.href=url;a.download=${safeFilenameJs};document.body.appendChild(a);a.click();document.getElementById('m').innerHTML='<div style="font-size:52px;margin-bottom:16px">&#10004;</div><h3 style="color:#16a34a;font-size:20px;margin-bottom:8px">Descarga iniciada</h3><p class="sub">'+${safeFilenameJs}+'</p><p class="sub" style="margin-top:6px">La descarga comenz\u00F3 en tu navegador.</p><button onclick="window.history.length > 1 ? window.history.back() : window.location.replace(bu)" style="margin-top:24px;padding:10px 28px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">&#8592; Volver</button>';}catch(e){document.getElementById('m').innerHTML='<h3 style="color:#dc2626">Error</h3><p class="sub">'+e.message+'</p>';}})();</script>`;

  if (!res.writableEnded) {
    res.write(script);
    res.end();
  }

  logHB(connectorId, `[HB-BLOB] ${Math.round(dataBuffer.length / 1024)}KB via JS Blob: ${filename}`);
}
