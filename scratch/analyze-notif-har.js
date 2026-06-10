const fs = require('fs');
const path = require('path');

const harDir = path.join(__dirname, '..', 'har');
const TARGET_PATH_KEYWORD = 'importacionmasivanotificacion';

function fmt(ms) {
  if (ms === undefined || ms === null) return '-';
  if (ms >= 60000) return `${(ms/60000).toFixed(2)}min`;
  if (ms >= 1000) return `${(ms/1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtSize(bytes) {
  if (!bytes) return '0B';
  if (bytes > 1024*1024) return `${(bytes/1024/1024).toFixed(2)}MB`;
  if (bytes > 1024) return `${(bytes/1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

function analyzeFile(filename) {
  const filepath = path.join(harDir, filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const har = JSON.parse(raw);
  const entries = har.log.entries;

  console.log('\n' + '='.repeat(90));
  console.log(`FILE: ${filename} (${entries.length} requests)`);
  console.log('='.repeat(90));

  // --- Hosts involucrados ---
  const hosts = new Set(entries.map(e => { try { return new URL(e.request.url).host; } catch { return '?'; } }));
  console.log('\n[HOSTS]', [...hosts].join(', '));

  // --- Timeline global ---
  const first = new Date(entries[0].startedDateTime);
  const lastEntry = entries[entries.length - 1];
  const last = new Date(new Date(lastEntry.startedDateTime).getTime() + lastEntry.time);
  console.log(`[SESION] ${first.toISOString()} → ${last.toISOString()} (${fmt(last - first)})`);

  // --- Distribución de status ---
  const byStatus = {};
  entries.forEach(e => { const s = e.response.status; byStatus[s] = (byStatus[s]||0)+1; });
  console.log('\n[STATUS]', Object.entries(byStatus).sort((a,b)=>a[0]-b[0]).map(([s,c])=>`${s}×${c}`).join('  '));

  // --- WebSocket (SignalR) ---
  const wsEntries = entries.filter(e => e.response.status === 101);
  if (wsEntries.length > 0) {
    console.log('\n[WEBSOCKET / SignalR]');
    wsEntries.forEach(ws => {
      const msgs = ws._webSocketMessages || [];
      const realMsgs = msgs.filter(m => {
        const d = typeof m.data === 'string' ? m.data.trim() : JSON.stringify(m.data);
        return d !== '{}' && d !== '';
      });
      console.log(`  URL: ${ws.request.url.substring(0, 100)}`);
      console.log(`  Duración: ${fmt(ws.time)} | Mensajes WS: ${msgs.length} (reales: ${realMsgs.length}, HB: ${msgs.length - realMsgs.length})`);
      if (realMsgs.length > 0) {
        realMsgs.forEach((m, i) => {
          const d = typeof m.data === 'string' ? m.data : JSON.stringify(m.data);
          console.log(`    MSG #${i+1} [${m.type}] T+${(m.time||0).toFixed(0)}ms: ${d.substring(0, 200)}`);
        });
      }
    });
  }

  // --- SignalR negotiate ---
  const negotiates = entries.filter(e => e.request.url.toLowerCase().includes('signalr/negotiate'));
  if (negotiates.length > 0) {
    console.log('\n[SignalR NEGOTIATE]');
    negotiates.forEach(n => {
      console.log(`  ${n.request.method} → ${n.response.status} | ${fmt(n.time)}`);
      if (n.response.content?.text) {
        try {
          const obj = JSON.parse(n.response.content.text);
          console.log(`  KeepAliveTimeout: ${obj.KeepAliveTimeout}s | DisconnectTimeout: ${obj.DisconnectTimeout}s | ConnectionTimeout: ${obj.ConnectionTimeout}s`);
        } catch {}
      }
    });
  }

  // --- Requests a la URL objetivo ---
  const targetEntries = entries.filter(e => e.request.url.toLowerCase().includes(TARGET_PATH_KEYWORD));
  console.log(`\n[REQUESTS A ImportacionMasivaNotificacion] — ${targetEntries.length} total`);
  
  targetEntries.forEach((e, i) => {
    const postData = e.request.postData;
    const mimeType = postData?.mimeType || '';
    const params = postData?.params || [];
    const eventTarget = params.find(p => p.name === '__EVENTTARGET')?.value || '';
    const eventArg = params.find(p => p.name === '__EVENTARGUMENT')?.value || '';
    let actionLabel = '?';
    if (mimeType.includes('multipart')) actionLabel = '📎 UPLOAD archivo';
    else if (eventArg.includes('IMPORTAR')) actionLabel = '🔄 IMPORTAR';
    else if (eventArg.includes('PREIMPORTAR')) actionLabel = '🔍 PREIMPORTAR';
    else if (eventArg.includes('fetch')) actionLabel = '📋 fetch grilla';
    else if (eventTarget.includes('cbAcciones')) actionLabel = `⚙️ accion: ${decodeURIComponent(eventArg).substring(0,80)}`;
    else if (e.request.method === 'GET') actionLabel = '🌐 GET página';
    else actionLabel = `POST: ${eventTarget.substring(0,50)}`;

    const startTime = new Date(e.startedDateTime);
    const respText = e.response.content?.text || '';
    const leadingSpaces = respText.length - respText.trimStart().length;
    const respPreview = respText.trimStart().substring(0, 150);

    console.log(`\n  #${i+1} ${actionLabel}`);
    console.log(`     Iniciado: ${e.startedDateTime} | Duración: ${fmt(e.time)}`);
    console.log(`     HTTP: ${e.response.status} | Size: ${fmtSize(e.response.content?.size)} | CT: ${(e.response.headers?.find(h=>h.name.toLowerCase()==='content-type')?.value||'').substring(0,50)}`);
    if (leadingSpaces > 0) {
      console.log(`     ⚠️  ESPACIOS al inicio del body: ${leadingSpaces}`);
    }
    if (respPreview) {
      console.log(`     Body preview: ${respPreview}`);
    }

    // timings breakdown
    const t = e.timings || {};
    if (t.wait > 500) {
      console.log(`     Timings: wait=${fmt(t.wait)} receive=${fmt(t.receive)} send=${fmt(t.send)}`);
    }
  });

  // --- Requests lentos no relacionados ---
  const slowOthers = entries
    .filter(e => !e.request.url.toLowerCase().includes(TARGET_PATH_KEYWORD) && e.time > 3000)
    .sort((a,b) => b.time - a.time)
    .slice(0, 5);
  if (slowOthers.length > 0) {
    console.log('\n[OTROS LENTOS >3s]');
    slowOthers.forEach(e => {
      console.log(`  ${fmt(e.time)} | ${e.response.status} | ${e.request.method} ${e.request.url.substring(0,100)}`);
    });
  }

  // --- Errores ---
  const errors = entries.filter(e => e.response.status >= 400 || e.response.status === 0);
  if (errors.length > 0) {
    console.log('\n[ERRORES 4xx/5xx]');
    errors.slice(0, 10).forEach(e => {
      console.log(`  ${e.response.status} | ${e.request.method} ${e.request.url.substring(0,100)}`);
    });
  }

  // --- TOP 5 más lentos ---
  console.log('\n[TOP 5 MÁS LENTOS]');
  [...entries].sort((a,b) => b.time - a.time).slice(0,5).forEach((e,i) => {
    console.log(`  #${i+1} ${fmt(e.time)} | ${e.response.status} | ${e.request.method} ${e.request.url.substring(0,90)}`);
  });
}

const files = fs.readdirSync(harDir)
  .filter(f => f.endsWith('.har'))
  .sort();

for (const f of files) {
  try {
    analyzeFile(f);
  } catch(err) {
    console.error(`\nError procesando ${f}:`, err.message);
  }
}
