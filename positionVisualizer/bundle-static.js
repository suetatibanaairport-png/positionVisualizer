// bundle-static.js
// 静的ファイルをスキャンして、リソースバンドルを作成するスクリプト

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM環境では__dirnameが使えないので代替手段を使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ソースディレクトリ (HTML/CSS/JSがある場所)
const sourceDir = path.join(__dirname, 'dist');

// 出力ファイル - http-server.jsがインポートする
const outputFile = path.join(__dirname, 'dist', 'bundled-resources.js');

// 含めるファイル拡張子
const extensions = [
  '.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg',
  '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'
];

// テキストファイル拡張子（それ以外はバイナリとして扱う）
const textExtensions = ['.html', '.css', '.js', '.json', '.svg', '.txt', '.md'];

// ディレクトリを再帰的にスキャンしてファイルを見つける関数
function scanDirectory(dir, baseDir, result = {}) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

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

// 出力ファイルの生成開始
let outputContent = `// 自動生成されたリソースバンドル - 編集しないでください
// 生成日時: ${new Date().toISOString()}

// このファイルには、すべての静的リソースが文字列またはbase64データとして埋め込まれています

const resources = {
`;

// 各ファイルを処理
Object.entries(files).forEach(([relativePath, fullPath]) => {
  const ext = path.extname(relativePath).toLowerCase();
  const isText = textExtensions.includes(ext);

  console.log(`処理中: ${relativePath} (${isText ? 'テキスト' : 'バイナリ'})`);

  if (isText) {
    // テキストファイルは文字列として埋め込む
    try {
      let content = fs.readFileSync(fullPath, 'utf8')
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\${/g, '\\${');

      outputContent += `  "${relativePath}": \`${content}\`,\n`;
    } catch (err) {
      console.error(`ファイル読み込みエラー ${relativePath}:`, err);
    }
  } else {
    // バイナリファイルはbase64としてエンコード
    try {
      const content = fs.readFileSync(fullPath).toString('base64');
      outputContent += `  "${relativePath}": { base64: "${content}" },\n`;
    } catch (err) {
      console.error(`ファイル読み込みエラー ${relativePath}:`, err);
    }
  }
});

// リソースオブジェクトを閉じる
outputContent += `};\n\n`;

// ヘルパー関数の追加
outputContent += `// MIMEタイプのマッピング
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

// パスに対するMIMEタイプを取得
function getMimeType(path) {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

// リソースをUint8Arrayとして取得
function getResource(path) {
  // 先頭のスラッシュを削除し、正規化
  path = path.startsWith('/') ? path.substring(1) : path;

  // 空のパスまたはルートはindex.htmlにデフォルト
  if (path === '' || path === '/') {
    path = 'index.html';
  }

  // リソースを取得
  const resource = resources[path];

  if (!resource) {
    return null;
  }

  // タイプに基づいてUint8Arrayに変換
  if (typeof resource === 'string') {
    // テキストリソース
    return new TextEncoder().encode(resource);
  } else if (resource.base64) {
    // バイナリリソース（base64エンコード）
    const binary = atob(resource.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return null;
}

// 利用可能なすべてのリソースをリスト
function listResources() {
  return Object.keys(resources);
}

export {
  resources,
  getResource,
  getMimeType,
  listResources
};
`;

// 出力ファイルに書き込み
fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(`リソースバンドルファイルを生成しました: ${outputFile}`);