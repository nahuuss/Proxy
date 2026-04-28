import http from "http";
import { BaseRules } from "./base";

export class BankRules extends BaseRules {
  isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean {
    const isXhr = !!req.headers['x-requested-with'] || req.headers['accept']?.includes('json');
    const isPostLike = req.method !== 'GET' && req.method !== 'HEAD';
    
    // Bank solo usa HB para navegación GET estándar
    return !isStatic && !isImage && !isPostLike && !isXhr;
  }

  rewriteBody(body: string): string {
    // Corrige el error común en el frontend de Bank donde se usa type: "Json" en lugar de POST
    return body.replace(/(^|\W)type\s*:\s*['"]Json['"]/gi, '$1type: "POST", dataType: "json"');
  }
}
