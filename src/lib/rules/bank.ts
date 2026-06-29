import http from "http";
import { BaseRules, RequestContext } from "./base";
import { ProductExecutionMode } from "../product-catalog";

function isBankLongUploadRequest(req: http.IncomingMessage, urlPart: string): boolean {
  const normalizedPath = urlPart.toLowerCase();
  const isPostLike = req.method !== "GET" && req.method !== "HEAD";
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  const isMultipartUpload = contentType.includes("multipart/form-data");
  const isCobranzaUpload =
    normalizedPath.includes("/cobranzaautomatica/uploadandprocess") ||
    normalizedPath.includes("/cobranzaautomatica/uploadandprocessmutual");

  return isPostLike && isMultipartUpload && isCobranzaUpload;
}

export class BankRules extends BaseRules {
  isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean {
    const isXhr = !!req.headers["x-requested-with"] || req.headers["accept"]?.includes("json");
    const isPostLike = req.method !== "GET" && req.method !== "HEAD";

    if (!isStatic && !isImage && isBankLongUploadRequest(req, urlPart)) {
      return true;
    }

    // Bank usa HB solo para navegacion GET estandar,
    // salvo uploads largos conocidos que quedan expuestos al 524.
    return !isStatic && !isImage && !isPostLike && !isXhr;
  }

  rewriteBody(body: string): string {
    // Corrige el error comun en el frontend de Bank donde se usa type: "Json" en lugar de POST
    return body.replace(/(^|\W)type\s*:\s*['"]Json['"]/gi, '$1type: "POST", dataType: "json"');
  }

  resolveExecutionMode(ctx: RequestContext): ProductExecutionMode {
    if (this.isForcedBackgroundJob(ctx) || this.hasConfiguredBackgroundJobPath(ctx) || isBankLongUploadRequest(ctx.req, ctx.urlPart)) {
      return "background-job";
    }
    if (ctx.hasForcedHeartbeatPath) return this.resolveForcedExecutionMode(ctx);
    if (!this.isHbEligible(ctx.req, ctx.urlPart, ctx.isStatic, ctx.isImage)) return "none";
    return "passive-html";
  }
}
