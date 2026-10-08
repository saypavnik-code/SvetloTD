// Dependency-free static HTML5 game server for Bitrix24 Vibe runtime.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT ?? 3000);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return;
  }
  const file = resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end(); return;
  }
  try {
    const target = (await stat(file)).isDirectory() ? resolve(file, 'index.html') : file;
    const data = await readFile(target);
    res.writeHead(200, {
      'Content-Type': mime[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': extname(target) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '0.0.0.0', () => console.log(`Game ready on ${port}`));
