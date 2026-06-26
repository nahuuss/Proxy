const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function run() {
  const file2 = path.join(__dirname, '../logs/test-port/2026-06-11_1413-1.jsonl');
  if (!fs.existsSync(file2)) {
    console.log('File 2 not found');
    return;
  }

  const fileStream = fs.createReadStream(file2);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let userRequests = [];

  for await (const line of rl) {
    lineCount++;
    if (!line.trim()) continue;
    try {
      const log = JSON.parse(line);
      const isMiller = JSON.stringify(log.cookies || {}).toLowerCase().includes('miller') ||
                       JSON.stringify(log.reqHdrs || {}).toLowerCase().includes('miller');
      
      if (isMiller) {
        userRequests.push({
          line: lineCount,
          ts: log.ts || log.timestamp,
          elapsed: log.elapsed,
          method: log.method,
          url: log.url || log.path,
          status: log.status,
          reqSize: log.reqSize,
          resSize: log.resSize,
          xhr: log.xhr,
          err: log.err
        });
      }
    } catch(e){}
  }

  console.log(`Total lines: ${lineCount}`);
  console.log(`Total requests matching Miller: ${userRequests.length}`);
  
  // Sort by timestamp
  userRequests.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  userRequests.forEach(r => {
    console.log(`${r.ts} [Line ${r.line}] ${r.method} ${r.url} -> Status ${r.status} (${r.elapsed}ms) ReqSize: ${r.reqSize}, ResSize: ${r.resSize}`);
  });
}

run().catch(console.error);
