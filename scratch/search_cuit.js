const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function searchInFile(filePath, queries) {
  console.log(`Searching in: ${filePath}`);
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let matches = [];

  for await (const line of rl) {
    lineCount++;
    if (!line.trim()) continue;
    const lowerLine = line.toLowerCase();
    const found = queries.some(q => lowerLine.includes(q.toLowerCase()));
    if (found) {
      matches.push({
        line: lineCount,
        content: line
      });
    }
  }

  console.log(`Found ${matches.length} matching lines out of ${lineCount} total lines.`);
  matches.forEach(m => {
    console.log(`  Line ${m.line}: ${m.content.slice(0, 1000)}...`);
    // If it's a JSON entry, let's inspect its headers or query string
    try {
      const parsed = JSON.parse(m.content);
      if (parsed.reqHdrs) {
        console.log(`    ReqHeaders:`, JSON.stringify(parsed.reqHdrs).slice(0, 500));
      }
      if (parsed.resHdrs) {
        console.log(`    ResHeaders:`, JSON.stringify(parsed.resHdrs).slice(0, 500));
      }
      if (parsed.cookies) {
        console.log(`    Cookies:`, parsed.cookies);
      }
      if (parsed.extra) {
        console.log(`    Extra:`, parsed.extra);
      }
    } catch(e){}
  });
}

async function run() {
  const file1 = path.join(__dirname, '../logs/2026-06-11_0836-1.jsonl');
  const file2 = path.join(__dirname, '../logs/test-port/2026-06-11_1413-1.jsonl');
  
  const searchTerms = [
    '30-71105575-0',
    '30711055750',
    '71105575',
    'miller',
    'melina'
  ];

  if (fs.existsSync(file1)) {
    await searchInFile(file1, searchTerms);
  }
  console.log('\n----------------------------------------\n');
  if (fs.existsSync(file2)) {
    await searchInFile(file2, searchTerms);
  }
}

run().catch(console.error);
