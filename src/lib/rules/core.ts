import http from "http";
import { BaseRules, RequestContext } from "./base";
import { ProductExecutionMode } from "../product-catalog";

export class CoreRules extends BaseRules {
  isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean {
    const isXhr = !!req.headers['x-requested-with'] || 
                  req.headers['accept']?.includes('json') || 
                  req.headers['content-type']?.includes('multipart/form-data');
    
    // Core permite HB en POST y XHR (especialmente para subidas largas)
    const isPostLike = req.method !== 'GET' && req.method !== 'HEAD';
    
    return !isStatic && !isImage && (isPostLike || !isXhr);
  }

  resolveExecutionMode(ctx: RequestContext): ProductExecutionMode {
    if (ctx.hasForcedHeartbeatPath) return this.resolveForcedExecutionMode(ctx);
    if (this.hasConfiguredBackgroundJobPath(ctx)) return "background-job";
    if (ctx.isMultipartUpload && ctx.productConfig.backgroundJobForMultipart) return "background-job";
    if (ctx.isAjax && (ctx.productConfig.xhrKeepAliveForAjax || this.hasConfiguredXhrKeepAlivePath(ctx))) return "xhr-keepalive";
    if (ctx.isPostLike) return "background-job";
    if (!this.isHbEligible(ctx.req, ctx.urlPart, ctx.isStatic, ctx.isImage)) return "none";
    return "passive-html";
  }

  // Core usa el redirect script base pero podríamos personalizarlo aquí si fuera necesario
  override rewriteBody(body: string): string {
    return body;
  }
}
