const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function compileHar(jsonlPath) {
  if (!jsonlPath) {
    console.error('Uso: node scratch/compile-har.js <ruta-al-archivo-jsonl> [ruta-salida-har]');
    process.exit(1);
  }

  const absoluteJsonlPath = path.resolve(jsonlPath);
  if (!fs.existsSync(absoluteJsonlPath)) {
    console.error(`Error: El archivo no existe en la ruta: ${absoluteJsonlPath}`);
    process.exit(1);
  }

  const outputHarPath = process.argv[3] 
    ? path.resolve(process.argv[3])
    : absoluteJsonlPath.replace(/\.jsonl$/, '.har');

  console.log(`Leyendo logs desde: ${absoluteJsonlPath}`);
  
  const fileStream = fs.createReadStream(absoluteJsonlPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const entries = [];
  let lineNumber = 0;
  let errorCount = 0;

  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      entries.push(entry);
    } catch (err) {
      errorCount++;
      console.warn(`[Línea ${lineNumber}] Error parseando JSON:`, err.message);
    }
  }

  const harData = {
    log: {
      version: '1.2',
      creator: {
        name: 'BizGuard HAR Compiler',
        version: '1.0'
      },
      pages: [],
      entries: entries
    }
  };

  fs.writeFileSync(outputHarPath, JSON.stringify(harData, null, 2), 'utf8');
  console.log(`\n¡Compilación terminada con éxito!`);
  console.log(`Entradas compiladas: ${entries.length}`);
  if (errorCount > 0) {
    console.log(`Líneas con error omitidas: ${errorCount}`);
  }
  console.log(`Archivo HAR guardado en: ${outputHarPath}`);
}

const inputPath = process.argv[2];
compileHar(inputPath);
