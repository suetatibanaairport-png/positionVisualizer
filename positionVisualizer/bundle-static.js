// bundle-static-simple.js
// 静的ファイルをバンドルして、より単純なhttp-serverを生成する

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM環境では__dirnameが使えないので代替手段を使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ソースディレクトリ (HTML/CSS/JSがある場所)
const sourceDir = path.join(__dirname, 'dist');

// 出力ファイル
const outputFile = path.join(__dirname, 'dist', 'http-server.js');

// 含めるファイル拡張子
const extensions = [
  '.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg',
  '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'
];

// テキストファイル拡張子（それ以外はバイナリとして扱う）
const textExtensions = ['.html', '.css', '.js', '.json', '.svg', '.txt', '.md'];

// 除外するファイル名
const excludeFiles = ['bundled-resources.js', 'bundled-resources.js.map', 'http-server.js', 'http-server.js.map'];

// ディレクトリを再帰的にスキャンしてファイルを見つける関数
function scanDirectory(dir, baseDir, result = {}) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    // 指定されたファイルを除外
    if (excludeFiles.includes(entry.name)) {
      console.log(`除外: ${entry.name}`);
      continue;
    }

    // node_modules, .git, toolsディレクトリはスキップ
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'tools', 'logs', 'json'].includes(entry.name)) {
        scanDirectory(fullPath, baseDir, result);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        result[relativePath] = fullPath;
      }
    }
  }

  return result;
}

console.log('静的ファイルをスキャン中:', sourceDir);
const files = scanDirectory(sourceDir, sourceDir);
console.log('バンドル対象ファイル数:', Object.keys(files).length);

// ファイル内容をロードし、データオブジェクトを作成
const fileContents = {};
Object.entries(files).forEach(([relativePath, fullPath]) => {
  const ext = path.extname(relativePath).toLowerCase();
  const isText = textExtensions.includes(ext);

  console.log(`処理中: ${relativePath} (${isText ? 'テキスト' : 'バイナリ'})`);

  try {
    if (isText) {
      // テキストファイルはUTF-8で読み込み
      fileContents[relativePath] = {
        content: fs.readFileSync(fullPath, 'utf8'),
        binary: false
      };
    } else {
      // バイナリファイルはBase64で格納
      fileContents[relativePath] = {
        content: fs.readFileSync(fullPath).toString('base64'),
        binary: true
      };
    }
  } catch (err) {
    console.error(`ファイル読み込みエラー ${relativePath}:`, err);
  }
});

// ファイルコンテンツをJSON文字列に変換
const fileContentsJSON = JSON.stringify(fileContents, null, 2);

// MIMEタイプマッピングを用意
const mimeTypesMap = {
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

// 単純化したHTTPサーバーコードを生成
// コンパイル環境でも動作するようにimport.meta.urlの使用を避ける
const httpServerCode = `// 自動生成されたバンドルHTTPサーバー
// 生成日時: ${new Date().toISOString()}

import http from 'http';
import path from 'path';
import fs from 'fs';

// Configuration loader (inlined)
function loadConfig() {
  const searchPaths = [
    path.join(process.cwd(), 'config.json'),
    path.join(process.cwd(), '..', 'config.json'),
    path.join(process.cwd(), '..', '..', 'config.json'),
  ];

  if (process.execPath) {
    const execDir = path.dirname(process.execPath);
    searchPaths.push(
      path.join(execDir, 'config.json'),
      path.join(execDir, '..', 'config.json'),
      path.join(execDir, '..', '..', 'config.json')
    );
  }

  for (const configPath of searchPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        console.log(\`[Config] Loaded from: \${configPath}\`);
        return config;
      } catch (error) {
        console.error(\`[Config] Failed to parse \${configPath}: \${error.message}\`);
      }
    }
  }

  console.log('[Config] No config.json found, using defaults');
  return {};
}

// 実行環境の判定
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const isBun = typeof process !== 'undefined' && process.argv[0] && (
  process.argv[0].includes('bun') ||
  process.argv[0].includes('bunx')
);
const isCompiled = process.argv[0] && (
  process.argv[0].includes('LeverHTTP') ||
  (typeof process.execPath === 'string' && !process.execPath.includes('node') && !process.execPath.includes('bun'))
);

console.log(\`実行環境: \${isNode ? 'Node.js' : isBun ? 'Bun' : process.argv[0] || '不明'}\`);
console.log(\`コンパイル済み判定: \${isCompiled}\`);
console.log(\`バンドルモード: true\`);

// Load configuration
const config = loadConfig();
const PORT = Number(config.http?.port || process.env.HTTP_PORT || 8000);
const BIND = config.http?.bind || process.env.HTTP_BIND || '0.0.0.0';

// バンドルされた静的ファイル
const BUNDLED_FILES = ${fileContentsJSON};

// MIMEタイプマッピング
const BUNDLED_MIME_TYPES = ${JSON.stringify(mimeTypesMap, null, 2)};

// パスに対するMIMEタイプを取得
function getMimeType(path) {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  return BUNDLED_MIME_TYPES[ext] || 'application/octet-stream';
}

// リソースを取得する関数
function getResource(path) {
  // 先頭のスラッシュを削除し、正規化
  path = path.startsWith('/') ? path.substring(1) : path;

  // 空のパスまたはルートはindex.htmlにデフォルト
  if (path === '' || path === '/') {
    path = 'index.html';
  }

  // リソースを取得
  const resource = BUNDLED_FILES[path];

  if (!resource) {
    return null;
  }

  // バイナリかどうかに基づいてデータを変換
  if (resource.binary) {
    // Base64からUint8Arrayに変換
    const binary = atob(resource.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else {
    // テキストはUint8Arrayにエンコード
    return new TextEncoder().encode(resource.content);
  }
}

// バンドルリソースから配信
function serveFromBundle(pathname, res) {
  try {
    const mimeType = getMimeType(pathname);
    const resource = getResource(pathname);

    if (!resource) {
      console.error(\`リソースが見つかりません: \${pathname}\`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(resource);
  } catch (error) {
    console.error(\`バンドルリソース取得エラー: \${pathname}\`, error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
}

// メイン処理
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
  const parsedUrl = new URL(req.url, \`http://\${HOST}:\${PORT}\`);
  let pathname = parsedUrl.pathname;

  // Default to index.html for root
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // バンドルリソースから配信
  serveFromBundle(pathname.startsWith('/') ? pathname.substring(1) : pathname, res);
});

server.listen(PORT, BIND, () => {
  console.log(\`HTTP server listening on http://\${BIND}:\${PORT}\`);
  console.log(\`バンドルリソースから配信中 (ファイルシステムアクセスなし)\`);
});

// サーバーのエラーハンドリングを強化
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\`ポート \${PORT} は既に使用されています。\`);
    console.error(\`別のポートを試します...\`);

    // 別のポートを試す
    server.close();
    const newPort = PORT + 1;
    server.listen(newPort, BIND, () => {
      console.log(\`代替ポート \${newPort} で起動しました: http://\${BIND}:\${newPort}\`);
      console.log(\`環境変数 HTTP_PORT=\${newPort} を設定することで、このポートを永続的に使用できます\`);
    });
  } else {
    console.error('サーバーエラー詳細:', err);
    // 終了せずにエラーをログ
    console.error('サーバー起動に失敗しましたが、処理を継続します');
  }
});
`;

// 出力ファイルに書き込み
fs.writeFileSync(outputFile, httpServerCode, 'utf8');
console.log(`静的リソースをインライン化したHTTPサーバーを生成しました: ${outputFile}`);