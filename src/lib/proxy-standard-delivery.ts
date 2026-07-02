import http from "http";
import type { ProxyHeartbeatState } from "./proxy-heartbeat";

export interface WriteHeartbeatRedirectInput {
  res: http.ServerResponse;
  script: string;
}

export interface WriteStandardProxyResponseInput {
  res: http.ServerResponse;
  heartbeatState: ProxyHeartbeatState;
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
  path: string;
  connectorId: string;
  logHB: (message: string) => void;
  logDebugEntry: (tag: string, extra: string, status?: number | string, elapsedMs?: number) => void;
  elapsedMs: number;
}

const HB_CLEANUP_SCRIPT = `-->
<script id="bg-cleanup-script">
  (function(){
    if (typeof _iv !== 'undefined') clearInterval(_iv);
    var m = document.getElementById("m");
    if (m) m.remove();
    var s = document.getElementById("bg-style");
    if (s) s.remove();
    var self = document.getElementById("bg-cleanup-script");
    if (self) self.remove();
  })();
</script>`;

export function writeHeartbeatRedirectResponse(input: WriteHeartbeatRedirectInput) {
  input.res.write(input.script);
  input.res.end();
}

export function writeStandardProxyResponse(input: WriteStandardProxyResponseInput) {
  if (input.heartbeatState.isHeartbeatActive) {
    if (!input.res.writableEnded) {
      if (input.res.headersSent) {
        if (input.heartbeatState.isHtmlCommentOpen) {
          input.res.write(HB_CLEANUP_SCRIPT);
        }
        input.res.write(input.body);
        input.res.end();
      } else {
        input.logHB(`[HB-SHIELD] TCP-KA completo â€” enviando respuesta normal ${input.path} (${input.connectorId})`);
        input.logDebugEntry("[HB-TCP-KA-DONE]", `body=${input.body.length}B`, input.statusCode, input.elapsedMs);
        input.headers["content-length"] = String(input.body.length);
        input.res.writeHead(input.statusCode, input.headers);
        input.res.end(input.body);
      }
    }
    return;
  }

  if (!input.res.headersSent) {
    input.headers["content-length"] = String(input.body.length);
    input.res.writeHead(input.statusCode, input.headers);
    input.res.end(input.body);
  }
}
