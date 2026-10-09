// ==============================================================================
// RouteWise — Secure Local Dev Server
// Hardened with HTTP Security Headers, Path Traversal Guards, and Generic Errors
// ==============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT_DIR = path.resolve(__dirname);

// Allowed public static asset extensions
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Disallowed internal files and extensions
const FORBIDDEN_PATTERNS = [
  /^\/\.git/,
  /^\/\.env/,
  /package\.json$/,
  /package-lock\.json$/,
  /server\.js$/,
  /schema\.sql$/
];

const server = http.createServer((req, res) => {
  const correlationId = crypto.randomUUID().slice(0, 8);

  // Security Headers applied to every response (Pre-Deploy Production Checks #3)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: https://images.unsplash.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  // Method restriction
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const rawUrl = req.url || '/';
  const cleanPath = decodeURIComponent(rawUrl.split('?')[0]);
  const requestedPath = cleanPath === '/' ? '/index.html' : cleanPath;

  // Block internal/sensitive files
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(requestedPath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end(`403 Forbidden [Ref: ${correlationId}]`);
      return;
    }
  }

  // Prevent Path Traversal (Section 5: Internal Exposure & Path Injection)
  const resolvedPath = path.resolve(path.join(ROOT_DIR, requestedPath));
  if (!resolvedPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end(`403 Forbidden [Ref: ${correlationId}]`);
    return;
  }

  fs.stat(resolvedPath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found [Ref: ${correlationId}]`);
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const readStream = fs.createReadStream(resolvedPath);
    readStream.on('error', () => {
      // Client-facing error: Generic message + correlation ID only (No stack traces)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end(`Internal Server Error [Error ID: ${correlationId}]`);
    });
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`RouteWise hardened server running at http://localhost:${PORT}`);
});
