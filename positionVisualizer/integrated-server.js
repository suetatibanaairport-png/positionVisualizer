// integrated-server.js
// HTTPサーバーとWebSocketブリッジを統合した単一プロセスサーバー
// tools/http-server.jsとtools/bridge-server.jsの機能を統合
//
// 統合の理由:
// 1. Bunでコンパイルする際、子プロセス生成が無限ループを引き起こす問題を解決するため
//    - 元のアーキテクチャでは、start-app.jsがprocess.execPathを使って子プロセスを生成
//    - コンパイル後はprocess.execPathがバイナリ自身を指すため、無限に自分自身を呼び出してしまう
// 2. 単一バイナリで完結するスタンドアロン実行可能ファイルを作成するため
//    - Nodeがインストールされていない環境でも実行可能
//    - 非エンジニアでも簡単に使用できる形式
// 3. 相対パスを使用して、コンパイル後も正しくファイル操作ができるように設計

const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const WebSocket = require('ws');
const { exec } = require('child_process');
const readline = require('readline');

// アプリケーション設定
const HTTP_PORT = Number(process.env.HTTP_PORT || 8000); // HTTPサーバーのポート
const HTTP_HOST = process.env.HTTP_HOST || '127.0.0.1';
const WS_PORT = Number(process.env.WS_PORT || 8123); // WebSocketサーバーのポート（WebSocketBridgeClientの接続先）

// アプリケーションディレクトリ（__dirnameを使用）
const appDir = __dirname;
console.log('アプリケーションディレクトリ:', appDir);

// ====================================================================
// HTTPサーバー機能（tools/http-server.jsから抽出）
// ====================================================================

// MIMEタイプのマッピング
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

// ファイルの拡張子からMIMEタイプを取得
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

