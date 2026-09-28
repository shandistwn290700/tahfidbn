const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const BUN = process.env.BUN_PATH || path.join(process.env.HOME || '', '.bun/bin/bun');
const INNER_PORT = 3101;

const child = spawn(BUN, ['run', 'start'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(INNER_PORT), NODE_ENV: 'production' },
  stdio: 'inherit',
});
child.on('error', (e) => { console.error('Gagal menjalankan Bun:', e.message); process.exit(1); });
child.on('exit', (code) => process.exit(code || 1));
process.on('SIGTERM', () => child.kill());

http.createServer((req, res) => {
  const proxy = http.request(
    { host: '127.0.0.1', port: INNER_PORT, path: req.url, method: req.method, headers: req.headers },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }
  );
  proxy.on('error', () => { res.statusCode = 503; res.end('Aplikasi sedang menyala, coba lagi sebentar.'); });
  req.pipe(proxy);
}).listen(process.env.PORT || 3000);
