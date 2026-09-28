const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const BUN = process.env.BUN_PATH || path.join(process.env.HOME || '', '.bun/bin/bun');
const OUTER_PORT = parseInt(process.env.PORT || '3000', 10);
let innerPort = 0;

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

function startApp() {
  freePort((p) => {
    innerPort = p;
    console.error('[wrapper] port luar=' + OUTER_PORT + ' port dalam=' + innerPort);
    const child = run(['run', 'start'], { PORT: String(innerPort), NODE_ENV: 'production' }, (code, sig) => {
      console.error('[wrapper] Bun berhenti. kode=' + code + ' sinyal=' + sig);
      process.exit(code || 1);
    });
    process.on('SIGTERM', () => child.kill());
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
  if (!innerPort) { res.statusCode = 503; return res.end('Aplikasi sedang menyala, coba lagi sebentar.'); }
  const proxy = http.request(
    { host: 'localhost', port: innerPort, path: req.url, method: req.method, headers: req.headers },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }
  );
  proxy.on('error', (e) => {
    console.error('[wrapper] proxy gagal ke port ' + innerPort + ': ' + e.code + ' ' + e.message);
    if (!res.headersSent) { res.statusCode = 503; res.end('Aplikasi sedang menyala, coba lagi sebentar.'); }
  });
  req.pipe(proxy);
}).listen(OUTER_PORT, prepare);