// 静的ファイルを提供する関数
function serveFile(filePath, res) {
  const mimeType = getMimeType(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
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

// ====================================================================
// WebSocketブリッジサーバー機能（tools/bridge-server.jsから抽出）
// ====================================================================

// Socket.IO クライアントのロード（存在する場合）
let socketIo;
try {
  socketIo = require('socket.io-client');
} catch (error) {
  console.log('socket.io-clientが見つかりません。LeverAPI連携は無効になります。');
}

// 最新状態の保持
let latest = { values: [null, null, null, null, null, null], names: [], icon: 'assets/icon.svg', svg: '', ts: Date.now() };

// LeverAPI統合設定
const LEVER_API_URL = process.env.LEVER_API_URL || 'http://127.0.0.1:5001';
let leverApiSocket = null;

// デバイスIDからインデックスへのマッピング（bridge-server.jsから移植）
function getDeviceIndex(deviceId) {
  if (!deviceId) return -1;
  // デバイスIDから数字を抽出 (lever1 -> 0, lever2 -> 1, etc.)
  const match = String(deviceId).match(/(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 6) {
      return num - 1;
    }
  }
  return -1;
}

// JSONディレクトリの作成（相対パスで指定）
const jsonDir = './json';
if (!fs.existsSync(jsonDir)) {
  fs.mkdirSync(jsonDir, { recursive: true });
}

// ====================================================================
// 統合サーバーの実装
// ====================================================================

// 統合HTTPサーバーの作成
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // URLの解析
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // bridge-serverのエンドポイント処理
  if (req.method === 'GET' && pathname === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(latest));
    return;
  }

  // ログ保存エンドポイント
  if (req.method === 'POST' && pathname === '/save-log') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.records || !Array.isArray(data.records)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid data format' }));
          return;
        }

        const filename = data.filename || `meter-log-${Date.now()}.json`;
        const filepath = path.join(jsonDir, filename);
        const jsonContent = JSON.stringify(data.records, null, 2);

        fs.writeFile(filepath, jsonContent, 'utf8', (err) => {
          if (err) {
            console.error('Failed to save log:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save log file' }));
            return;
          }
          console.log(`Log saved: ${filepath}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, filename: filename }));
        });
      } catch (error) {
        console.error('Error parsing log data:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // http-serverの静的ファイル提供処理
  // デフォルトでindex.htmlをルートとして扱う
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(appDir, pathname);

  // セキュリティ：ファイルがappDir内にあることを確認
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(appDir))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // ファイルが存在するか確認
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    serveFile(filePath, res);
  });
});

// WebSocketサーバーの設定（独立したポートで起動）
const wss = new WebSocket.Server({ port: WS_PORT });

// WebSocketメッセージをブロードキャスト
function broadcast(obj, exclude) {
  const data = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// WebSocket接続処理
wss.on('connection', (ws) => {
  // 接続時に最新状態を送信
  try { ws.send(JSON.stringify({ type: 'state', payload: latest })); } catch(_) {}

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(String(msg));
      if (data && data.type === 'state' && data.payload && typeof data.payload === 'object') {
        // 既存の状態とマージ（接続されていないデバイスのnull値は保持）
        const mergedValues = [...latest.values];
        if (data.payload.values && Array.isArray(data.payload.values)) {
          data.payload.values.forEach((val, idx) => {
            if (idx < 6 && val !== null && val !== undefined) {
              mergedValues[idx] = val;
            }
          });
        }
        latest = { ...latest, ...data.payload, values: mergedValues, ts: Date.now() };
        broadcast({ type: 'state', payload: latest }, ws);
      }
      // クライアントからのdevice_updateメッセージの処理
      else if (data && data.type === 'device_update' && data.device_id && data.data) {
        const index = getDeviceIndex(data.device_id);
        if (index >= 0 && index < 6) {
          const value = data.data.value;
          if (typeof value === 'number') {
            latest.values[index] = value;
            latest.ts = Date.now();
            broadcast({ type: 'state', payload: latest }, ws);
          }
        }
      }
    } catch(_) {}
  });
});

// LeverAPIへの接続
function connectToLeverAPI() {
  if (!socketIo || !LEVER_API_URL) return;

  try {
    leverApiSocket = socketIo(LEVER_API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      timeout: 5000
    });

    leverApiSocket.on('connect', () => {
      console.log('[bridge] Connected to LeverAPI WebSocket at', LEVER_API_URL);
    });

    leverApiSocket.on('disconnect', () => {
      console.log('[bridge] Disconnected from LeverAPI WebSocket');
    });

    leverApiSocket.on('connect_error', (error) => {
      console.error('[bridge] LeverAPI connection error:', error.message);
      console.log('[bridge] Make sure LeverAPI is running on', LEVER_API_URL);
    });

    // device_updateイベントの処理
    leverApiSocket.on('device_update', (data) => {
      try {
        const { device_id, data: valueData } = data;
        if (!device_id || !valueData) {
          console.log('[bridge] device_update: missing device_id or data', data);
          return;
        }

        const index = getDeviceIndex(device_id);
        console.log(`[bridge] device_update: device_id=${device_id}, index=${index}, value=${valueData.value}`);

        if (index >= 0 && index < 6 && typeof valueData.value === 'number') {
          latest.values[index] = valueData.value;
          latest.ts = Date.now();
          console.log(`[bridge] Broadcasting update: index=${index}, value=${valueData.value}`);
          broadcast({ type: 'state', payload: latest });
        } else {
          console.log(`[bridge] device_update: invalid index or value (index=${index}, value=${valueData.value})`);
        }
      } catch (error) {
        console.error('Error processing device_update:', error);
      }
    });

    // devices_updateイベント（バッチ更新）の処理
    leverApiSocket.on('devices_update', (data) => {
      try {
        if (data.updates && typeof data.updates === 'object') {
          const newValues = [...latest.values];
          let hasChanges = false;

          Object.keys(data.updates).forEach(deviceId => {
            const index = getDeviceIndex(deviceId);
            if (index >= 0 && index < 6) {
              const valueData = data.updates[deviceId];
              if (valueData && typeof valueData.value === 'number') {
                newValues[index] = valueData.value;
                hasChanges = true;
              }
            }
          });

          if (hasChanges) {
            latest = { ...latest, values: newValues, ts: Date.now() };
            broadcast({ type: 'state', payload: latest });
          }
        }
      } catch (error) {
        console.error('Error processing devices_update:', error);
      }
    });

    // all_valuesイベント（初期接続時）の処理
    leverApiSocket.on('all_values', (data) => {
      try {
        if (data && typeof data === 'object') {
          const newValues = [null, null, null, null, null, null];
          let hasChanges = false;

          Object.keys(data).forEach(deviceId => {
            const index = getDeviceIndex(deviceId);
            if (index >= 0 && index < 6) {
              const valueData = data[deviceId];
              if (valueData && typeof valueData.value === 'number') {
                newValues[index] = valueData.value;
                hasChanges = true;
              }
            }
          });

          if (hasChanges) {
            latest = { ...latest, values: newValues, ts: Date.now() };
            broadcast({ type: 'state', payload: latest });
          }
        }
      } catch (error) {
        console.error('Error processing all_values:', error);
      }
    });
  } catch (error) {
    console.error('Failed to initialize LeverAPI WebSocket connection:', error);
  }
}

// サーバー起動
server.listen(HTTP_PORT, HTTP_HOST, () => {
  console.log(`HTTPサーバーが起動しました http://${HTTP_HOST}:${HTTP_PORT}`);
  console.log(`WebSocketエンドポイント: ws://${HTTP_HOST}:${WS_PORT}`);
  console.log(`静的ファイル配信元: ${appDir}`);

  // LeverAPIに接続
  connectToLeverAPI();

  // ブラウザを開く
  openBrowser();

  // コンソール表示
  console.log('\n----------------------------------------');
  console.log('サーバーが起動しました');
  console.log('終了するには Q または q キーを押すか、Ctrl+C を押してください');
  console.log('----------------------------------------\n');

  // キー入力待機
  waitForKeyPress();
});

