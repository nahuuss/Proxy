const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function run() {
  const file1 = path.join(__dirname, '../logs/2026-06-11_0836-1.jsonl');
  if (!fs.existsSync(file1)) {
    console.log('File 1 not found');
    return;
  }

  console.log(`Analyzing file 1: ${file1}`);
  const fileStream = fs.createReadStream(file1);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let slowRequests = [];
  let path404Counts = {};

  for await (const line of rl) {
    lineCount++;
    if (!line.trim()) continue;
    try {
      const log = JSON.parse(line);
      const ts = log.ts || log.timestamp;
      
      if (log.elapsed && log.elapsed > 2000) {
        slowRequests.push({
          line: lineCount,
          ts,
          elapsed: log.elapsed,
          ttfb: log.ttfb,
          path: log.path || log.url,
          status: log.status,
          user: log.user,
          conn: log.conn
        });
      }

      if (log.status === 404) {
        const p = (log.path || log.url).split('?')[0];
        path404Counts[p] = (path404Counts[p] || 0) + 1;
      }
    } catch(e){}
  }

  console.log(`Total lines in file 1: ${lineCount}`);
  console.log(`Slow requests (>2000ms) in file 1: ${slowRequests.length}`);
  if (slowRequests.length > 0) {
    slowRequests.sort((a,b) => b.elapsed - a.elapsed);
    console.log('Slowest requests in file 1:');
    slowRequests.forEach(r => console.log(JSON.stringify(r)));
  }

  console.log('\n404 Paths in file 1:');
  const sorted404 = Object.entries(path404Counts).sort((a,b) => b[1] - a[1]);
  sorted404.forEach(([p, count]) => {
    console.log(`  ${p}: ${count}`);
  });
}

run().catch(console.error);
