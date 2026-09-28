const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BUN = process.env.BUN_PATH || path.join(process.env.HOME || '', '.bun/bin/bun');
const INNER_PORT = 3101;

function startApp() {
  const child = spawn(BUN, ['run', 'start'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(INNER_PORT), NODE_ENV: 'production' },
    stdio: 'inherit',
  });
  child.on('error', (e) => { console.error('[wrapper] Gagal menjalankan Bun:', e.message); process.exit(1); });
  child.on('exit', (code, sig) => { console.error('[wrapper] Bun berhenti. kode=' + code + ' sinyal=' + sig); process.exit(code || 1); });
  process.on('SIGTERM', () => child.kill());
}

function prepare() {
  if (fs.existsSync(path.join(__dirname, 'node_modules'))) return startApp();
  console.log('[wrapper] node_modules belum ada, menjalankan bun install...');
  const inst = spawn(BUN, ['install'], { cwd: __dirname, stdio: 'inherit' });
  inst.on('error', (e) => { console.error('[wrapper] bun install gagal:', e.message); process.exit(1); });
  inst.on('exit', (code) => {
    if (code !== 0) { console.error('[wrapper] bun install keluar dengan kode', code); process.exit(1); }
    startApp();
  });
}

http.createServer((req, res) => {
  const proxy = http.request(
    { host: '127.0.0.1', port: INNER_PORT, path: req.url, method: req.method, headers: req.headers },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }
  );
  proxy.on('error', () => { res.statusCode = 503; res.end('Aplikasi sedang menyala, coba lagi sebentar.'); });
  req.pipe(proxy);
}).listen(process.env.PORT || 3000, prepare);