// エラーハンドリング
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ポート ${HTTP_PORT} は既に使用されています。`);
    console.error(`ポート ${HTTP_PORT} を使用しているアプリケーションを終了するか、HTTP_PORT環境変数を設定して別のポートを使用してください。`);
  } else {
    console.error('サーバーエラー:', err);
  }
  process.exit(1);
});

// ブラウザを開く関数
function openBrowser() {
  const url = `http://${HTTP_HOST}:${HTTP_PORT}/`;
  const overlayUrl = `http://${HTTP_HOST}:${HTTP_PORT}/overlay.html`;

  console.log('ブラウザを開いています...');

  // プラットフォームに応じたコマンド
  let command, overlayCommand;
  if (process.platform === 'win32') {
    // Windows
    command = 'start';
    overlayCommand = 'start'; // 新しいウィンドウを開くためのコマンド
  } else if (process.platform === 'darwin') {
    // macOS
    command = 'open';
    overlayCommand = 'open -n'; // 新しいウィンドウを強制的に開くためのコマンド
  } else {
    // Linux
    command = 'xdg-open';
    overlayCommand = 'xdg-open'; // Linuxではオプションが異なる場合があります
  }

  try {
    // メインページを開く
    exec(`${command} "${url}"`);

    // 少し待ってからオーバーレイを開く（必ず別ウィンドウで）
    setTimeout(() => {
      if (process.platform === 'win32') {
        // Windowsでは新しいウィンドウを強制するオプションを指定
        exec(`${overlayCommand} "" "${overlayUrl}"`);
      } else if (process.platform === 'darwin') {
        // macOSでは -n オプションで必ず新しいウィンドウを開く
        exec(`${overlayCommand} "${overlayUrl}"`);
      } else {
        // Linuxなど
        exec(`${overlayCommand} "${overlayUrl}"`);
      }
    }, 1000);

    console.log(`ブラウザが開きました: ${url}`);
    console.log(`オーバーレイ(別ウィンドウ): ${overlayUrl}`);
  } catch (error) {
    console.error('ブラウザを開けませんでした:', error);
  }
}

// キー入力待機関数
function waitForKeyPress() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.on('keypress', (_, key) => {
    if ((key && key.name === 'q') || (key && key.ctrl && key.name === 'c')) {
      cleanupAndExit();
    }
  });

  console.log('アプリケーションは実行中です...');
}

// 終了処理
function cleanupAndExit() {
  console.log('アプリケーションを終了しています...');

  // LeverAPI接続を閉じる
  if (leverApiSocket) {
    try {
      leverApiSocket.disconnect();
      console.log('LeverAPI接続を閉じました');
    } catch (error) {
      console.error('LeverAPI接続の終了エラー:', error.message);
    }
  }

  // WebSocket接続を閉じる
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  console.log('すべてのリソースを解放しました');
  process.exit(0);
}

// 終了イベントのハンドリング
process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

// 予期せぬエラーの処理
process.on('uncaughtException', (error) => {
  console.error('予期せぬエラーが発生しました:', error);
  cleanupAndExit();
});