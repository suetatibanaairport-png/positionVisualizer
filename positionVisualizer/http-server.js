// 統合型 HTTP サーバー for serving static files
// Used by positionVisualizer to serve HTML/CSS/JS files
// 環境変数 BUNDLE_MODE でバンドルモードとファイルシステムモードを切り替え可能

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';

// 実行環境の判定を強化
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const isBun = typeof process !== 'undefined' && process.argv[0] && (
  process.argv[0].includes('bun') ||
  process.argv[0].includes('bunx')
);
// コンパイル後の実行ファイルでは常にバンドルモードを使用
const isCompiled = process.argv[0] && (
  process.argv[0].includes('LeverHTTP') ||
  (typeof process.execPath === 'string' && !process.execPath.includes('node') && !process.execPath.includes('bun'))
);
const BUNDLE_MODE = true; // 常にバンドルモードを使用（デバッグのため）
console.log(`実行環境: ${isNode ? 'Node.js' : isBun ? 'Bun' : process.argv[0] || '不明'}`);
console.log(`コンパイル済み判定: ${isCompiled}`);
console.log(`バンドルモード: ${BUNDLE_MODE}`);

const PORT = Number(process.env.HTTP_PORT || 8000);
const HOST = process.env.HTTP_HOST || '127.0.0.1';

// ESM環境では__dirnameが使えないので代替手段を使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// コンパイル後のバイナリでは、ファイルは同じディレクトリにある必要がある
const baseDir = __dirname;

// MIME typesマッピング
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

