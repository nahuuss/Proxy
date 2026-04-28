import http from "http";
import { BaseRules } from "./base";

export class CoreRules extends BaseRules {
  isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean {
    const isXhr = !!req.headers['x-requested-with'] || 
                  req.headers['accept']?.includes('json') || 
                  req.headers['content-type']?.includes('multipart/form-data');
    
    // Core permite HB en POST y XHR (especialmente para subidas largas)
    const isPostLike = req.method !== 'GET' && req.method !== 'HEAD';
    
    return !isStatic && !isImage && (isPostLike || !isXhr);
  }

  // Core usa el redirect script base pero podríamos personalizarlo aquí si fuera necesario
}
