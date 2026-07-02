import http from "http";
import { Connector } from "../connectors";
import { ProductBehaviorConfig, ProductExecutionMode } from "../product-schema";

export interface RequestContext {
  req: http.IncomingMessage;
  connector: Connector;
  urlPart: string;
  path: string;
  isStatic: boolean;
  isImage: boolean;
  isPostLike: boolean;
  isAjax: boolean;
  isMultipartUpload: boolean;
  hasForcedHeartbeatPath: boolean;
  productConfig: ProductBehaviorConfig;
}

export interface ConnectorRules {
  /**
   * Determina si una petición es elegible para el Heartbeat Shield
   */
  isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean;

  /**
   * Define la estrategia de ejecucion del request para el producto actual.
   */
  resolveExecutionMode(ctx: RequestContext): ProductExecutionMode;

  /**
   * Aplica transformaciones al cuerpo de la respuesta (texto)
   */
  rewriteBody(body: string): string;

  /**
   * Genera el script de redirección si el HB estuvo activo y hubo un 3xx
   */
  getRedirectScript(location: string, isHtmlCommentOpen: boolean): string;
}

export abstract class BaseRules implements ConnectorRules {
  abstract isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean;
  abstract resolveExecutionMode(ctx: RequestContext): ProductExecutionMode;

  protected isForcedBackgroundJob(ctx: RequestContext): boolean {
    return ctx.hasForcedHeartbeatPath && ctx.isPostLike;
  }

  protected hasConfiguredBackgroundJobPath(ctx: RequestContext): boolean {
    return (ctx.productConfig.backgroundJobPaths || []).some((candidate) => ctx.urlPart.startsWith(candidate));
  }

  protected hasConfiguredXhrKeepAlivePath(ctx: RequestContext): boolean {
    return (ctx.productConfig.xhrKeepAlivePaths || []).some((candidate) => ctx.urlPart.startsWith(candidate));
  }

  protected hasConfiguredPassiveHtmlPath(ctx: RequestContext): boolean {
    return (ctx.productConfig.passiveHtmlPaths || []).some((candidate) => ctx.urlPart.startsWith(candidate));
  }

  protected isLoginHintPath(ctx: RequestContext): boolean {
    return (ctx.productConfig.loginPathHints || []).some((hint) => ctx.urlPart.includes(hint.toLowerCase()));
  }

  protected resolveForcedExecutionMode(ctx: RequestContext): ProductExecutionMode {
    if (!ctx.hasForcedHeartbeatPath) return "none";
    if (ctx.isAjax) return "xhr-keepalive";
    if (ctx.isPostLike) return "background-job";
    return "passive-html";
  }
  rewriteBody(body: string): string {
    return body; // Por defecto no hace nada
  }

  getRedirectScript(location: string, isHtmlCommentOpen: boolean): string {
    const closeTag = isHtmlCommentOpen ? '-->' : '';
    return `<html><body><script>window.location.href=${JSON.stringify(location)};</script></body></html>`.replace(/^/, closeTag);
  }
}
