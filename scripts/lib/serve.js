// Static file server for dist/ (dev + lighthouse). Serves 404.html for unknown paths.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
};

export function serve(dir, port) {
  // Normalise so the containment check below compares like with like on Windows.
  const root = path.resolve(dir);
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, urlPath);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const s = await stat(file);
      if (s.isDirectory()) {
        if (!urlPath.endsWith('/')) {
          res.writeHead(301, { Location: urlPath + '/' }).end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      const body = await readFile(file);
      // no-store: a local server must never hand the browser a stale script after a rebuild.
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      try {
        const body = await readFile(path.join(root, '404.html'));
        res.writeHead(404, { 'Content-Type': TYPES['.html'] });
        res.end(body);
      } catch {
        res.writeHead(404).end('Not found');
      }
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
