const fs = require('fs');
const path = require('path');

const harDir = path.join(__dirname, '..', 'har');

// Deep analysis focused on the critical difference between test and prod connector
function deepAnalyze(filename) {
  const filepath = path.join(harDir, filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const har = JSON.parse(raw);
  const entries = har.log.entries;

  console.log('\n' + '='.repeat(80));
  console.log(`DEEP ANALYSIS: ${filename}`);
  console.log('='.repeat(80));

  // 1. WebSocket: ALL messages
  const ws = entries.filter(e => e.response.status === 101);
  if (ws.length > 0) {
    ws.forEach(wsEntry => {
      const msgs = wsEntry._webSocketMessages || wsEntry.webSocketMessages || [];
      console.log(`\nWEBSOCKET URL: ${wsEntry.request.url.substring(0, 150)}`);
      console.log(`Connection time: ${(wsEntry.time/1000).toFixed(2)}s`);
      console.log(`Total WS messages: ${msgs.length}`);
      
      if (msgs.length > 0) {
        console.log('\nALL WebSocket messages:');
        msgs.forEach((m, i) => {
          let data = m.data;
          if (typeof data === 'string') {
            data = data.substring(0, 300);
          } else {
            data = JSON.stringify(data).substring(0, 300);
          }
          // Skip empty heartbeat pings
          const isEmpty = data === '{}' || data === '' || data.trim() === '{}';
          const prefix = isEmpty ? '  [HB]' : '  [MSG]';
          console.log(`  ${i+1}. [${m.type || 'unknown'}] T+${(m.time||0).toFixed(0)}ms ${prefix}: ${data}`);
        });

        // Count by type
        const byType = {};
        const byContent = {};
        msgs.forEach(m => {
          byType[m.type || 'unknown'] = (byType[m.type || 'unknown'] || 0) + 1;
          const content = (typeof m.data === 'string' ? m.data : JSON.stringify(m.data)).trim();
          const key = content === '{}' || content === '' ? '[HB/empty]' : '[real message]';
          byContent[key] = (byContent[key] || 0) + 1;
        });
        console.log('\nWS message breakdown:');
        Object.entries(byType).forEach(([t, c]) => console.log(`  Type "${t}": ${c} messages`));
        Object.entries(byContent).forEach(([t, c]) => console.log(`  Content "${t}": ${c} messages`));
        
        // First non-empty message
        const firstReal = msgs.find(m => {
          const d = typeof m.data === 'string' ? m.data.trim() : JSON.stringify(m.data).trim();
          return d !== '{}' && d !== '';
        });
        if (firstReal) {
          console.log(`\nFirst NON-EMPTY WS message (T+${(firstReal.time||0).toFixed(0)}ms):`);
          const d = typeof firstReal.data === 'string' ? firstReal.data : JSON.stringify(firstReal.data);
          console.log(`  ${d.substring(0, 500)}`);
        }
      }
    });
  }

  // 2. All POST requests with full detail
  console.log('\n--- ALL POST REQUESTS ---');
  const posts = entries.filter(e => e.request.method === 'POST');
  posts.forEach((e, i) => {
    console.log(`\nPOST #${i+1}: ${e.request.url.substring(0, 120)}`);
    console.log(`  Started: ${e.startedDateTime}`);
    console.log(`  Time: ${(e.time/1000).toFixed(3)}s`);
    console.log(`  Status: ${e.response.status}`);
    
    // Request details
    const postData = e.request.postData;
    if (postData) {
      console.log(`  Request Content-Type: ${postData.mimeType}`);
      if (postData.params && postData.params.length > 0) {
        console.log(`  Form params count: ${postData.params.length}`);
        postData.params.slice(0, 5).forEach(p => {
          const val = (p.value || '').substring(0, 100);
          console.log(`    - ${p.name}: ${val}`);
        });
      }
      if (postData.text) {
        console.log(`  Body preview: ${postData.text.substring(0, 200)}`);
      }
    }

    // Response headers relevant
    const resHeaders = e.response.headers || [];
    const contentType = resHeaders.find(h => h.name.toLowerCase() === 'content-type');
    const location = resHeaders.find(h => h.name.toLowerCase() === 'location');
    const retryAfter = resHeaders.find(h => h.name.toLowerCase() === 'retry-after');
    if (contentType) console.log(`  Response Content-Type: ${contentType.value}`);
    if (location) console.log(`  Redirect Location: ${location.value}`);
    if (retryAfter) console.log(`  Retry-After: ${retryAfter.value}`);

    // Response body preview
    const respContent = e.response.content;
    if (respContent && respContent.text) {
      const preview = respContent.text.substring(0, 300);
      console.log(`  Response body preview: ${preview}`);
    }
    console.log(`  Response size: ${e.response.content?.size || 0} bytes`);
  });

  // 3. Timing breakdown of key requests
  console.log('\n--- SIGNALR NEGOTIATE ---');
  const negotiates = entries.filter(e => e.request.url.includes('signalr/negotiate'));
  negotiates.forEach(e => {
    console.log(`  ${e.request.method} ${e.request.url.substring(0, 120)}`);
    console.log(`  Status: ${e.response.status} | Time: ${(e.time/1000).toFixed(3)}s`);
    const respContent = e.response.content;
    if (respContent && respContent.text) {
      console.log(`  Response: ${respContent.text.substring(0, 300)}`);
    }
  });

  // 4. Check for any polling or long-lived requests (other than WS)
  console.log('\n--- REQUESTS BY DURATION BUCKETS ---');
  const buckets = { '<100ms': 0, '100-500ms': 0, '500ms-2s': 0, '2s-10s': 0, '10s-60s': 0, '>60s': 0 };
  entries.forEach(e => {
    const t = e.time;
    if (t < 100) buckets['<100ms']++;
    else if (t < 500) buckets['100-500ms']++;
    else if (t < 2000) buckets['500ms-2s']++;
    else if (t < 10000) buckets['2s-10s']++;
    else if (t < 60000) buckets['10s-60s']++;
    else buckets['>60s']++;
  });
  Object.entries(buckets).forEach(([b, c]) => {
    if (c > 0) console.log(`  ${b}: ${c} requests`);
  });

  // 5. Timings object for key requests
  console.log('\n--- DETAILED TIMINGS (key requests) ---');
  const keyEntries = entries.filter(e => e.time > 1000 || e.response.status === 101 || e.request.url.includes('signalr'));
  keyEntries.slice(0, 10).forEach(e => {
    const t = e.timings || {};
    console.log(`  ${e.request.method} ${e.request.url.substring(0, 80)}`);
    console.log(`    Total: ${(e.time/1000).toFixed(3)}s | DNS: ${t.dns||0}ms | Connect: ${t.connect||0}ms | Send: ${t.send||0}ms | Wait: ${t.wait||0}ms | Receive: ${t.receive||0}ms | SSL: ${t.ssl||0}ms`);
  });
}

const files = ['conector-test.har', 'conector-prod.har'];
for (const f of files) {
  deepAnalyze(f);
}
