
const fs = require('fs');
const har = JSON.parse(fs.readFileSync('e:/Proxy/core.serenaart.com.ar.har', 'utf8'));
const entries = har.log.entries.filter(e => e.response.status !== 200 && e.response.status !== 302 && e.response.status !== 304);

entries.forEach(e => {
  console.log(`URL: ${e.request.url}`);
  console.log(`Method: ${e.request.method}`);
  console.log(`Status: ${e.response.status}`);
  console.log(`Error: ${e._error || 'N/A'}`);
  console.log(`Wait: ${e.timings.wait}ms`);
  console.log('---');
});
