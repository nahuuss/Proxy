const fs = require('fs');
const path = require('path');

const harDir = path.join(__dirname, '..', 'har');

// Correlate HB log timestamps with HAR events
// HB log timestamps are in local time (UTC-3)
// HAR timestamps are in UTC

function localToUtc(localStr) {
  // "10:58:46" local ART = UTC-3 → "13:58:46Z"
  const [h, m, s] = localStr.split(':').map(Number);
  return new Date(Date.UTC(2026, 5, 5, h + 3, m, s));
}

const hbEvents = [
  // Session: conector-test (archivo csv upload)
  { time: '10:55:23', type: 'UPLOAD-DONE', label: 'conector-test UPLOAD' },
  // Session: conector-prod
  { time: '10:58:46', type: 'UPLOAD-DONE', label: 'conector-prod UPLOAD' },
  { time: '10:58:57', type: 'HB-START', label: 'HB inicia (10s after upload)' },
  { time: '10:59:12', type: 'HB-TICK', label: 'HB 25s activa' },
  { time: '10:59:27', type: 'HB-TICK', label: 'HB 40s activa' },
  { time: '10:59:42', type: 'HB-TICK', label: 'HB 55s activa' },
  { time: '10:59:57', type: 'HB-TICK', label: 'HB 70s activa (LAST LOG)' },
];

// Load conector-prod.har to get exact POST timings
const prodHar = JSON.parse(fs.readFileSync(path.join(harDir, 'conector-prod.har'), 'utf8'));
const testHar = JSON.parse(fs.readFileSync(path.join(harDir, 'conector-test.har'), 'utf8'));

console.log('='.repeat(80));
console.log('CORRELACIÓN HB LOG vs HAR - CONECTOR PROD');
console.log('='.repeat(80));

// Find key POST requests
const prodPosts = prodHar.log.entries.filter(e => e.request.method === 'POST');
const testPosts = testHar.log.entries.filter(e => e.request.method === 'POST');

console.log('\n--- CONECTOR-TEST POST TIMELINE ---');
testPosts.forEach((e, i) => {
  const start = new Date(e.startedDateTime);
  const end = new Date(start.getTime() + e.time);
  const postData = e.request.postData;
  const action = postData?.params?.find(p => p.name === '__EVENTARGUMENT')?.value || postData?.mimeType || '';
  const actionStr = action.includes('PREIMPORTAR') ? '→ PREIMPORTAR' : 
                    action.includes('fetch') ? '→ fetch grilla' :
                    action.includes('multipart') || (postData?.mimeType||'').includes('multipart') ? '→ UPLOAD FILE' :
                    '→ callback';
  console.log(`  POST #${i+1} ${actionStr}`);
  console.log(`    UTC Start: ${e.startedDateTime}`);
  console.log(`    Duration:  ${(e.time/1000).toFixed(3)}s`);
  console.log(`    UTC End:   ${end.toISOString()}`);
  console.log(`    Status:    ${e.response.status} (${e.response.content?.size||0} bytes)`);
});

console.log('\n--- CONECTOR-PROD POST TIMELINE ---');
prodPosts.forEach((e, i) => {
  const start = new Date(e.startedDateTime);
  const end = new Date(start.getTime() + e.time);
  const postData = e.request.postData;
  const action = postData?.params?.find(p => p.name === '__EVENTARGUMENT')?.value || '';
  const mimeType = postData?.mimeType || '';
  const actionStr = action.includes('PREIMPORTAR') ? '→ PREIMPORTAR ⚠️' : 
                    action.includes('fetch') ? '→ fetch grilla' :
                    mimeType.includes('multipart') ? '→ UPLOAD FILE' :
                    '→ callback';
  console.log(`  POST #${i+1} ${actionStr}`);
  console.log(`    UTC Start: ${e.startedDateTime}`);
  console.log(`    Duration:  ${(e.time/1000).toFixed(3)}s`);
  console.log(`    UTC End:   ${end.toISOString()}`);
  console.log(`    Status:    ${e.response.status} (${e.response.content?.size||0} bytes)`);
  
  // Check response body for leading spaces
  const respText = e.response.content?.text || '';
  if (respText) {
    const leadingSpaces = respText.length - respText.trimStart().length;
    const leadingChars = respText.substring(0, 20);
    console.log(`    Leading whitespace bytes: ${leadingSpaces}`);
    console.log(`    First 20 chars: |${leadingChars}|`);
    
    // Try parsing as JSON
    try {
      JSON.parse(respText.trim());
      console.log(`    JSON parse (trimmed): ✅ VALID`);
    } catch(err) {
      console.log(`    JSON parse (trimmed): ❌ INVALID - ${err.message.substring(0,100)}`);
    }
    try {
      JSON.parse(respText);
      console.log(`    JSON parse (raw): ✅ VALID`);
    } catch(err) {
      console.log(`    JSON parse (raw): ❌ INVALID - ${err.message.substring(0,100)}`);
    }
  }
});