// メインの非同期関数でラップ
const main = async () => {
  // バンドルリソース
  let resources = null;

  // バンドルモードの場合、リソースを読み込む
  if (BUNDLE_MODE) {
    try {
      console.log('バンドルモードでリソース読み込み開始');

      // 実行ファイルのディレクトリを確実に取得
      let execDir = '';
      if (typeof process.execPath === 'string') {
        execDir = path.dirname(process.execPath);
      } else if (process.argv && process.argv[0]) {
        execDir = path.dirname(process.argv[0]);
      }

      // アプリケーションバンドルのルートディレクトリを特定するためのロジック
      let appRootDir = '';
      if (isCompiled) {
        // コンパイル済み実行ファイルの場合、execDirをルートとして使用
        appRootDir = execDir;
        // Macアプリバンドルの構造を考慮（Contents/MacOS/などの構造）
        if (process.platform === 'darwin' && execDir.includes('/Contents/MacOS/')) {
          appRootDir = execDir.substring(0, execDir.indexOf('/Contents/MacOS/') + '/Contents/Resources'.length);
        }
      } else {
        // 開発環境では、プロジェクトルートを特定
        appRootDir = process.cwd();
        // package.jsonがある場所までさかのぼる
        let currentDir = process.cwd();
        let found = false;
        let maxDepth = 5; // 無限ループ防止
        while (maxDepth > 0) {
          try {
            if (fs.existsSync(path.join(currentDir, 'package.json'))) {
              appRootDir = currentDir;
              found = true;
              break;
            }
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) break; // これ以上上がれない
            currentDir = parentDir;
          } catch (e) {
            break;
          }
          maxDepth--;
        }
      }

      // 重複を排除してパスを構築するヘルパー関数
      const uniquePaths = new Set();
      function addUniquePath(pathToAdd) {
        if (pathToAdd) {
          // 絶対パスに変換して正規化
          try {
            const normalizedPath = path.resolve(pathToAdd);
            uniquePaths.add(normalizedPath);
          } catch (err) {
            // パス変換エラーは無視
          }
        }
      }

      // 環境変数で指定されたパスを最優先で追加
      if (process.env.BUNDLE_RESOURCES_PATH) {
        addUniquePath(process.env.BUNDLE_RESOURCES_PATH);
      }

      // 1. 実行ファイルと同じディレクトリ（最優先）
      addUniquePath(path.join(execDir, 'bundled-resources.js'));

      // 2. macOS固有: Contents/Resourcesディレクトリ
      if (process.platform === 'darwin' && execDir.includes('/Contents/MacOS/')) {
        const resourcesDir = execDir.substring(0, execDir.indexOf('/Contents/MacOS/') + '/Contents/Resources'.length);
        addUniquePath(path.join(resourcesDir, 'bundled-resources.js'));
      }

      // 3. アプリケーション配布関連ディレクトリを探索
      // resources, assets などのよくある名前のサブディレクトリを試す
      const commonSubdirs = ['resources', 'assets', 'data', 'static'];
      commonSubdirs.forEach(subdir => {
        addUniquePath(path.join(execDir, subdir, 'bundled-resources.js'));
      });

      // 4. アプリケーションルート直下
      if (appRootDir !== execDir) {
        addUniquePath(path.join(appRootDir, 'bundled-resources.js'));
      }

      // 5. カレントディレクトリ（開発環境向け、最後の手段）
      if (!isCompiled) {
        addUniquePath(path.join(process.cwd(), 'bundled-resources.js'));
        addUniquePath('./bundled-resources.js');
        addUniquePath(path.join(process.cwd(), 'dist', 'bundled-resources.js'));
        addUniquePath('./dist/bundled-resources.js');
        addUniquePath(path.join(__dirname, 'bundled-resources.js'));
        addUniquePath(path.join(__dirname, 'dist', 'bundled-resources.js'));
      }

      // 重複排除済みのパスリストを配列に変換
      const possiblePaths = Array.from(uniquePaths);

      // 現在のディレクトリ情報を出力
      console.log(`カレントディレクトリ: ${process.cwd()}`);
      console.log(`__dirname: ${__dirname}`);

      let loaded = false;

      // 順番に各パスを試す
      for (const modulePath of possiblePaths) {
        try {
          resources = await import(modulePath);
          console.log(`★成功★ バンドルリソースを読み込みました: ${modulePath}`);
          loaded = true;
          break;
        } catch (pathErr) {
          // このパスでは読み込めなかった、次を試す
        }
      }

      if (!loaded) {
        console.warn('警告: どのパスからもバンドルリソースを読み込めませんでした');
        console.warn('ファイルシステムからの読み込みにフォールバックします');
        resources = null;
      }
    } catch (err) {
      console.warn('バンドルリソースの読み込みに失敗しました:', err.message);
      console.warn('ファイルシステムからの読み込みにフォールバックします');
      resources = null;
    }
  }

  // ファイルシステムアクセスの確認 (バンドルモードでなければ、またはバンドル読み込み失敗時)
  if (!resources) {
    console.log('ファイルシステムから静的ファイル提供モードに切り替え');

    // 実行ファイルのディレクトリを確実に取得
    let execDir = '';
    if (typeof process.execPath === 'string') {
      execDir = path.dirname(process.execPath);
    } else if (process.argv && process.argv[0]) {
      execDir = path.dirname(process.argv[0]);
    }

    // アプリケーションバンドルのルートディレクトリを特定するためのロジック
    let appRootDir = '';
    if (isCompiled) {
      // コンパイル済み実行ファイルの場合、execDirをルートとして使用
      appRootDir = execDir;
      // Macアプリバンドルの構造を考慮（Contents/MacOS/などの構造）
      if (process.platform === 'darwin' && execDir.includes('/Contents/MacOS/')) {
        appRootDir = execDir.substring(0, execDir.indexOf('/Contents/MacOS/') + '/Contents/Resources'.length);
      }
    } else {
      // 開発環境では、プロジェクトルートを特定
      appRootDir = process.cwd();
      // package.jsonがある場所までさかのぼる
      let currentDir = process.cwd();
      let maxDepth = 5; // 無限ループ防止
      while (maxDepth > 0) {
        try {
          if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            appRootDir = currentDir;
            break;
          }
          const parentDir = path.dirname(currentDir);
          if (parentDir === currentDir) break; // これ以上上がれない
          currentDir = parentDir;
        } catch (e) {
          break;
        }
        maxDepth--;
      }
    }

    // 重複を排除してパスを構築するヘルパー関数
    const uniquePaths = new Set();
    function addUniquePath(pathToAdd) {
      if (pathToAdd) {
        try {
          const normalizedPath = path.resolve(pathToAdd);
          uniquePaths.add(normalizedPath);
        } catch (err) {
          // パス変換エラーは無視
        }
      }
    }

    // 環境変数で指定されたパスを最優先で追加
    if (process.env.STATIC_FILES_DIR) {
      addUniquePath(process.env.STATIC_FILES_DIR);
    }

    // 1. 実行ファイルと同じディレクトリ
    addUniquePath(execDir);

    // 2. macOS固有: Contents/Resourcesディレクトリ
    if (process.platform === 'darwin' && execDir.includes('/Contents/MacOS/')) {
      const resourcesDir = execDir.substring(0, execDir.indexOf('/Contents/MacOS/') + '/Contents/Resources'.length);
      addUniquePath(resourcesDir);
      // static/staticサブディレクトリも追加
      addUniquePath(path.join(resourcesDir, 'static'));
      addUniquePath(path.join(resourcesDir, 'statics'));
    }

    // 3. 一般的なリソースディレクトリ名を試す
    const commonResourceDirs = ['static', 'statics', 'resources', 'assets', 'public', 'www'];
    commonResourceDirs.forEach(dir => {
      addUniquePath(path.join(execDir, dir));
    });

    // 4. アプリケーションルート
    if (appRootDir !== execDir) {
      addUniquePath(appRootDir);
      commonResourceDirs.forEach(dir => {
        addUniquePath(path.join(appRootDir, dir));
      });
    }

    // 5. 開発環境向けのパス（コンパイル済みでない場合のみ）
    if (!isCompiled) {
      addUniquePath(process.cwd());
      addUniquePath(baseDir);
      commonResourceDirs.forEach(dir => {
        addUniquePath(path.join(process.cwd(), dir));
        if (baseDir !== process.cwd()) {
          addUniquePath(path.join(baseDir, dir));
        }
      });
    }

    // 重複排除済みのパスリストを配列に変換
    const possiblePaths = Array.from(uniquePaths);

    let staticsDirFound = false;
    let foundStaticsDir = '';

    // 各パスを試し、index.htmlを含むディレクトリを探す
    for (const dirPath of possiblePaths) {
      try {
        // console.log(`ディレクトリ確認中: ${dirPath}`);
        fs.accessSync(dirPath, fs.constants.R_OK);
        const files = fs.readdirSync(dirPath);
        // console.log(`  - ファイル一覧: ${files.join(', ')}`);

        if (files.includes('index.html')) {
          console.log(`★成功★ index.html が見つかりました: ${dirPath}`);
          staticsDirFound = true;
          foundStaticsDir = dirPath;
          break;
        } else {
          // サブディレクトリも確認
          for (const file of files) {
            const subDir = path.join(dirPath, file);
            try {
              if (fs.statSync(subDir).isDirectory()) {
                const subFiles = fs.readdirSync(subDir);
                if (subFiles.includes('index.html')) {
                  console.log(`★成功★ サブディレクトリで index.html が見つかりました: ${subDir}`);
                  staticsDirFound = true;
                  foundStaticsDir = subDir;
                  break;
                }
              }
            } catch (subErr) {
              // サブディレクトリアクセスエラー、無視
            }
          }
          if (staticsDirFound) break;
        }
      } catch (err) {
        // console.log(`  - アクセスエラー: ${err.message}`);
        // このパスではファイルが見つからなかった、次を試す
      }
    }

    if (staticsDirFound) {
      // 見つかったディレクトリをベースディレクトリとして使用
      console.log(`静的ファイルディレクトリを使用: ${foundStaticsDir}`);
      global.STATIC_FILES_DIR = foundStaticsDir;
    } else {
      console.error('静的ファイルディレクトリが見つかりません。');

      // マニュアル対応：コンパイル実行の場合は実行パスを使用
      if (isCompiled) {
        // コンパイル時の実行ファイルと同じディレクトリに静的ファイルをコピーしておくという想定
        let compiledDir = execDir;

        // Macアプリバンドル内の場合はResourcesディレクトリを優先
        if (process.platform === 'darwin' && execDir.includes('/Contents/MacOS/')) {
          const resourcesDir = execDir.substring(0, execDir.indexOf('/Contents/MacOS/') + '/Contents/Resources'.length);
          if (fs.existsSync(resourcesDir)) {
            compiledDir = resourcesDir;
          }
        }

        console.log(`コンパイル環境のためデフォルトディレクトリを使用: ${compiledDir}`);
        global.STATIC_FILES_DIR = compiledDir;
      } else {
        // 開発環境ではプロジェクトルートまたはカレントディレクトリを使用
        if (appRootDir && fs.existsSync(path.join(appRootDir, 'package.json'))) {
          global.STATIC_FILES_DIR = appRootDir; // プロジェクトルート
        } else {
          global.STATIC_FILES_DIR = baseDir; // デフォルト値
        }
        console.log(`開発環境のためデフォルトディレクトリを使用: ${global.STATIC_FILES_DIR}`);
      }
    }
  }

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

    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`ファイル読み込みエラー (${filePath}):`, err.message);
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

    // バンドルリソースがある場合、そこから配信
    if (resources) {
      serveFromBundle(pathname.startsWith('/') ? pathname.substring(1) : pathname, res);
      return;
    }

    // バンドルがない場合はファイルシステムから
    // Remove leading slash and resolve path
    const staticFilesDir = global.STATIC_FILES_DIR || path.join(baseDir, 'statics');
    const filePath = path.join(staticFilesDir, pathname);

    // Security: ensure file is within allowed directory
    const resolvedPath = path.resolve(filePath);
    const staticDir = path.resolve(staticFilesDir);
    if (!resolvedPath.startsWith(staticDir)) {
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
      const staticDir = global.STATIC_FILES_DIR || path.join(baseDir, 'statics');
      console.log(`Serving files from: ${staticDir}`);
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
}; // main関数の終了

// メイン関数を実行
main().catch(err => {
  console.error('サーバー起動中にエラーが発生しました:', err);
});

