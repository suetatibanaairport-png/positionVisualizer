// Simple HTTP server for serving static files from bundled resources
// Used by positionVisualizer to serve HTML/CSS/JS files

const http = require('http');
const path = require('path');
const url = require('url');

// Import bundled resources
let resources;
try {
  resources = require('./bundled-resources.js');
  console.log('バンドルリソースを読み込みました');
} catch (err) {
  console.warn('バンドルリソースの読み込みに失敗しました:', err.message);
  console.warn('ファイルシステムからの読み込みにフォールバックします');
  resources = null;
}

const fs = require('fs');

const PORT = Number(process.env.HTTP_PORT || 8000);
const HOST = process.env.HTTP_HOST || '127.0.0.1';

// コンパイル後のバイナリでは、ファイルは同じディレクトリにある
const baseDir = __dirname;

// バンドルリソース情報
if (resources) {
  console.log(`バンドルリソース利用可能: ${resources.listResources().length}ファイル`);
} else {
  try {
    fs.accessSync(baseDir, fs.constants.R_OK);
    const files = fs.readdirSync(baseDir);
    if (files.includes('index.html')) {
      console.log('index.html が見つかりました');
    } else {
      console.warn('警告: index.html が見つかりません');
    }
  } catch (err) {
    console.error(`ベースディレクトリへのアクセスエラー: ${err.message}`);
  }
}

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

// バンドルリソースから配信
function serveFromBundle(pathname, res) {
  try {
    const mimeType = resources.getMimeType(pathname);
    const resource = resources.getResource(pathname);

    if (!resource) {
      console.error(`リソースが見つかりません: ${pathname}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // console.log(`バンドルから配信: ${pathname}, MIME: ${mimeType}, サイズ: ${resource.length} バイト`);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(resource);
  } catch (error) {
    console.error(`バンドルリソース取得エラー: ${pathname}`, error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
}

// ファイルシステムから配信
function serveFile(filePath, res) {
  const mimeType = getMimeType(filePath);
  // console.log(`ファイルから配信: ${filePath}, MIME: ${mimeType}`);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`ファイル読み込みエラー (${filePath}):`, err.message);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // console.log(`ファイル読み込み成功: ${filePath}, サイズ: ${data.length} バイト`);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Default to index.html for root
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // console.log(`リクエスト: ${pathname}`);

  // バンドルリソースがある場合、そこから配信
  if (resources) {
    serveFromBundle(pathname, res);
    return;
  }

  // バンドルがない場合はファイルシステムから
  // Remove leading slash and resolve path
  const filePath = path.join(baseDir, pathname);

  // Security: ensure file is within baseDir
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(baseDir))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    serveFile(filePath, res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`HTTP server listening on http://${HOST}:${PORT}`);
  if (resources) {
    console.log(`バンドルリソースから配信中 (ファイルシステムアクセスなし)`);
  } else {
    console.log(`Serving files from: ${baseDir}`);
  }
});

// サーバーのエラーハンドリングを強化
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ポート ${PORT} は既に使用されています。`);
    console.error(`別のポートを試します...`);

    // 別のポートを試す
    server.close();
    const newPort = PORT + 1;
    server.listen(newPort, HOST, () => {
      console.log(`代替ポート ${newPort} で起動しました: http://${HOST}:${newPort}`);
      console.log(`環境変数 HTTP_PORT=${newPort} を設定することで、このポートを永続的に使用できます`);
    });
  } else {
    console.error('サーバーエラー詳細:', err);
    // 終了せずにエラーをログ
    console.error('サーバー起動に失敗しましたが、処理を継続します');
  }
});