console.log('\n--- TIMELINE INTEGRADA (Local ART = UTC-3) ---');
console.log('');

// Reconstruct timeline
const events = [];

// From HAR (convert UTC to ART)
prodPosts.forEach((e, i) => {
  const startUtc = new Date(e.startedDateTime);
  const endUtc = new Date(startUtc.getTime() + e.time);
  const startLocal = new Date(startUtc.getTime() - 3*3600*1000);
  const endLocal = new Date(endUtc.getTime() - 3*3600*1000);
  
  const postData = e.request.postData;
  const action = postData?.params?.find(p => p.name === '__EVENTARGUMENT')?.value || '';
  const mimeType = postData?.mimeType || '';
  const actionStr = action.includes('PREIMPORTAR') ? 'POST PREIMPORTAR' : 
                    action.includes('fetch') ? 'POST fetch' :
                    mimeType.includes('multipart') ? 'POST UPLOAD' :
                    'POST callback';
  
  events.push({ time: startLocal, label: `▶ ${actionStr} inicia`, src: 'HAR' });
  events.push({ time: endLocal, label: `◀ ${actionStr} completa (${(e.time/1000).toFixed(1)}s, ${e.response.content?.size||0}B, HTTP${e.response.status})`, src: 'HAR' });
});

// From HB log
const hbData = [
  { local: '10:58:46', label: '[UPLOAD-DONE] 45s countdown inicia' },
  { local: '10:58:57', label: '[HB-SHIELD] Pasivo INICIA (10s tras upload)' },
  { local: '10:59:12', label: '[HB-SHIELD] ⏱ 25s activa' },
  { local: '10:59:27', label: '[HB-SHIELD] ⏱ 40s activa' },
  { local: '10:59:42', label: '[HB-SHIELD] ⏱ 55s activa' },
  { local: '10:59:57', label: '[HB-SHIELD] ⏱ 70s activa — ÚLTIMO LOG' },
];
hbData.forEach(h => {
  const [hh, mm, ss] = h.local.split(':').map(Number);
  events.push({ time: new Date(2026, 5, 5, hh, mm, ss || 0), label: h.label, src: 'HB' });
});

events.sort((a, b) => a.time - b.time);

events.forEach(e => {
  const t = e.time;
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  const prefix = e.src === 'HB' ? '  [HB ] ' : '  [HAR] ';
  console.log(`${hh}:${mm}:${ss}  ${prefix}${e.label}`);
});

// Calculate when response should arrive vs last HB
console.log('\n--- ANÁLISIS DEL GAP ---');
const preimportarStart = new Date('2026-06-05T13:58:47.233Z');
const preimportarDuration = 81948; // ms
const preimportarEnd = new Date(preimportarStart.getTime() + preimportarDuration);
const localEnd = new Date(preimportarEnd.getTime() - 3*3600*1000);
console.log(`  PREIMPORTAR inicia (local): 10:58:47`);
console.log(`  PREIMPORTAR termina (local): ${localEnd.getHours()}:${String(localEnd.getMinutes()).padStart(2,'0')}:${String(localEnd.getSeconds()).padStart(2,'0')}`);
console.log(`  Último log HB: 10:59:57 (70s activa)`);

const lastHbLocal = new Date(2026, 5, 5, 10, 59, 57);
const gapMs = localEnd - lastHbLocal;
console.log(`  Gap entre último HB log y respuesta: ${(gapMs/1000).toFixed(1)}s`);
console.log('');
console.log('  PREGUNTA CLAVE: ¿Por qué el HB deja de logguear?');
console.log('  Si la respuesta llega a las 11:00:09 y el HB estaba activo hasta 10:59:57,');
console.log('  en 72 segundos de operación el HB debería haber inyectado spaces en el stream.');
console.log('  La respuesta contiene esos spaces al inicio → JSON.parse() del cliente FALLA.');
