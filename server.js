'use strict';
/**
 * Локальный сервер приложения — без внешних зависимостей.
 * Раздаёт статику (public/) и общие модули (src/), ничего не обрабатывая на своей стороне:
 * конвертация целиком выполняется в браузере пользователя.
 *
 * Запуск:  node server.js [--port 5173] [--host 127.0.0.1] [--open]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SRC_DIR = path.join(ROOT, 'src');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8'
};

function parseArgs(argv) {
  const options = { port: Number(process.env.PORT) || 5173, host: process.env.HOST || '127.0.0.1', open: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' || arg === '-p') options.port = Number(argv[++i]);
    else if (arg === '--host') options.host = argv[++i];
    else if (arg === '--open') options.open = true;
  }
  return options;
}

/** Отдаём только из public/ и src/ — никакого выхода за пределы проекта. */
function resolveRequest(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  if (clean === '/' || clean === '') return path.join(PUBLIC_DIR, 'index.html');
  if (clean.startsWith('/src/')) return safeJoin(SRC_DIR, clean.slice('/src/'.length));
  if (clean.startsWith('/public/')) return safeJoin(PUBLIC_DIR, clean.slice('/public/'.length));
  return safeJoin(PUBLIC_DIR, clean.replace(/^\//, ''));
}

function safeJoin(base, relative) {
  const target = path.resolve(base, relative);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

const options = parseArgs(process.argv.slice(2));

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Method Not Allowed');
    return;
  }

  const filePath = resolveRequest(request.url || '/');
  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Порт ${options.port} уже занят. Запустите с другим портом: node server.js --port ${options.port + 1}`);
    process.exit(1);
  }
  throw error;
});

server.listen(options.port, options.host, () => {
  const url = `http://${options.host}:${options.port}/`;
  console.log('');
  console.log('  Telegram → GeminiNotebook (локальная версия)');
  console.log(`  ${url}`);
  console.log('');
  console.log('  Данные не покидают браузер. Остановить — Ctrl+C.');
  console.log('');
  if (options.open) openBrowser(url);
});

function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    exec(`${command} ${url}`, () => {});
  } catch (error) {
    /* не критично */
  }
}
