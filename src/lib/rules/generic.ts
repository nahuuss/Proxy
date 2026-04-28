import http from "http";
import { BaseRules } from "./base";

export class GenericRules extends BaseRules {
  isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean {
    const isXhr = !!req.headers['x-requested-with'] || req.headers['accept']?.includes('json');
    const isPostLike = req.method !== 'GET' && req.method !== 'HEAD';
    
    // Comportamiento por defecto: HB solo para navegación GET
    return !isStatic && !isImage && !isPostLike && !isXhr;
  }
}

export class CrmRules extends GenericRules {
  // Dynamics CRM suele usar NTLM, pero las reglas de HB son similares a las genéricas
}
