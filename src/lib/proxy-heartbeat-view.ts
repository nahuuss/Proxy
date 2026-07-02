export interface PassiveHeartbeatShellInput {
  elapsedSeconds: number;
}

function formatElapsedLabel(elapsedSeconds: number): string {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function renderPassiveHeartbeatShell(input: PassiveHeartbeatShellInput): string {
  const elapsedLabel = formatElapsedLabel(input.elapsedSeconds);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style id="bg-style">*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}.modal{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 8px 32px rgba(0,0,0,.10);text-align:center;min-width:340px;max-width:480px}.spinner{width:52px;height:52px;border:5px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 20px}@keyframes spin{to{transform:rotate(360deg)}}h3{font-size:18px;font-weight:600;color:#1e293b;margin-bottom:8px}.sub{color:#64748b;font-size:14px;margin-bottom:20px}.timer{font-size:36px;font-weight:700;color:#2563eb;font-variant-numeric:tabular-nums;letter-spacing:3px}.tlabel{font-size:11px;color:#94a3b8;margin-top:6px;text-transform:uppercase;letter-spacing:1px}.pbar-wrap{width:100%;background:#e2e8f0;border-radius:99px;height:8px;margin-top:20px;overflow:hidden}.pbar{height:8px;border-radius:99px;background:linear-gradient(90deg,#2563eb,#60a5fa);width:0%;transition:width 0.8s ease}.note{font-size:11px;color:#94a3b8;margin-top:18px;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:14px}</style></head><body><div class="modal" id="m"><div class="spinner"></div><h3>&#9203; Procesando archivo...</h3><p class="sub">Los datos se están procesando en el servidor.</p><div class="timer" id="t">${elapsedLabel}</div><div class="tlabel">Tiempo transcurrido</div><div class="pbar-wrap"><div class="pbar" id="pb"></div></div><div class="note">Esta pantalla es generada por BizGuard como protección contra cortes de conexión.<br>No forma parte de la aplicación.</div></div><script>var _s=${input.elapsedSeconds},_p=0,_piv=null,_iv=setInterval(function(){_s++;var m=Math.floor(_s/60),mstr=m<10?'0'+m:m,s=_s%60,sstr=s<10?'0'+s:s;document.getElementById("t").textContent=mstr+":"+sstr;_p=_p+(85-_p)*0.005;document.getElementById("pb").style.width=_p.toFixed(1)+"%";},1000);</script><!--`;
}
