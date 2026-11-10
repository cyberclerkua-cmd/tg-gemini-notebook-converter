'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const PORT = 51234;

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    }).on('error', reject);
  });
}

test('локальный сервер отдаёт интерфейс и общие модули', async (t) => {
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js'), '--port', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore'
  });
  t.after(() => server.kill());

  const base = `http://127.0.0.1:${PORT}`;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await get(base + '/');
      break;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const index = await get(base + '/');
  assert.strictEqual(index.status, 200);
  assert.ok(index.body.includes('Telegram'));
  assert.ok(index.body.includes('GeminiNotebook'));

  const script = await get(base + '/src/core.js');
  assert.strictEqual(script.status, 200);
  assert.ok(script.headers['content-type'].startsWith('text/javascript'));

  const css = await get(base + '/styles.css');
  assert.strictEqual(css.status, 200);

  const missing = await get(base + '/nope.html');
  assert.strictEqual(missing.status, 404);
});

test('CLI конвертирует result.json в .md и ZIP', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg2md-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'result.json');
  fs.writeFileSync(input, JSON.stringify({
    name: 'CLI чат',
    type: 'personal_chat',
    messages: [
      { id: 1, type: 'message', date: '2021-05-06T12:00:00', from: 'Иван', text: 'Первое' },
      { id: 2, type: 'message', date: '2021-05-06T12:01:00', from: 'Иван', text: 'Второе' }
    ]
  }), 'utf8');

  await new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(ROOT, 'bin', 'tg2md.js'), input, '-o', path.join(dir, 'out'), '--words', '100000'], (error, stdout) => {
      if (error) reject(error);
      else {
        assert.ok(stdout.includes('CLI чат'));
        resolve();
      }
    });
  });

  const outDir = path.join(dir, 'out');
  const files = fs.readdirSync(outDir);
  assert.ok(files.includes('CLI_чат_part_001.md'), files.join(','));
  assert.ok(files.includes('CLI_чат.zip'), files.join(','));

  const md = fs.readFileSync(path.join(outDir, 'CLI_чат_part_001.md'), 'utf8');
  assert.ok(md.startsWith('# CLI чат\nЧасть 1 из 1\n\n---\n\n'));
  assert.ok(md.includes('**#1** **Иван**'));
  assert.ok(md.includes('Первое'));
});
