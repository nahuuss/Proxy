import { renderBgJobPageScript } from "./proxy-bg-job-page-script";
import {
  renderBgJobPageBody,
  renderBgJobPageStyleBlock,
} from "./proxy-bg-job-page-template";

/**
 * Pagina de polling para Background Jobs
 */
export function renderBgJobPage(jobId: string, referer: string, publicHost: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>BizGuard - Procesando...</title>${renderBgJobPageStyleBlock()}</head><body>${renderBgJobPageBody()}${renderBgJobPageScript(jobId, referer, publicHost)}</body></html>`;
}
