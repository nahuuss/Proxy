/**
 * PROXY WRAPPER ENTERPRISE V48 (FILE GUARD EDITION) - CLOUDFLARE TUNNEL
 * Características:
 *  1. File Guard: Blindaje total. Si hay Content-Disposition: attachment, NO reescribe dominios.
 *  2. Binary Detection+: Firma PK (Excel/Zip) y %PDF- (PDF) detectados en el búfer.
 *  3. Pro Timer: Tiempo en formato 'm s' (ej: 1m 39s) - Fijo en Dashboard.
 *  4. Heartbeat Sync: Blob download con auto-retorno (window.location.replace) cuando HB disparó.
 *  5. File Log: Registro persistente en wrapper.log (FILE_LOG_ENABLED).
 *  6. Ping Panel: Test TCP a endpoints Cloudflare Tunnel cada 30s.
 *  7. Auto-Refresh: Dashboard actualiza cada 1s sin depender de IPC.
 *  8. Task Sub-Rows: Muestra requests individuales con elapsed propio por worker.
 *  9. Layout Dinámico: Expande/contrae sub-filas según actividad (0 en IDLE, N con tasks).
 * 10. Stale Detection: Detecta workers sin comunicación >15s → ⚠️ STALE.
 * 11. URL Rewrite Root-Relative: URLs absolutas → root-relative (funciona en local y producción).
 */

const http = require('http');
const https = require('https');
const net = require('net');
const cluster = require('cluster');
const zlib = require('zlib');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// CONFIGURACIÓN
const INTERNAL_TARGET = 'core.serenaart.com.ar';
const PUBLIC_HOST = 'core.nathium.com.ar';
const PROXY_PORT = 8080;
const HB_FIRST_PULSE_MS = 55000;
const HB_INTERVAL_MS = 15000;

// PING PANEL - CLOUDFLARE TUNNEL
const PING_BOX_ROWS = 3; // 4 endpoints, 2 por fila + fila de tráfico
const PING_INTERVAL_MS = 30000;
const PING_ENDPOINTS = [
    ['region1.v2.argotunnel.com', 7844, 'region1.argotunnel'],
    ['region2.v2.argotunnel.com', 7844, 'region2.argotunnel'],
    ['api.cloudflare.com',         443, 'api.cloudflare.com'],
    ['update.argotunnel.com',      443, 'update.argotunnel'],
];
const pingResults = {};

// LOG A ARCHIVO: 1 = activo, 0 = desactivado
const FILE_LOG_ENABLED = 1;
const LOG_FILE = path.join(__dirname, 'wrapper.log');

const args = process.argv.slice(2);
const isNoGui = args.includes('--no-gui') || args.includes('--quiet') || !process.stdout.isTTY;

