const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const BUN = process.env.BUN_PATH || path.join(process.env.HOME || '', '.bun/bin/bun');
const OUTER_PORT = parseInt(process.env.PORT || '3000', 10);
let innerPort = 0;
let innerHost = null;

function log(prefix, data) {
  String(data).split('\n').filter(Boolean).forEach((l) => console.error(prefix + ' ' + l));
}

function run(args, extraEnv, onExit) {
  const c = spawn(BUN, args, { cwd: __dirname, env: { ...process.env, ...extraEnv } });
  c.stdout.on('data', (d) => log('[bun]', d));
  c.stderr.on('data', (d) => log('[bun]', d));
  c.on('error', (e) => { console.error('[wrapper] Gagal menjalankan Bun:', e.message); process.exit(1); });
  c.on('exit', onExit);
  return c;
}

function freePort(cb) {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => cb(p)); });
}

function probe(host) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port: innerPort, family: host.includes(':') ? 6 : 4 });
    s.setTimeout(3000);
    s.on('connect', () => { s.destroy(); resolve(null); });
    s.on('timeout', () => { s.destroy(); resolve('TIMEOUT'); });
    s.on('error', (e) => resolve(e.code || e.message));
  });
}

async function waitForApp() {
  for (let i = 0; i < 20 && !innerHost; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    for (const h of ['127.0.0.1', '::1']) {
      const err = await probe(h);
      console.error('[wrapper] probe ' + h + ':' + innerPort + ' -> ' + (err || 'OK'));
      if (!err) { innerHost = h; break; }
    }
  }
  if (!innerHost) console.error('[wrapper] Bun tidak bisa dijangkau di alamat mana pun');
}

function startApp() {
  freePort((p) => {
    innerPort = p;
    console.error('[wrapper] port luar=' + OUTER_PORT + ' port dalam=' + innerPort);
    const child = run(['run', 'start'], { PORT: String(innerPort), NODE_ENV: 'production' }, (code, sig) => {
      console.error('[wrapper] Bun berhenti. kode=' + code + ' sinyal=' + sig);
      process.exit(code || 1);
    });
    process.on('SIGTERM', () => child.kill());
    waitForApp();
  });
}

function prepare() {
  if (fs.existsSync(path.join(__dirname, 'node_modules'))) return startApp();
  console.error('[wrapper] node_modules belum ada, menjalankan bun install...');
  run(['install'], {}, (code) => {
    if (code !== 0) { console.error('[wrapper] bun install gagal, kode=' + code); process.exit(1); }
    startApp();
  });
}

http.createServer((req, res) => {
  const wait = () => { if (!res.headersSent) { res.statusCode = 503; res.end('Aplikasi sedang menyala, coba lagi sebentar.'); } };
  if (!innerHost) return wait();
  const proxy = http.request(
    { host: innerHost, family: innerHost.includes(':') ? 6 : 4, port: innerPort, path: req.url, method: req.method, headers: req.headers },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }
  );
  proxy.on('error', (e) => { console.error('[wrapper] proxy gagal ke ' + innerHost + ':' + innerPort + ': ' + (e.code || e.message)); wait(); });
  req.pipe(proxy);
}).listen(OUTER_PORT, prepare);
