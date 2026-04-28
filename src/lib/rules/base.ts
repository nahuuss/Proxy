import http from "http";

export interface ConnectorRules {
  /**
   * Determina si una petición es elegible para el Heartbeat Shield
   */
  isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean;

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
  
  rewriteBody(body: string): string {
    return body; // Por defecto no hace nada
  }

  getRedirectScript(location: string, isHtmlCommentOpen: boolean): string {
    const closeTag = isHtmlCommentOpen ? '-->' : '';
    return `<html><body><script>window.location.href=${JSON.stringify(location)};</script></body></html>`.replace(/^/, closeTag);
  }
}