if (cluster.isPrimary) {
    const numWorkers = 2;
    let MAX_TASKS_PER_WORKER = 0;  // base compacta, 0 en IDLE
    let WORKER_SECTION_ROWS = numWorkers * (1 + MAX_TASKS_PER_WORKER);
    const workersInfo = {};
    const workerBytes = {};
    const logBuffer = [];
    const DASH_WIDTH = 114;
    const MAX_TASKS_CAP = 15;
    let lastKnownMaxTasks = 0;

    const getDynamicMaxLogs = () => {
        if (isNoGui) return 1;
        const rows = process.stdout.rows || 24;
        return Math.max(5, rows - (WORKER_SECTION_ROWS + PING_BOX_ROWS + 13));
    };

    const updateMaxTasksPerWorker = () => {
        const observedMax = Math.max(...Object.values(workersInfo).map(w => (w.tasks || []).length), 0);
        const newMax = Math.min(observedMax, MAX_TASKS_CAP);
        if (newMax !== lastKnownMaxTasks) {
            lastKnownMaxTasks = newMax;
            MAX_TASKS_PER_WORKER = newMax;
            WORKER_SECTION_ROWS = numWorkers * (1 + MAX_TASKS_PER_WORKER);
            return true;
        }
        return false;
    };

    let MAX_LOGS = getDynamicMaxLogs();

    function drawLayout() {
        if (isNoGui) return;
        process.stdout.write('\x1b[2J\x1b[0f');
        const rows = process.stdout.rows || 40;
        for (let i = 0; i < rows; i++) process.stdout.write('\n');
        readline.cursorTo(process.stdout, 0, 0);
        MAX_LOGS = getDynamicMaxLogs();
        console.log(`\x1b[36m┏━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m`);
        console.log(`\x1b[36m┃ WORKER ID    ┃ ESTADO        ┃ PETICIONES  ┃ TIEMPO PROCESO   ┃ HB CLOUDFLARE    ┃ ACTIVAS                     ┃\x1b[0m`);
        console.log(`\x1b[36m┣━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\x1b[0m`);
        for (let i = 0; i < WORKER_SECTION_ROWS; i++) console.log(`\x1b[36m┃\x1b[0m${' '.repeat(112)}\x1b[36m┃\x1b[0m`);
        console.log(`\x1b[36m┗━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m`);
        const pingTitle = ' PING CLOUDFLARE TUNNEL ENDPOINTS (TCP) ';
        const pingPad = DASH_WIDTH - pingTitle.length - 2;
        console.log(`\x1b[35m┏━${pingTitle}${'━'.repeat(Math.max(0, pingPad - 1))}┓\x1b[0m`);
        for (let i = 0; i < PING_BOX_ROWS; i++) console.log(`\x1b[35m┃\x1b[0m${' '.repeat(112)}\x1b[35m┃\x1b[0m`);
        console.log(`\x1b[35m┗${'━'.repeat(112)}┛\x1b[0m`);
        const title = " REGISTRO DE ACTIVIDAD (CICLO COMPLETO) ";
        const paddingDashes = DASH_WIDTH - title.length - 2;
        console.log(`\x1b[33m┏━${title}${'━'.repeat(Math.max(0, paddingDashes - 1))}┓\x1b[0m`);
        for (let i = 0; i < MAX_LOGS; i++) console.log(`\x1b[33m┃\x1b[0m ${' '.repeat(110)} \x1b[33m┃\x1b[0m`);
        console.log(`\x1b[33m┗${'━'.repeat(112)}┛\x1b[0m`);
        while (logBuffer.length > MAX_LOGS) logBuffer.shift();
    }

    function addLog(msg) {
        const time = new Date().toLocaleTimeString();
        const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, '');
        if (FILE_LOG_ENABLED) {
            fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] ${cleanMsg}\n`, () => {});
        }
        if (isNoGui) {
            console.log(`[${time}] ${cleanMsg}`);
            return;
        }
        logBuffer.push(`[${time}] ${msg}`);
        if (logBuffer.length > MAX_LOGS) logBuffer.shift();
        updateLogs();
    }

    function updateDashboard() {
        if (isNoGui) return;

        // Revisar si MAX_TASKS_PER_WORKER necesita expandirse/contraerse
        const layoutChanged = updateMaxTasksPerWorker();
        if (layoutChanged) {
            drawLayout();
            return;
        }

        readline.cursorTo(process.stdout, 0, 3);
        const now = Date.now();
        Object.keys(workersInfo).forEach((pid) => {
            const info = workersInfo[pid];
            // Detectar data stale (>15s sin actualización)
            const isStale = now - (info.lastUpdate || 0) > 15000;
            let stateColor = isStale ? '\x1b[90m' : (info.state === 'IDLE' ? '\x1b[32m' : (info.state && info.state.includes('LATIDO') ? '\x1b[31m' : '\x1b[33m'));
            let stateDisplay = info.state || 'INIT';
            if (isStale) stateDisplay = '⚠️ STALE';
            const col1 = pid.padEnd(12);
            const col2 = stateDisplay.padEnd(13);
            const col3 = String(info.totalReqs || 0).padEnd(11);
            const col4 = (info.elapsed || '0s').padEnd(16);
            const col5 = (info.hbStatus || '-').padEnd(16);
            const tasks = info.tasks || [];
            const activeCnt = tasks.filter(t => !t.isLongLived).length;
            const sseCnt = tasks.filter(t => t.isLongLived).length;
            const activeLabel = info.state === 'IDLE'
                ? (sseCnt > 0 ? `LIBRE | ${sseCnt} sse` : 'LIBRE')
                : `${activeCnt} req${sseCnt > 0 ? ` | ${sseCnt} sse` : ''}`;
            const col6 = activeLabel.substring(0, 27).padEnd(27);
            process.stdout.write(`\x1b[36m┃\x1b[0m ${col1} \x1b[36m┃\x1b[0m ${stateColor}${col2}\x1b[0m \x1b[36m┃\x1b[0m ${col3} \x1b[36m┃\x1b[0m ${col4} \x1b[36m┃\x1b[0m ${col5} \x1b[36m┃\x1b[0m ${col6} \x1b[36m┃\x1b[0m\n`);

            // Task sub-rows: dinámico
            const emptyCols = [14, 15, 13, 18, 18, 29];
            const emptySubRow = emptyCols.map(w => ' '.repeat(w)).join('\x1b[36m┃\x1b[0m');

            if (tasks.length === 0) {
                // IDLE: no mostrar filas vacías
            } else {
                const tasksToShow = Math.min(tasks.length, MAX_TASKS_PER_WORKER - (tasks.length > MAX_TASKS_PER_WORKER ? 1 : 0));
                const overflow = Math.max(0, tasks.length - tasksToShow);
                const subRowsToRender = tasksToShow + (overflow > 0 ? 1 : 0);

                for (let ti = 0; ti < subRowsToRender; ti++) {
                    if (ti === subRowsToRender - 1 && overflow > 0) {
                        const overflowMsg = `  \u21b3 ... +${overflow} more req`.padEnd(14);
                        const overflowContent = overflowMsg.padEnd(97);
                        process.stdout.write(`\x1b[36m┃\x1b[0m\x1b[90m${overflowMsg}\x1b[36m┃\x1b[0m\x1b[90m${overflowContent}\x1b[0m\x1b[36m┃\x1b[0m\n`);
                    } else if (ti < tasks.length) {
                        const t = tasks[ti];
                        const tColor = t.isLongLived ? '\x1b[90m' : '\x1b[33m';
                        const method = (t.method || 'GET').substring(0, 6).padEnd(6);
                        const elapsed = (t.elapsed || '0s').padEnd(7);
                        const liveTag = (t.url || '').toLowerCase().includes('websocket') ? ' [WS] ' : ' [SSE]';
                        const tag = t.isLongLived ? liveTag : '      ';
                        const col1part = `  \u21b3 `.padEnd(14);
                        const urlStr = (t.url || '').substring(0, 72).padEnd(72);
                        const restPart = `${method} ${elapsed} ${urlStr}${tag}`.padEnd(97);
                        process.stdout.write(`\x1b[36m┃\x1b[0m${tColor}${col1part}\x1b[36m┃\x1b[0m${tColor}${restPart}\x1b[0m\x1b[36m┃\x1b[0m\n`);
                    }
                }

                const fillerRows = MAX_TASKS_PER_WORKER - subRowsToRender;
                for (let fi = 0; fi < fillerRows; fi++) {
                    process.stdout.write(`\x1b[36m┃\x1b[0m${emptySubRow}\x1b[36m┃\x1b[0m\n`);
                }
            }
        });
        const footerRow = 9 + WORKER_SECTION_ROWS + PING_BOX_ROWS + MAX_LOGS;
        readline.cursorTo(process.stdout, 0, footerRow);
        readline.clearLine(process.stdout, 0);
        process.stdout.write(`\x1b[90m[${new Date().toLocaleTimeString()}] Target: ${INTERNAL_TARGET} | Mode: Dashboard | Feature: Cloudflare Tunnel V48\x1b[0m`);
    }

    function updateLogs() {
        if (isNoGui) return;
        const startLine = 7 + WORKER_SECTION_ROWS + PING_BOX_ROWS;
        logBuffer.forEach((log, i) => {
            readline.cursorTo(process.stdout, 0, startLine + i);
            const cleanMsg = log.replace(/\x1b\[[0-9;]*m/g, '');
            let finalLog = log;
            if (cleanMsg.length > 106) {
                const colorMatch = log.match(/^\x1b\[[0-9;]*m/);
                const prefix = colorMatch ? colorMatch[0] : '';
                finalLog = prefix + cleanMsg.substring(0, 103) + '...\x1b[0m';
            }
            const cleanLen = finalLog.replace(/\x1b\[[0-9;]*m/g, '').length;
            const padding = 110 - cleanLen;
            process.stdout.write(`\x1b[33m┃\x1b[0m ${finalLog}${' '.repeat(Math.max(0, padding))} \x1b[33m┃\x1b[0m`);
        });
    }

    function fmtPing(label, port, result) {
        const tag = `${label}:${port}`.padEnd(24).substring(0, 24);
        let resultStr;
        if (!result) resultStr = '  ---  ';
        else if (result.ok) resultStr = `${String(result.ms).padStart(4)}ms`;
        else resultStr = ' FAIL  ';
        resultStr = resultStr.padEnd(7);
        let colored;
        if (!result) colored = `\x1b[90m${resultStr}\x1b[0m`;
        else if (result.ok) colored = `\x1b[32m${resultStr}\x1b[0m`;
        else colored = `\x1b[31m${resultStr}\x1b[0m`;
        return `${tag} ${colored}`;
    }

    function updatePingBox() {
        if (isNoGui) return;
        const pingStartRow = 5 + WORKER_SECTION_ROWS;
        const fmtBw = (bps) => {
            const bits = bps * 8;
            if (bits >= 1000000) return `${(bits / 1000000).toFixed(2)} Mbps`;
            if (bits >= 1000) return `${(bits / 1000).toFixed(1)} Kbps`;
            return `${bits} bps`;
        };
        for (let row = 0; row < PING_BOX_ROWS; row++) {
            readline.cursorTo(process.stdout, 0, pingStartRow + row);
            if (row === PING_BOX_ROWS - 1) {
                const totalRx = Object.values(workerBytes).reduce((s, b) => s + b.rx, 0);
                const totalTx = Object.values(workerBytes).reduce((s, b) => s + b.tx, 0);
                const bwLine = ` \x1b[90mTRÁFICO PROXY\x1b[0m   \x1b[32m↓ RX: ${fmtBw(totalRx)}\x1b[0m   \x1b[33m↑ TX: ${fmtBw(totalTx)}\x1b[0m`;
                const bwVisible = bwLine.replace(/\x1b\[[0-9;]*m/g, '').length;
                const bwPad = Math.max(0, 111 - bwVisible);
                process.stdout.write(`\x1b[35m┃\x1b[0m${bwLine}${' '.repeat(bwPad)} \x1b[35m┃\x1b[0m`);
            } else {
                const li = row * 2, ri = row * 2 + 1;
                const le = li < PING_ENDPOINTS.length ? fmtPing(PING_ENDPOINTS[li][2], PING_ENDPOINTS[li][1], pingResults[PING_ENDPOINTS[li][0]]) : ' '.repeat(31);
                const re = ri < PING_ENDPOINTS.length ? fmtPing(PING_ENDPOINTS[ri][2], PING_ENDPOINTS[ri][1], pingResults[PING_ENDPOINTS[ri][0]]) : ' '.repeat(31);
                const inner = ` ${le} \x1b[90m│\x1b[0m ${re}`;
                const innerVisible = inner.replace(/\x1b\[[0-9;]*m/g, '').length;
                const pad = Math.max(0, 111 - innerVisible);
                process.stdout.write(`\x1b[35m┃\x1b[0m${inner}${' '.repeat(pad)} \x1b[35m┃\x1b[0m`);
            }
        }
    }

    function tcpPing(host, port) {
        return new Promise((resolve) => {
            const start = Date.now();
            const sock = new net.Socket();
            sock.setTimeout(5000);
            sock.on('connect', () => { resolve({ ok: true, ms: Date.now() - start }); sock.destroy(); });
            sock.on('error', () => { resolve({ ok: false, ms: -1 }); sock.destroy(); });
            sock.on('timeout', () => { resolve({ ok: false, ms: -1 }); sock.destroy(); });
            sock.connect(port, host);
        });
    }

    async function runAllPings() {
        await Promise.all(PING_ENDPOINTS.map(async ([host, port]) => {
            pingResults[host] = await tcpPing(host, port);
        }));
        updatePingBox();
    }

    if (!isNoGui) {
        drawLayout();
        process.stdout.on('resize', () => { drawLayout(); updateDashboard(); updatePingBox(); updateLogs(); });
        setInterval(updateDashboard, 1000);
    }

    addLog(`Maestro iniciado. Motor Cloudflare Tunnel V48 activo.`);
    runAllPings();
    setInterval(runAllPings, PING_INTERVAL_MS);

    for (let i = 0; i < numWorkers; i++) {
        const worker = cluster.fork();
        workersInfo[worker.process.pid] = { state: 'IDLE', totalReqs: 0, lastAction: 'Ready', elapsed: '0s', hbStatus: '-', tasks: [], lastUpdate: Date.now() };
    }

    cluster.on('message', (worker, msg) => {
        if (msg.type === 'status') {
            const pid = worker.process.pid;
            const current = workersInfo[pid] || {};
            const d = msg.data;
            d.lastUpdate = Date.now();
            workersInfo[pid] = { ...current, ...d };
            updateDashboard();
        } else if (msg.type === 'log') {
            addLog(`[W:${worker.process.pid}] ${msg.data}`);
        } else if (msg.type === 'bytes') {
            const pid = worker.process.pid;
            if (!workerBytes[pid]) workerBytes[pid] = { rx: 0, tx: 0 };
            workerBytes[pid].rx = msg.data.rx;
            workerBytes[pid].tx = msg.data.tx;
        }
    });

    // Limpiar workersInfo cuando un worker muere
    cluster.on('exit', (worker, code, signal) => {
        const pid = worker.process.pid;
        delete workersInfo[pid];
        delete workerBytes[pid];
        addLog(`⚠️ Worker ${pid} terminado (${signal || code}). Limpieza realizada.`);
        updateDashboard();
    });

} else {
    // ENGINE WORKER V48 (FILE GUARD EDITION) - CLOUDFLARE TUNNEL
    const proxyAgent = new https.Agent({ keepAlive: true, maxSockets: 1024, rejectUnauthorized: false });
    let totalReqs = 0;
    let secBytesRx = 0, secBytesTx = 0;

    function sendStatus(state, elapsed = '0s', hbStatus = '-', tasks = []) {
        process.send({ type: 'status', data: { state, totalReqs, elapsed, hbStatus, tasks } });
    }

    function log(msg) { process.send({ type: 'log', data: msg }); }

    function formatTime(sec) {
        if (sec < 60) return `${sec}s`;
        return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    }

    // Global timer + activeRequests Map (migrado de per-request para soportar task sub-rows)
    let reqCounter = 0;
    const activeRequests = new Map();

    setInterval(() => {
        const rxSnap = secBytesRx, txSnap = secBytesTx;
        secBytesRx = 0; secBytesTx = 0;
        process.send({ type: 'bytes', data: { rx: rxSnap, tx: txSnap } });

        const now = Date.now();
        const tasks = [];
        for (const [, r] of activeRequests) {
            const sec = Math.floor((now - r.startTime) / 1000);
            tasks.push({ url: r.url, method: r.method, elapsed: formatTime(sec), elapsedSec: sec, state: r.state, isLongLived: r.isLongLived, hbEligible: r.hbEligible });
        }
        const relevant = tasks.filter(t => !t.isLongLived);
        if (relevant.length === 0) {
            sendStatus('IDLE', '0s', '-', tasks);
            return;
        }
        const oldest = relevant.reduce((a, b) => b.elapsedSec > a.elapsedSec ? b : a);
        const maxSec = oldest.elapsedSec;
        let hbStatus;
        if (!oldest.hbEligible) {
            hbStatus = '---';
        } else if (maxSec < 55) {
            hbStatus = `T-${55 - maxSec}s`;
        } else {
            const iv = HB_INTERVAL_MS / 1000;
            hbStatus = `ON nxt:${iv - ((maxSec - 55) % iv)}s`;
        }
        sendStatus(oldest.state, formatTime(maxSec), hbStatus, tasks);
    }, 1000);

    const server = http.createServer((req, res) => {
        totalReqs++;
        const reqId = ++reqCounter;
        const startTime = Date.now();
        const urlPart = req.url.split('?')[0].toLowerCase();
        log(`\x1b[33m[IN] ${req.method} ${req.url}\x1b[0m`);
        req.on('data', c => { secBytesRx += c.length; });

        const isStatic = /\.(js|css|axd|ashx|png|jpg|gif|ico)$/.test(urlPart);
        const isGeneration = urlPart.includes('export') || urlPart.includes('download') || urlPart.includes('excel') || urlPart.includes('generar');
        const hbEligible = !isStatic && !req.headers['x-requested-with'] && !isGeneration;

        activeRequests.set(reqId, {
            startTime,
            url: req.url,
            method: req.method,
            state: 'TRABAJANDO',
            hbEligible,
            isLongLived: false
        });

        function doneRequest(action) {
            activeRequests.delete(reqId);
            const remaining = [...activeRequests.values()].filter(r => !r.isLongLived);
            if (remaining.length === 0) {
                const tasks = [...activeRequests.values()].map(r => ({
                    url: r.url, method: r.method,
                    elapsed: formatTime(Math.floor((Date.now() - r.startTime) / 1000)),
                    state: r.state, isLongLived: r.isLongLived
                }));
                sendStatus('IDLE', '0s', '-', tasks);
            }
        }

        let isHeartbeatActive = false;
        let hbTimer = null;

        const headers = { ...req.headers, 'host': INTERNAL_TARGET, 'accept-encoding': 'identity' };
        Object.keys(headers).forEach(h => { if (h.startsWith('cf-')) delete headers[h]; });

        const makeRequest = (reqPath) => {
            const proxyRequest = https.request({
                hostname: INTERNAL_TARGET, port: 443, path: reqPath, method: req.method, headers: headers, agent: proxyAgent
            }, (pRes) => {
                const sCode = pRes.statusCode;
                const cType = (pRes.headers['content-type'] || '').toLowerCase();
                const cEnc = (pRes.headers['content-encoding'] || '').toLowerCase();
                const cDisp = (pRes.headers['content-disposition'] || '').toLowerCase();

                // FILE GUARD
                const isFileDownload = cDisp.includes('attachment') ||
                                       cType.includes('spreadsheetml') ||
                                       cType.includes('excel') ||
                                       cType.includes('zip') ||
                                       cType.includes('pdf') ||
                                       cType.includes('octet-stream');

                if (isFileDownload && hbTimer) { clearTimeout(hbTimer); hbTimer = null; }
                const isRewritable = !isFileDownload && (
                    isHeartbeatActive ||
                    cType.includes('text/html') ||
                    cType.includes('javascript') ||
                    cType.includes('text/css') ||
                    urlPart.endsWith('.aspx') ||
                    urlPart.endsWith('.axd') ||
                    urlPart.endsWith('.ashx')
                );

                if (isRewritable) {
                    let chunks = [];
                    pRes.on('data', c => { chunks.push(c); secBytesTx += c.length; });
                    pRes.on('end', () => {
                        let buffer = Buffer.concat(chunks);

                        // MAGIC NUMBER CHECK
                        const isPK = buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
                        const isPDF = buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

                        if (isPK || isPDF) {
                            log(`\x1b[36m[GUARD] Binario detectado por firma (${isPK?'PK':'PDF'}), saltando reescritura.\x1b[0m`);
                            if (isHeartbeatActive) return serveAsBlobDownload(buffer, pRes.headers);
                            return sendProcessed(buffer, sCode, pRes.headers, true);
                        }

                        if (cEnc === 'gzip') {
                            zlib.gunzip(buffer, (err, decoded) => {
                                if (err) sendProcessed(buffer, sCode, pRes.headers);
                                else sendProcessed(decoded, sCode, pRes.headers);
                            });
                        } else {
                            sendProcessed(buffer, sCode, pRes.headers);
                        }
                    });
                } else {
                    if (isFileDownload && isHeartbeatActive) {
                        let fChunks = [];
                        pRes.on('data', c => { fChunks.push(c); secBytesTx += c.length; });
                        pRes.on('end', () => serveAsBlobDownload(Buffer.concat(fChunks), pRes.headers));
                    } else {
                        pRes.on('data', c => { secBytesTx += c.length; });
                        if (!res.headersSent) res.writeHead(sCode, pRes.headers);
                        pRes.pipe(res).on('finish', () => {
                            log(`\x1b[32m[OK] ${sCode} ${reqPath}${isFileDownload?' (Download)':''}\x1b[0m`);
                            doneRequest('finish');
                        });
                    }
                }

                function sendProcessed(dataBuffer, status, originalHeaders, forceSkipRe = false) {
                    if (!forceSkipRe) {
                        let text = dataBuffer.toString('utf8');
                        if (text.includes(INTERNAL_TARGET)) {
                            const escapedInternal = INTERNAL_TARGET.replace(/\./g, '\\.');
                            // URLs absolutas → root-relative
                            text = text.replace(new RegExp(`https?:\\/\\/${escapedInternal}`, 'g'), '');
                            text = text.replace(new RegExp(`\\/\\/${escapedInternal}`, 'g'), '');
                            // Hostname bare → PUBLIC_HOST
                            text = text.replace(new RegExp(INTERNAL_TARGET, 'g'), PUBLIC_HOST);
                            dataBuffer = Buffer.from(text, 'utf8');
                        }
                    }
                    if (!res.headersSent) {
                        const finalHeaders = { ...originalHeaders };
                        delete finalHeaders['content-encoding'];
                        delete finalHeaders['content-length'];
                        if (forceSkipRe && !finalHeaders['content-type'].includes('spreadsheetml')) {
                            if (dataBuffer[0] === 0x50 && dataBuffer[1] === 0x4B)
                                finalHeaders['content-type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        }
                        res.writeHead(status, finalHeaders);
                    }
                    res.end(dataBuffer);
                    log(`\x1b[32m[OK] ${status} ${reqPath} (Data Shield)\x1b[0m`);
                    doneRequest('processed');
                }

                function serveAsBlobDownload(dataBuffer, originalHeaders) {
                    let mimeType = (originalHeaders['content-type'] || '').split(';')[0].trim() || 'application/octet-stream';
                    if (mimeType === 'application/octet-stream') {
                        if (dataBuffer[0] === 0x50 && dataBuffer[1] === 0x4B)
                            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        else if (dataBuffer[0] === 0x25 && dataBuffer[1] === 0x50)
                            mimeType = 'application/pdf';
                    }
                    const dispMatch = (originalHeaders['content-disposition'] || '').match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    const filename = (dispMatch ? dispMatch[1].replace(/["']/g, '') : 'archivo.xlsx').replace(/[<>\\/]/g, '');
                    const b64 = dataBuffer.toString('base64');
                    const referer = req.headers['referer'] || '';
                    const backUrl = JSON.stringify(referer.includes(PUBLIC_HOST) ? referer : '/');
                    const script = `--><script>(function(){try{var d=atob('${b64}'),u=new Uint8Array(d.length);for(var i=0;i<d.length;i++)u[i]=d.charCodeAt(i);var bl=new Blob([u],{type:'${mimeType}'}),url=URL.createObjectURL(bl),a=document.createElement('a');a.href=url;a.download='${filename}';document.body.appendChild(a);a.click();document.querySelector('.c').innerHTML='<h3>&#10004; Descarga iniciada: ${filename}</h3><p>Volviendo...</p>';setTimeout(function(){window.location.replace(${backUrl});},3000);}catch(e){document.querySelector('.c').innerHTML='Error: '+e.message;}})()\x3c/script>`;
                    if (!res.writableEnded) { res.write(script); res.end(); }
                    log(`\x1b[35m[HB-BLOB] ${Math.round(dataBuffer.length / 1024)}KB via JS Blob: ${filename}\x1b[0m`);
                    doneRequest('blob');
                }
            });

            proxyRequest.on('error', (e) => {
                log(`\x1b[31m[ERROR] ${e.message} ${reqPath}\x1b[0m`);
                doneRequest('ERROR');
                if (!res.headersSent) { res.writeHead(502); res.end(); }
            });
            req.pipe(proxyRequest);
        };

        if (hbEligible) {
            hbTimer = setTimeout(() => {
                if (!res.headersSent) {
                    isHeartbeatActive = true;
                    if (activeRequests.has(reqId)) activeRequests.get(reqId).state = 'LATIDO ON';
                    log(`\x1b[35m[HB] Shield Active p/ ${req.url}\x1b[0m`);
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Transfer-Encoding': 'chunked' });
                    res.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div class="c"><h3>&#9203; Procesando...</h3><p>Los datos se están generando en el servidor.</p></div><!--');
                    const hbInterval = setInterval(() => { if (!res.writableEnded) res.write(' '); }, HB_INTERVAL_MS);
                    res.on('close', () => { clearInterval(hbInterval); activeRequests.delete(reqId); });
                }
            }, HB_FIRST_PULSE_MS);
            res.on('close', () => { clearTimeout(hbTimer); activeRequests.delete(reqId); });
        }
        makeRequest(req.url);
    });
    server.listen(PROXY_PORT, '0.0.0.0');
}
