
const fs = require('fs');
const har = JSON.parse(fs.readFileSync('e:/Proxy/core.serenaart.com.ar.har', 'utf8'));
const entries = har.log.entries.filter(e => e.request.url.includes('TramiteMedico'));

entries.forEach(e => {
  console.log(`URL: ${e.request.url}`);
  console.log(`Method: ${e.request.method}`);
  console.log(`Status: ${e.response.status}`);
  console.log(`Wait: ${e.timings.wait}ms`);
  console.log(`Receive: ${e.timings.receive}ms`);
  console.log(`Content Size: ${e.response.content.size}`);
  console.log('---');
});
