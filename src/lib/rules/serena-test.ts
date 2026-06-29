import http from "http";
import { BaseRules, RequestContext } from "./base";
import { ProductExecutionMode } from "../product-catalog";

/**
 * SerenaTestRules: Entorno de Staging y Pruebas Custom.
 * Hereda la lógica de Core para soportar subidas pesadas y Heartbeat Shield,
 * permitiendo inyectar customizaciones experimentales sin afectar producción.
 */
export class SerenaTestRules extends BaseRules {
  isHbEligible(req: http.IncomingMessage, urlPart: string, isStatic: boolean, isImage: boolean): boolean {
    // 1. Detectar AJAX Delta de Microsoft/Telerik (común en DNN)
    // Estos requests esperan un formato estricto y el Heartbeat los rompe.
    const isAjaxDelta = req.headers['x-microsoftajax']?.includes('delta=true') || 
                        req.headers['x-requested-with'] === 'XMLHttpRequest' && (req.headers['accept']?.includes('text/plain') || req.headers['content-type']?.includes('application/x-www-form-urlencoded'));

    if (isAjaxDelta) return false;

    const isXhr = !!req.headers['x-requested-with'] || 
                  req.headers['accept']?.includes('json') || 
                  req.headers['content-type']?.includes('multipart/form-data');
    
    
    // Para Serena-Test, habilitamos HB solo en subidas multipart (pesadas) o navegación estándar larga.
    // Excluimos explícitamente el login de HB para evitar interferencias.
    if (urlPart.includes('login') || urlPart.includes('ingreso')) return false;

    const isHeavyUpload = req.headers['content-type']?.includes('multipart/form-data');
    
    return !isStatic && !isImage && (isHeavyUpload || !isXhr);
  }

  resolveExecutionMode(ctx: RequestContext): ProductExecutionMode {
    if (this.isLoginHintPath(ctx)) return "none";
    if (this.hasConfiguredBackgroundJobPath(ctx)) return "background-job";
    if (ctx.isMultipartUpload && ctx.productConfig.backgroundJobForMultipart) return "background-job";
    if (ctx.hasForcedHeartbeatPath) return this.resolveForcedExecutionMode(ctx);
    if (!this.isHbEligible(ctx.req, ctx.urlPart, ctx.isStatic, ctx.isImage)) return "none";
    if (ctx.isAjax && ctx.productConfig.xhrKeepAliveForAjax) return "xhr-keepalive";
    return "passive-html";
  }

  /**
   * Limpieza quirúrgica de duplicación de rutas Portals producidas 
   * por la reescritura de URLs absolutas en el contexto de DNN.
   */
  override rewriteBody(body: string): string {
    if (!body) return body;
    
    // 1. Limpieza de rutas duplicadas (ej: //Portals/, //Skins/)
    // Usamos una regex que solo actúe sobre directorios conocidos de DNN para no romper comentarios JS.
    let processedBody = body.replace(/([^:])\/\/+(Portals\/|Skins\/|js\/|css\/|Images\/|DesktopModules\/)/gi, '$1/$2');

    // 2. Colapsar duplicaciones de nivel superior (ej: /Portals/0/Portals/0/)
    processedBody = processedBody.replace(/(\/Portals\/[^"'<>\s\/]+)\/+(Portals\/)/gi, '$1/');

    // 3. Inyectar script de auto-reload en páginas de Login.
    // Usamos indicadores más amplios detectados en el DOM (dnn_ctr820, cmdLogin, etc)
    const isLoginPage = processedBody.includes('dnn_ctr') && 
                       (processedBody.includes('Login') || processedBody.includes('cmdLogin') || processedBody.includes('ingreso'));

    if (isLoginPage && !processedBody.includes('BizGuard_AutoReload')) {
      const reloadScript = `
<!-- BizGuard_AutoReload -->
<script>
  (function() {
    function checkLogin() {
      // Si hay indicadores de Sys (Telerik/DNN)
      if (typeof window.Sys !== 'undefined' && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager) {
        var prm = window.Sys.WebForms.PageRequestManager.getInstance();
        prm.add_endRequest(function(sender, args) {
          // Si el login fue exitoso (no hay errores visibles y hay cookie de sesión)
          // Nota: ASP.NET_SessionId es HttpOnly, pero podemos buscar cambios en el DOM o cookies permitidas
          var isLogged = document.cookie.includes('.DOTNETNUKE') || document.body.innerHTML.includes('LogOff');
          if (isLogged) {
             console.log('[BizGuard] Estado logueado detectado, refrescando...');
             setTimeout(function() { window.location.reload(); }, 300);
          }
        });
      }
    }
    if (document.readyState === 'complete') checkLogin();
    else window.addEventListener('load', checkLogin);
  })();
</script>`;
      processedBody = processedBody.replace(/<\/body>/i, reloadScript + '</body>');
    }

    return processedBody;
  }
}
