function sanitizeBackUrl(referer: string, publicHost: string): string {
  return referer.includes(publicHost) ? referer : "/";
}

export function renderBgJobPageScript(jobId: string, referer: string, publicHost: string): string {
  const safeId = JSON.stringify(jobId);
  const backUrl = JSON.stringify(sanitizeBackUrl(referer, publicHost));

  return `<script>
var jid=${safeId},bu=${backUrl},_s=0,_p=0,_done=false;
if(window.self!==window.top){try{window.top.location.href=window.location.href;}catch(e){}}
var _iv=setInterval(function(){_s++;var m=Math.floor(_s/60),s=_s%60;document.getElementById('t').textContent=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);_p=_p+(90-_p)*0.004;document.getElementById('pb').style.width=_p.toFixed(1)+'%';},1000);
function poll(){if(_done)return;fetch('/__bizguard_job/'+jid+'/status').then(function(r){return r.json();}).then(function(d){if(d.status==='done'){_done=true;clearInterval(_iv);getResult();}else if(d.status==='error'){_done=true;clearInterval(_iv);showErr(d.error||'Error desconocido');}else{setTimeout(poll,2000);}}).catch(function(){setTimeout(poll,3000);});}
function getResult(){document.getElementById('pb').style.width='100%';fetch('/__bizguard_job/'+jid+'/result').then(function(r){var ct=r.headers.get('content-type')||'';if(ct.includes('json')){r.json().then(function(j){var msg=j.message||j.Message||j.descripcion||j.Descripcion||j.error||j.Error||JSON.stringify(j).substring(0,300);var ok=!j.error&&!j.Error&&r.ok;showDone(ok?'✅ Operacion completada':'⚠️ Servidor respondio',msg);});}else if(ct.includes('text/html')){r.text().then(function(){showDone('✅ Completado','El servidor proceso la solicitud correctamente.');});}else{r.blob().then(function(bl){var url=URL.createObjectURL(bl);var a=document.createElement('a');a.href=url;a.download='resultado';a.click();showDone('✅ Archivo descargado','La descarga comenzo automaticamente.');});}}).catch(function(e){showErr(e.message);});}
function showDone(t,m){document.getElementById('ic').outerHTML='<div class="ic-done" id="ic">✓</div>';document.getElementById('tt').textContent=t;document.getElementById('sb').textContent=m;document.getElementById('m').innerHTML+='<button onclick="window.history.length > 1 ? window.history.back() : window.location.replace(bu)" style="margin-top:24px;padding:10px 28px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">&#8592; Volver</button>';}
function showErr(m){document.getElementById('ic').outerHTML='<div class="ic-err" id="ic">✗</div>';document.getElementById('tt').textContent='Error en el servidor';document.getElementById('sb').textContent=m;}
poll();
</script>`;
}
