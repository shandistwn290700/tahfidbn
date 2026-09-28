const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUN = process.env.BUN_PATH || path.join(process.env.HOME || '', '.bun/bin/bun');
const PORT = process.env.PORT || '3000';

function log(prefix, data) {
  String(data).split('\n').filter(Boolean).forEach((l) => console.error(prefix + ' ' + l));
}

function run(args, extraEnv, onExit) {
  const c = spawn(BUN, args, { cwd: __dirname, env: { ...process.env, ...extraEnv } });
  c.stdout.on('data', (d) => log('[bun]', d));
  c.stderr.on('data', (d) => log('[bun]', d));
  c.on('error', (e) => { console.error('[launcher] Gagal menjalankan Bun:', e.message); process.exit(1); });
  c.on('exit', onExit);
  return c;
}

function start() {
  console.error('[launcher] env PORT=' + process.env.PORT + ', Bun akan memakai port ' + PORT);
  const child = run(['run', 'start'], { PORT, NODE_ENV: 'production' }, (code, sig) => {
    console.error('[launcher] Bun berhenti. kode=' + code + ' sinyal=' + sig);
    process.exit(code || 1);
  });
  process.on('SIGTERM', () => child.kill());
}

if (fs.existsSync(path.join(__dirname, 'node_modules'))) {
  start();
} else {
  console.error('[launcher] node_modules belum ada, menjalankan bun install...');
  run(['install'], {}, (code) => {
    if (code !== 0) { console.error('[launcher] bun install gagal, kode=' + code); process.exit(1); }
    start();
  });
}
