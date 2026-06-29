const fs = require('fs');
const path = require('path');

const harDir = path.join(__dirname, '..', 'har');
const files = [
  'core.serenaart.com.ar-rds.har',
  'coretest.serenaart.com.ar-rds.har',
  'conector-test.har',
  'conector-prod.har',
  'conector.har'
];

function formatMs(ms) {
  if (ms >= 1000) return `${(ms/1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function analyzeHar(filename) {
  const filepath = path.join(harDir, filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const har = JSON.parse(raw);
  const entries = har.log.entries;

  console.log('\n' + '='.repeat(80));
  console.log(`FILE: ${filename}`);
  console.log(`Total requests: ${entries.length}`);
  console.log('='.repeat(80));

  const byStatus = {};
  const byMethod = {};
  const slowRequests = [];
  const errorRequests = [];
  const sseRequests = [];
  const heartbeatRequests = [];
  const uploadRequests = [];
  const connectorReqs = [];

  const connectorKeywords = ['conector', 'connector', 'proxy', 'upload', 'file', 'adjunto', 'attach', 'importa', 'carga', 'task', 'import'];
  const sseKeywords = ['event-stream', 'text/event-stream'];

  entries.forEach((entry, idx) => {
    const req = entry.request;
    const res = entry.response;
    const time = entry.time;
    const url = req.url;
    const method = req.method;
    const status = res.status;
    const mimeType = (res.content && res.content.mimeType) || '';
    const startedAt = entry.startedDateTime;
    const reqMime = (req.postData && req.postData.mimeType) || '';

    byStatus[status] = (byStatus[status] || 0) + 1;
    byMethod[method] = (byMethod[method] || 0) + 1;

    if (reqMime.includes('multipart') || url.includes('upload') || url.includes('import')) {
      uploadRequests.push({ url, method, status, time, startedAt, idx });
    }

    if (mimeType.includes('event-stream') || url.includes('/sse') || url.includes('stream')) {
      sseRequests.push({ url, method, status, time, startedAt, idx, mimeType });
    }

    if (url.toLowerCase().includes('heartbeat') || url.toLowerCase().includes('/hb') || url.toLowerCase().includes('ping') || url.toLowerCase().includes('keepalive')) {
      heartbeatRequests.push({ url, method, status, time, startedAt, idx });
    }

    if (time > 2000) {
      slowRequests.push({ url, method, status, time, startedAt, idx });
    }

    if (status >= 400 || status === 0) {
      errorRequests.push({ url, method, status, time, startedAt, idx });
    }

    if (connectorKeywords.some(kw => url.toLowerCase().includes(kw))) {
      connectorReqs.push({ url, method, status, time, startedAt, idx, mimeType });
    }
  });

  console.log('\n--- STATUS CODE DISTRIBUTION ---');
  Object.entries(byStatus).sort((a,b) => Number(a[0]) - Number(b[0])).forEach(([s, c]) => {
    console.log(`  HTTP ${s}: ${c} requests`);
  });

  console.log('\n--- HTTP METHODS ---');
  Object.entries(byMethod).sort((a,b) => b[1]-a[1]).forEach(([m, c]) => {
    console.log(`  ${m}: ${c}`);
  });

  console.log('\n--- UPLOAD / IMPORT REQUESTS ---');
  if (uploadRequests.length === 0) {
    console.log('  (none detected)');
  } else {
    uploadRequests.forEach(r => {
      console.log(`  [${r.idx}] ${r.startedAt}`);
      console.log(`       ${r.method} ${r.url}`);
      console.log(`       Status: ${r.status} | Time: ${formatMs(r.time)}`);
    });
  }

  console.log('\n--- SSE / STREAMING REQUESTS ---');
  if (sseRequests.length === 0) {
    console.log('  (none detected)');
  } else {
    sseRequests.forEach(r => {
      console.log(`  [${r.idx}] ${r.startedAt}`);
      console.log(`       ${r.method} ${r.url}`);
      console.log(`       Status: ${r.status} | Time: ${formatMs(r.time)} | MimeType: ${r.mimeType}`);
    });
  }

  console.log('\n--- HEARTBEAT / PING REQUESTS ---');
  if (heartbeatRequests.length === 0) {
    console.log('  (none detected)');
  } else {
    heartbeatRequests.forEach(r => {
      console.log(`  [${r.idx}] ${r.startedAt}`);
      console.log(`       ${r.method} ${r.url}`);
      console.log(`       Status: ${r.status} | Time: ${formatMs(r.time)}`);
    });
  }

  console.log('\n--- SLOW REQUESTS (>2s) ---');
  if (slowRequests.length === 0) {
    console.log('  (none)');
  } else {
    slowRequests.sort((a,b) => b.time - a.time).slice(0,15).forEach(r => {
      console.log(`  [${r.idx}] ${r.method} ${r.url.substring(0,120)}`);
      console.log(`       Status: ${r.status} | Time: ${formatMs(r.time)} | Started: ${r.startedAt}`);
    });
  }

  console.log('\n--- ERROR REQUESTS (4xx/5xx/0) ---');
  if (errorRequests.length === 0) {
    console.log('  (none)');
  } else {
    errorRequests.slice(0,20).forEach(r => {
      console.log(`  [${r.idx}] ${r.method} ${r.url.substring(0,120)}`);
      console.log(`       Status: ${r.status} | Time: ${formatMs(r.time)} | Started: ${r.startedAt}`);
    });
  }

  console.log('\n--- CONNECTOR/UPLOAD RELATED URLS ---');
  if (connectorReqs.length === 0) {
    console.log('  (none matching keywords)');
  } else {
    connectorReqs.forEach(r => {
      console.log(`  [${r.idx}] ${r.method} ${r.url.substring(0,120)}`);
      console.log(`       Status: ${r.status} | Time: ${formatMs(r.time)} | MimeType: ${r.mimeType}`);
    });
  }

  if (entries.length > 0) {
    const first = entries[0];
    const last = entries[entries.length - 1];
    console.log('\n--- TIMELINE ---');
    console.log(`  First: ${first.startedDateTime}`);
    console.log(`  Last:  ${last.startedDateTime}`);
    const totalMs = new Date(last.startedDateTime) - new Date(first.startedDateTime);
    console.log(`  Session duration: ${formatMs(totalMs)}`);
  }

  const top10 = [...entries].sort((a,b) => b.time - a.time).slice(0, 10);
  console.log('\n--- TOP 10 SLOWEST REQUESTS ---');
  top10.forEach((e, i) => {
    console.log(`  #${i+1} ${formatMs(e.time).padStart(10)} | HTTP ${e.response.status} | ${e.request.method} ${e.request.url.substring(0,100)}`);
  });

  const hosts = new Set(entries.map(e => {
    try { return new URL(e.request.url).host; } catch { return 'unknown'; }
  }));
  console.log('\n--- UNIQUE HOSTS ---');
  [...hosts].forEach(h => console.log(`  ${h}`));

  // Analyze WebSocket (101)
  const ws = entries.filter(e => e.response.status === 101);
  if (ws.length > 0) {
    console.log('\n--- WEBSOCKET CONNECTIONS (HTTP 101) ---');
    ws.forEach(e => {
      console.log(`  ${e.request.method} ${e.request.url}`);
      const msgs = (e._webSocketMessages || e.response._webSocketMessages || []);
      console.log(`  Time: ${formatMs(e.time)} | WS Messages: ${msgs.length}`);
      if (msgs.length > 0) {
        const lastMsgs = msgs.slice(-5);
        console.log(`  Last ${lastMsgs.length} WS messages:`);
        lastMsgs.forEach(m => {
          const data = typeof m.data === 'string' ? m.data.substring(0, 200) : JSON.stringify(m.data).substring(0, 200);
          console.log(`    [${m.type}] T+${m.time?.toFixed(0)}ms: ${data}`);
        });
      }
    });
  }

  // Analyze 429 - rate limit
  const r429 = entries.filter(e => e.response.status === 429);
  if (r429.length > 0) {
    console.log('\n--- RATE LIMIT (429) REQUESTS ---');
    r429.forEach(e => {
      console.log(`  ${e.request.method} ${e.request.url.substring(0,120)}`);
      console.log(`  Time: ${formatMs(e.time)} | Started: ${e.startedDateTime}`);
      const retryAfter = e.response.headers?.find(h => h.name.toLowerCase() === 'retry-after');
      if (retryAfter) console.log(`  Retry-After: ${retryAfter.value}`);
    });
  }

  return { filename, totalRequests: entries.length, errors: errorRequests.length, slow: slowRequests.length, uploads: uploadRequests.length, sse: sseRequests.length, hb: heartbeatRequests.length };
}

const summaries = [];
for (const file of files) {
  try {
    const summary = analyzeHar(file);
    summaries.push(summary);
  } catch (e) {
    console.error(`\nError processing ${file}: ${e.message}`);
    console.error(e.stack);
  }
}

console.log('\n\n' + '='.repeat(80));
console.log('SUMMARY COMPARISON');
console.log('='.repeat(80));
console.log('File'.padEnd(45) + '| Reqs  | Errors | Slow | Uploads | SSE | HB');
console.log('-'.repeat(80));
summaries.forEach(s => {
  const line = s.filename.padEnd(45) +
    `| ${String(s.totalRequests).padStart(5)} ` +
    `| ${String(s.errors).padStart(6)} ` +
    `| ${String(s.slow).padStart(4)} ` +
    `| ${String(s.uploads).padStart(7)} ` +
    `| ${String(s.sse).padStart(3)} ` +
    `| ${s.hb}`;
  console.log(line);
});
