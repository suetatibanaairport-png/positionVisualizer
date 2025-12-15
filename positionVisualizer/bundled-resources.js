// 自動生成されたリソースバンドル - 編集しないでください
// 生成日時: 2025-12-15T16:44:17.206Z

// このファイルには、すべての静的リソースが文字列またはbase64データとして埋め込まれています

const resources = {
  "assets/icon.svg": `<?xml version="1.0" encoding="UTF-8"?>
<svg id="_レイヤー_2" data-name="レイヤー 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 331.07 331.07">
  <defs>
    <style>
      .cls-1 {
        fill: #323333;
      }
    </style>
  </defs>
  <g id="_レイヤー_1-2" data-name="レイヤー 1">
    <path class="cls-1" d="M165.53,0C74.26,0,0,74.26,0,165.53s74.26,165.54,165.53,165.54,165.54-74.26,165.54-165.54S256.81,0,165.53,0ZM13.71,199.35c-2.42-10.89-3.71-22.21-3.71-33.82C10,79.77,79.77,10,165.53,10s155.54,69.77,155.54,155.53c0,11.61-1.29,22.93-3.71,33.82H13.71Z"/>
  </g>
</svg>`,
  "bridge-server.js": `// WebSocket bridge: accepts state from any client and broadcasts to all others.
(function(){
  const http = require('http');
  const WebSocket = require('ws');
  const fs = require('fs');
  const path = require('path');
  const io = require('socket.io-client');

  // 環境情報のログ出力
  console.log('==== Bridge Server Environment ====');
  console.log('OS Platform:', process.platform);
  console.log('Node Version:', process.version);
  console.log('Working Directory:', process.cwd());
  console.log('Script Directory:', __dirname);
  console.log('==================================');

  let latest = { values: [null, null, null, null, null, null], names: [], icon: 'assets/icon.svg', svg: '', ts: Date.now() };

  // LeverAPI integration
  const LEVER_API_URL = process.env.LEVER_API_URL || 'http://127.0.0.1:5001';
  console.log('LeverAPI URL:', LEVER_API_URL);
  
  // Map device_id to index (lever1 -> 0, lever2 -> 1, etc.)
  function getDeviceIndex(deviceId) {
    if (!deviceId) return -1;
    // Try to extract number from device_id (lever1 -> 0, lever2 -> 1, etc.)
    const match = String(deviceId).match(/(\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  }
  
  // Connect to LeverAPI WebSocket (Socket.IO)
  let leverApiSocket = null;
  if (LEVER_API_URL) {
    try {
      leverApiSocket = io(LEVER_API_URL, {
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

      // Subscribe to device_update events
      leverApiSocket.on('device_update', (data) => {
        try {
          const { device_id, data: valueData } = data;
          if (!device_id || !valueData) {
            console.log('[bridge] device_update: missing device_id or data', data);
            return;
          }
          
          const index = getDeviceIndex(device_id);
          console.log(\`[bridge] device_update: device_id=\${device_id}, index=\${index}, value=\${valueData.value}\`);
          
          if (index >= 0 && index < 6 && typeof valueData.value === 'number') {
            latest.values[index] = valueData.value;
            latest.ts = Date.now();
            console.log(\`[bridge] Broadcasting update: index=\${index}, value=\${valueData.value}\`);
            broadcast({ type: 'state', payload: latest });
          } else {
            console.log(\`[bridge] device_update: invalid index or value (index=\${index}, value=\${valueData.value})\`);
          }
        } catch (error) {
          console.error('Error processing device_update:', error);
        }
      });

      // Subscribe to devices_update events (batch updates)
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

      // Subscribe to all_values event (initial connection)
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

  // Get positionVisualizer directory
  const positionVisualizerDir = __dirname;
  console.log('Position Visualizer Directory:', positionVisualizerDir);

  // ディレクトリ確認をより強固に
  function ensureDirectoryExists(dir, name) {
    console.log(\`\${name}ディレクトリを確認中: \${dir}\`);
    try {
      if (!fs.existsSync(dir)) {
        console.log(\`\${name}ディレクトリが存在しないため作成します\`);
        fs.mkdirSync(dir, { recursive: true });
        console.log(\`\${name}ディレクトリを作成しました\`);
      } else {
        console.log(\`\${name}ディレクトリは既に存在します\`);
      }

      // 書き込み権限の確認
      try {
        fs.accessSync(dir, fs.constants.W_OK);
        console.log(\`\${name}ディレクトリに書き込み権限があります\`);
      } catch (accessErr) {
        console.warn(\`\${name}ディレクトリへの書き込み権限がありません:\`, accessErr.message);
        throw accessErr;
      }

      return dir;
    } catch (err) {
      console.error(\`\${name}ディレクトリエラー:\`, err.message);
      // エラー時の代替ディレクトリ（カレントディレクトリ）
      const altDir = path.join(process.cwd(), name);
      console.log(\`代替\${name}ディレクトリを作成します: \${altDir}\`);
      try {
        fs.mkdirSync(altDir, { recursive: true });
        return altDir;
      } catch (e) {
        console.error(\`代替\${name}ディレクトリの作成に失敗しました:\`, e.message);
        // 最終手段としてテンポラリディレクトリを使用
        const tmpDir = path.join(require('os').tmpdir(), name);
        console.warn(\`テンポラリディレクトリを使用します: \${tmpDir}\`);
        fs.mkdirSync(tmpDir, { recursive: true });
        return tmpDir;
      }
    }
  }

  // ディレクトリの確認と作成
  const logsDir = ensureDirectoryExists(path.join(positionVisualizerDir, 'logs'), 'logs');
  const jsonDir = ensureDirectoryExists(path.join(positionVisualizerDir, 'json'), 'json');

  const server = http.createServer((req, res) => {
    // Basic health + optional HTTP fallback for debugging
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    
    if (req.method === 'GET' && req.url === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latest));
      return;
    }
    
    // Log saving endpoint
    if (req.method === 'POST' && req.url === '/save-log') {
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
          
          const filename = data.filename || \`meter-log-\${Date.now()}.json\`;
          const filepath = path.join(jsonDir, filename);
          const jsonContent = JSON.stringify(data.records, null, 2);
          
          fs.writeFile(filepath, jsonContent, 'utf8', (err) => {
            if (err) {
              console.error('Failed to save log:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to save log file' }));
              return;
            }
            console.log(\`Log saved: \${filepath}\`);
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
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });

  const wss = new WebSocket.Server({ server });

  function broadcast(obj, exclude){
    const data = JSON.stringify(obj);
    wss.clients.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  wss.on('connection', (ws) => {
    // Send the latest immediately upon connection
    try { ws.send(JSON.stringify({ type: 'state', payload: latest })); } catch(_) {}

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(String(msg));
        if (data && data.type === 'state' && data.payload && typeof data.payload === 'object') {
          // Merge with existing state, but preserve null values for unconnected devices
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
        // Handle device_update messages from clients (LeverAPI sends via Socket.IO directly)
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

  const PORT = Number(process.env.BRIDGE_PORT || 8123);
  const HOST = process.env.BRIDGE_HOST || '127.0.0.1';
  server.listen(PORT, HOST, () => {
    console.log(\`bridge listening ws://\${HOST}:\${PORT}\`);
  });

  // エラーハンドリングの強化
  server.on('error', (err) => {
    console.error('WebSocketサーバーエラー:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(\`ポート \${PORT} は既に使用されています。別のポートを試します...\`);
      server.close();
      const newPort = PORT + 1;
      server.listen(newPort, HOST, () => {
        console.log(\`代替ポート \${newPort} で起動しました: ws://\${HOST}:\${newPort}\`);
        console.log(\`環境変数 BRIDGE_PORT=\${newPort} を設定することで、このポートを永続的に使用できます\`);
      });
    } else {
      console.error('想定外のサーバーエラー。エラー詳細:', err);
      console.error('可能であれば処理を継続します');
    }
  });

  // プロセス終了時の処理
  process.on('SIGINT', () => {
    console.log('プロセスが中断されました。リソースをクリーンアップしています...');
    if (leverApiSocket) {
      leverApiSocket.disconnect();
      console.log('LeverAPI接続を切断しました');
    }
    server.close(() => {
      console.log('WebSocketサーバーを停止しました');
      process.exit(0);
    });
  });
})();

`,
  "bundle-static.js": `// bundle-static.js
// 静的ファイルをスキャンして、リソースバンドルを作成するスクリプト

const fs = require('fs');
const path = require('path');

// ソースディレクトリ (HTML/CSS/JSがある場所)
const sourceDir = __dirname;

// 出力ファイル - http-server.jsがインポートする
const outputFile = path.join(__dirname, 'bundled-resources.js');

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
    const relativePath = path.relative(baseDir, fullPath).replace(/\\\\/g, '/');

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
let outputContent = \`// 自動生成されたリソースバンドル - 編集しないでください
// 生成日時: \${new Date().toISOString()}

// このファイルには、すべての静的リソースが文字列またはbase64データとして埋め込まれています

const resources = {
\`;

// 各ファイルを処理
Object.entries(files).forEach(([relativePath, fullPath]) => {
  const ext = path.extname(relativePath).toLowerCase();
  const isText = textExtensions.includes(ext);

  console.log(\`処理中: \${relativePath} (\${isText ? 'テキスト' : 'バイナリ'})\`);

  if (isText) {
    // テキストファイルは文字列として埋め込む
    try {
      let content = fs.readFileSync(fullPath, 'utf8')
        .replace(/\\\\/g, '\\\\\\\\')
        .replace(/\`/g, '\\\\\`')
        .replace(/\\\${/g, '\\\\\${');

      outputContent += \`  "\${relativePath}": \\\`\${content}\\\`,\\n\`;
    } catch (err) {
      console.error(\`ファイル読み込みエラー \${relativePath}:\`, err);
    }
  } else {
    // バイナリファイルはbase64としてエンコード
    try {
      const content = fs.readFileSync(fullPath).toString('base64');
      outputContent += \`  "\${relativePath}": { base64: "\${content}" },\\n\`;
    } catch (err) {
      console.error(\`ファイル読み込みエラー \${relativePath}:\`, err);
    }
  }
});

// リソースオブジェクトを閉じる
outputContent += \`};\\n\\n\`;

// ヘルパー関数の追加
outputContent += \`// MIMEタイプのマッピング
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

module.exports = {
  resources,
  getResource,
  getMimeType,
  listResources
};
\`;

// 出力ファイルに書き込み
fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(\`リソースバンドルファイルを生成しました: \${outputFile}\`);`,
  "bundled-resources.js": `// 自動生成されたリソースバンドル - 編集しないでください
// 生成日時: 2025-12-15T16:37:40.633Z

// このファイルには、すべての静的リソースが文字列またはbase64データとして埋め込まれています

const resources = {
  "assets/icon.svg": \`<?xml version="1.0" encoding="UTF-8"?>
<svg id="_レイヤー_2" data-name="レイヤー 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 331.07 331.07">
  <defs>
    <style>
      .cls-1 {
        fill: #323333;
      }
    </style>
  </defs>
  <g id="_レイヤー_1-2" data-name="レイヤー 1">
    <path class="cls-1" d="M165.53,0C74.26,0,0,74.26,0,165.53s74.26,165.54,165.53,165.54,165.54-74.26,165.54-165.54S256.81,0,165.53,0ZM13.71,199.35c-2.42-10.89-3.71-22.21-3.71-33.82C10,79.77,79.77,10,165.53,10s155.54,69.77,155.54,155.53c0,11.61-1.29,22.93-3.71,33.82H13.71Z"/>
  </g>
</svg>\`,
  "bridge-server.js": \`// WebSocket bridge: accepts state from any client and broadcasts to all others.
(function(){
  const http = require('http');
  const WebSocket = require('ws');
  const fs = require('fs');
  const path = require('path');
  const io = require('socket.io-client');

  // 環境情報のログ出力
  console.log('==== Bridge Server Environment ====');
  console.log('OS Platform:', process.platform);
  console.log('Node Version:', process.version);
  console.log('Working Directory:', process.cwd());
  console.log('Script Directory:', __dirname);
  console.log('==================================');

  let latest = { values: [null, null, null, null, null, null], names: [], icon: 'assets/icon.svg', svg: '', ts: Date.now() };

  // LeverAPI integration
  const LEVER_API_URL = process.env.LEVER_API_URL || 'http://127.0.0.1:5001';
  console.log('LeverAPI URL:', LEVER_API_URL);
  
  // Map device_id to index (lever1 -> 0, lever2 -> 1, etc.)
  function getDeviceIndex(deviceId) {
    if (!deviceId) return -1;
    // Try to extract number from device_id (lever1 -> 0, lever2 -> 1, etc.)
    const match = String(deviceId).match(/(\\\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  }
  
  // Connect to LeverAPI WebSocket (Socket.IO)
  let leverApiSocket = null;
  if (LEVER_API_URL) {
    try {
      leverApiSocket = io(LEVER_API_URL, {
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

      // Subscribe to device_update events
      leverApiSocket.on('device_update', (data) => {
        try {
          const { device_id, data: valueData } = data;
          if (!device_id || !valueData) {
            console.log('[bridge] device_update: missing device_id or data', data);
            return;
          }
          
          const index = getDeviceIndex(device_id);
          console.log(\\\`[bridge] device_update: device_id=\\\${device_id}, index=\\\${index}, value=\\\${valueData.value}\\\`);
          
          if (index >= 0 && index < 6 && typeof valueData.value === 'number') {
            latest.values[index] = valueData.value;
            latest.ts = Date.now();
            console.log(\\\`[bridge] Broadcasting update: index=\\\${index}, value=\\\${valueData.value}\\\`);
            broadcast({ type: 'state', payload: latest });
          } else {
            console.log(\\\`[bridge] device_update: invalid index or value (index=\\\${index}, value=\\\${valueData.value})\\\`);
          }
        } catch (error) {
          console.error('Error processing device_update:', error);
        }
      });

      // Subscribe to devices_update events (batch updates)
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

      // Subscribe to all_values event (initial connection)
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

  // Get positionVisualizer directory
  const positionVisualizerDir = __dirname;
  console.log('Position Visualizer Directory:', positionVisualizerDir);

  // ディレクトリ確認をより強固に
  function ensureDirectoryExists(dir, name) {
    console.log(\\\`\\\${name}ディレクトリを確認中: \\\${dir}\\\`);
    try {
      if (!fs.existsSync(dir)) {
        console.log(\\\`\\\${name}ディレクトリが存在しないため作成します\\\`);
        fs.mkdirSync(dir, { recursive: true });
        console.log(\\\`\\\${name}ディレクトリを作成しました\\\`);
      } else {
        console.log(\\\`\\\${name}ディレクトリは既に存在します\\\`);
      }

      // 書き込み権限の確認
      try {
        fs.accessSync(dir, fs.constants.W_OK);
        console.log(\\\`\\\${name}ディレクトリに書き込み権限があります\\\`);
      } catch (accessErr) {
        console.warn(\\\`\\\${name}ディレクトリへの書き込み権限がありません:\\\`, accessErr.message);
        throw accessErr;
      }

      return dir;
    } catch (err) {
      console.error(\\\`\\\${name}ディレクトリエラー:\\\`, err.message);
      // エラー時の代替ディレクトリ（カレントディレクトリ）
      const altDir = path.join(process.cwd(), name);
      console.log(\\\`代替\\\${name}ディレクトリを作成します: \\\${altDir}\\\`);
      try {
        fs.mkdirSync(altDir, { recursive: true });
        return altDir;
      } catch (e) {
        console.error(\\\`代替\\\${name}ディレクトリの作成に失敗しました:\\\`, e.message);
        // 最終手段としてテンポラリディレクトリを使用
        const tmpDir = path.join(require('os').tmpdir(), name);
        console.warn(\\\`テンポラリディレクトリを使用します: \\\${tmpDir}\\\`);
        fs.mkdirSync(tmpDir, { recursive: true });
        return tmpDir;
      }
    }
  }

  // ディレクトリの確認と作成
  const logsDir = ensureDirectoryExists(path.join(positionVisualizerDir, 'logs'), 'logs');
  const jsonDir = ensureDirectoryExists(path.join(positionVisualizerDir, 'json'), 'json');

  const server = http.createServer((req, res) => {
    // Basic health + optional HTTP fallback for debugging
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    
    if (req.method === 'GET' && req.url === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latest));
      return;
    }
    
    // Log saving endpoint
    if (req.method === 'POST' && req.url === '/save-log') {
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
          
          const filename = data.filename || \\\`meter-log-\\\${Date.now()}.json\\\`;
          const filepath = path.join(jsonDir, filename);
          const jsonContent = JSON.stringify(data.records, null, 2);
          
          fs.writeFile(filepath, jsonContent, 'utf8', (err) => {
            if (err) {
              console.error('Failed to save log:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to save log file' }));
              return;
            }
            console.log(\\\`Log saved: \\\${filepath}\\\`);
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
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });

  const wss = new WebSocket.Server({ server });

  function broadcast(obj, exclude){
    const data = JSON.stringify(obj);
    wss.clients.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  wss.on('connection', (ws) => {
    // Send the latest immediately upon connection
    try { ws.send(JSON.stringify({ type: 'state', payload: latest })); } catch(_) {}

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(String(msg));
        if (data && data.type === 'state' && data.payload && typeof data.payload === 'object') {
          // Merge with existing state, but preserve null values for unconnected devices
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
        // Handle device_update messages from clients (LeverAPI sends via Socket.IO directly)
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

  const PORT = Number(process.env.BRIDGE_PORT || 8123);
  const HOST = process.env.BRIDGE_HOST || '127.0.0.1';
  server.listen(PORT, HOST, () => {
    console.log(\\\`bridge listening ws://\\\${HOST}:\\\${PORT}\\\`);
  });

  // エラーハンドリングの強化
  server.on('error', (err) => {
    console.error('WebSocketサーバーエラー:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(\\\`ポート \\\${PORT} は既に使用されています。別のポートを試します...\\\`);
      server.close();
      const newPort = PORT + 1;
      server.listen(newPort, HOST, () => {
        console.log(\\\`代替ポート \\\${newPort} で起動しました: ws://\\\${HOST}:\\\${newPort}\\\`);
        console.log(\\\`環境変数 BRIDGE_PORT=\\\${newPort} を設定することで、このポートを永続的に使用できます\\\`);
      });
    } else {
      console.error('想定外のサーバーエラー。エラー詳細:', err);
      console.error('可能であれば処理を継続します');
    }
  });

  // プロセス終了時の処理
  process.on('SIGINT', () => {
    console.log('プロセスが中断されました。リソースをクリーンアップしています...');
    if (leverApiSocket) {
      leverApiSocket.disconnect();
      console.log('LeverAPI接続を切断しました');
    }
    server.close(() => {
      console.log('WebSocketサーバーを停止しました');
      process.exit(0);
    });
  });
})();

\`,
  "bundle-static.js": \`// bundle-static.js
// 静的ファイルをスキャンして、リソースバンドルを作成するスクリプト

const fs = require('fs');
const path = require('path');

// ソースディレクトリ (HTML/CSS/JSがある場所)
const sourceDir = __dirname;

// 出力ファイル - http-server.jsがインポートする
const outputFile = path.join(__dirname, 'bundled-resources.js');

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
    const relativePath = path.relative(baseDir, fullPath).replace(/\\\\\\\\/g, '/');

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
let outputContent = \\\`// 自動生成されたリソースバンドル - 編集しないでください
// 生成日時: \\\${new Date().toISOString()}

// このファイルには、すべての静的リソースが文字列またはbase64データとして埋め込まれています

const resources = {
\\\`;

// 各ファイルを処理
Object.entries(files).forEach(([relativePath, fullPath]) => {
  const ext = path.extname(relativePath).toLowerCase();
  const isText = textExtensions.includes(ext);

  console.log(\\\`処理中: \\\${relativePath} (\\\${isText ? 'テキスト' : 'バイナリ'})\\\`);

  if (isText) {
    // テキストファイルは文字列として埋め込む
    try {
      let content = fs.readFileSync(fullPath, 'utf8')
        .replace(/\\\\\\\\/g, '\\\\\\\\\\\\\\\\')
        .replace(/\\\`/g, '\\\\\\\\\\\`')
        .replace(/\\\\\\\${/g, '\\\\\\\\\\\${');

      outputContent += \\\`  "\\\${relativePath}": \\\\\\\`\\\${content}\\\\\\\`,\\\\n\\\`;
    } catch (err) {
      console.error(\\\`ファイル読み込みエラー \\\${relativePath}:\\\`, err);
    }
  } else {
    // バイナリファイルはbase64としてエンコード
    try {
      const content = fs.readFileSync(fullPath).toString('base64');
      outputContent += \\\`  "\\\${relativePath}": { base64: "\\\${content}" },\\\\n\\\`;
    } catch (err) {
      console.error(\\\`ファイル読み込みエラー \\\${relativePath}:\\\`, err);
    }
  }
});

// リソースオブジェクトを閉じる
outputContent += \\\`};\\\\n\\\\n\\\`;

// ヘルパー関数の追加
outputContent += \\\`// MIMEタイプのマッピング
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

module.exports = {
  resources,
  getResource,
  getMimeType,
  listResources
};
\\\`;

// 出力ファイルに書き込み
fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(\\\`リソースバンドルファイルを生成しました: \\\${outputFile}\\\`);\`,
  "bundled-resources.js": \`// 自動生成されたリソースバンドル - 編集しないでください
// 生成日時: 2025-12-15T16:08:15.088Z

// このファイルには、すべての静的リソースが文字列またはbase64データとして埋め込まれています

const resources = {
  "assets/icon.svg": \\\`<?xml version="1.0" encoding="UTF-8"?>
<svg id="_レイヤー_2" data-name="レイヤー 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 331.07 331.07">
  <defs>
    <style>
      .cls-1 {
        fill: #323333;
      }
    </style>
  </defs>
  <g id="_レイヤー_1-2" data-name="レイヤー 1">
    <path class="cls-1" d="M165.53,0C74.26,0,0,74.26,0,165.53s74.26,165.54,165.53,165.54,165.54-74.26,165.54-165.54S256.81,0,165.53,0ZM13.71,199.35c-2.42-10.89-3.71-22.21-3.71-33.82C10,79.77,79.77,10,165.53,10s155.54,69.77,155.54,155.53c0,11.61-1.29,22.93-3.71,33.82H13.71Z"/>
  </g>
</svg>\\\`,
  "css/style.css": \\\`* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: fot-udkakugoc80-pro, sans-serif;
  background: linear-gradient(135deg, #0b0d12 0%, #1a1d29 100%);
  color: #e5e7eb;
  font-weight: 400;
  font-style: normal;
  min-height: 100vh;
  padding: 20px;
}

.container {
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  min-height: calc(100vh - 40px);
  align-items: flex-start;
  align-content: flex-start;
}

/* 上段左: デバイス設定 */
.controls {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
  max-width: 500px;
}

/* 上段右: プレビュー */
.visualizer {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
}

.range-settings-section {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
  max-width: 500px;
}

.log-sections {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
}

/* コントロールパネルと履歴パネル */
.controls,
.history-panel {
  width: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.controls:hover,
.history-panel:hover {
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.controls h2,
.history-panel h3,
.visualizer-title {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #f1f5f9;
  font-weight: 700;
  border-bottom: 2px solid #334155;
  padding-bottom: 12px;
}

.controls h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #cbd5e1;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

/* ビジュアライザー */
.visualizer {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 400px;
}

.meter-container {
  position: relative;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  background: #00ff00; /* Green for chroma key */
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #1e293b;
}

#icons-container {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* モードセレクター */
.mode-selector {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
  border: 1px solid #334155;
}

.mode-selector label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 400;
  transition: color 0.2s ease;
}

.mode-selector label:hover {
  color: #f1f5f9;
}

/* カスタムチェックボックス */
.mode-selector input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #475569;
  border-radius: 6px;
  background: #0b1220;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mode-selector input[type="checkbox"]:hover {
  border-color: #64748b;
  background: #1e293b;
}

.mode-selector input[type="checkbox"]:checked {
  background: #5FADCF;
  border-color: #7F57B8;
}

.mode-selector input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 14px;
  font-weight: bold;
}

/* デバイス入力 */
.device-inputs {
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.device-group label {
  font-size: 13px;
  margin-bottom: 4px;
}

.device-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  gap: 8px;
}

.device-group label {
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ip-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}


/* 手動操作セクション */
#manual-controls {
  flex: 1 1 100%;
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  margin-top: 0;
}

.manual-controls-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 12px;
}

/* 値の範囲設定セクション */
.range-settings-section {
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.range-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.range-settings-section h3 {
  grid-column: 1 / -1;
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #cbd5e1;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

/* 値の範囲設定セクションの入力欄 */
.range-settings-section .device-group input[type="number"],
.range-settings-section .device-group input[type="text"] {
  margin-top: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 14px;
  font-weight: 400;
  transition: all 0.2s ease;
  font-family: inherit;
  width: 100%;
}

.range-settings-section .device-group input[type="number"]:focus,
.range-settings-section .device-group input[type="text"]:focus {
  outline: none;
  border-color: #5FADCF;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

.range-settings-section .device-group input[type="number"]:hover,
.range-settings-section .device-group input[type="text"]:hover {
  border-color: #475569;
}

.range-settings-section .device-group input[type="text"]::placeholder {
  color: #64748b;
}

/* 数値入力のスピナーボタンのスタイル */
.range-settings-section .device-group input[type="number"]::-webkit-inner-spin-button,
.range-settings-section .device-group input[type="number"]::-webkit-outer-spin-button {
  opacity: 1;
  cursor: pointer;
  height: 20px;
}

.range-settings-section .device-group input[type="number"]::-webkit-inner-spin-button:hover,
.range-settings-section .device-group input[type="number"]::-webkit-outer-spin-button:hover {
  opacity: 0.8;
}

/* ログ再生セクション */
.log-replay-section {
  padding: 0;
  background: transparent;
  border: none;
}

.log-sections {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.log-replay-section label,
.log-record-section label {
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.log-replay-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.log-replay-buttons button {
  flex: 1;
}

/* ログ記録セクション */
.log-record-section {
  padding: 0;
  background: transparent;
  border: none;
}

.log-record-status {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.log-record-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.log-record-buttons button {
  flex: 1;
}

#manual-controls .device-group {
  margin-bottom: 0;
}

#manual-controls label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #cbd5e1;
  margin-bottom: 8px;
}

#manual-controls label span {
  color: #5FADCF;
  font-weight: 700;
  font-size: 16px;
}

/* カスタムスライダー */
input[type="range"] {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #1e293b;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5FADCF;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: #7F57B8;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5FADCF;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

input[type="range"]::-moz-range-thumb:hover {
  background: #7F57B8;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

input[type="range"]::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: #1e293b;
}

/* ボタン */
.control-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

button {
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  border: none;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  box-shadow: 0 2px 4px rgba(95, 173, 207, 0.3);
  flex: 1;
  min-width: 80px;
}

button:hover {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(95, 173, 207, 0.3);
}

button:disabled {
  background: #334155;
  color: #64748b;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

button:disabled:hover {
  background: #334155;
  transform: none;
}

/* ステータス */
.status {
  margin-top: 16px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status input[type="number"] {
  width: 80px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  transition: all 0.2s ease;
}

.status input[type="number"]:focus {
  outline: none;
  border-color: #5FADCF;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

/* アイコンファイル入力（ボタンのみ） */
.icon-file-button {
  position: relative;
  display: block;
  width: 100%;
  height: 36px;
  cursor: pointer;
}

.icon-file-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.icon-button-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid #334155;
  background: linear-gradient(135deg, #334155 0%, #475569 100%);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
  font-family: inherit;
  box-sizing: border-box;
}

.icon-file-button:hover .icon-button-text {
  background: linear-gradient(135deg, #475569 0%, #64748b 100%);
  color: #f1f5f9;
  border-color: #475569;
}

.icon-file-input:focus + .icon-button-text {
  outline: none;
  border-color: #5FADCF;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

/* 登録済み状態（アイコンが設定されている場合） */
.icon-file-button.has-icon .icon-button-text {
  border-color: #5FADCF;
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  color: #fff;
}

.icon-file-button.has-icon:hover .icon-button-text {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  border-color: #7F57B8;
}

/* ログ再生のファイル入力 */
.log-replay-section input[type="file"] {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.log-replay-section input[type="file"]:hover {
  border-color: #475569;
  background: #0f172a;
}

.log-replay-section input[type="file"]:focus {
  outline: none;
  border-color: #5FADCF;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

.log-replay-section input[type="file"]::file-selector-button {
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 12px;
  font-family: inherit;
}

.log-replay-section input[type="file"]::file-selector-button:hover {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(127, 87, 184, 0.3);
}

/* 履歴パネル */
#history-content {
  max-height: 600px;
  overflow-y: auto;
  padding-right: 8px;
}

#history-content::-webkit-scrollbar {
  width: 6px;
}

#history-content::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 3px;
}

#history-content::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

#history-content::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

#history-content > div {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid #334155;
  font-size: 13px;
  font-weight: 400;
  color: #cbd5e1;
  transition: all 0.2s ease;
  line-height: 1.5;
}

#history-content > div:hover {
  background: rgba(15, 23, 42, 0.7);
  border-color: #475569;
}

#history-content > div:first-child {
  background: rgba(95, 173, 207, 0.1);
  border-color: #5FADCF;
}

/* スクロールバーのスタイル */
.controls::-webkit-scrollbar {
  width: 8px;
}

.controls::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 4px;
}

.controls::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

.controls::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

/* レスポンシブデザイン */
@media (max-width: 1200px) {
  .controls,
  .visualizer,
  .range-settings-section,
  .log-sections {
    flex: 1 1 100%;
    max-width: 100%;
  }
  
  .log-sections {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  body {
    padding: 12px;
  }

  .container {
    gap: 16px;
  }

  .controls,
  .visualizer,
  .range-settings-section,
  .log-sections {
    min-width: 100%;
  }

  .history-panel,
  .visualizer {
    padding: 16px;
  }

  button {
    width: 100%;
  }
  
  .range-grid {
    grid-template-columns: 1fr;
  }
}
\\\`,
  "generate-log.js": \\\`// Generate log data with simultaneous independent device movements
// Each device moves independently to different target values at different times
// Devices can increase or decrease simultaneously

const fs = require('fs');
const path = require('path');

function generateLog() {
  const records = [];
  const totalDuration = 30000; // 30 seconds total
  const interval = 200; // 200ms sampling interval
  const tau = 0.5; // Time constant (0.5 seconds) for exponential movement
  
  // Interpolate value from start to target using exponential function
  // f(x) = target - (target - start) * e^(-x/tau)
  function interpolateValue(startValue, targetValue, elapsedTime) {
    const diff = targetValue - startValue;
    const value = targetValue - diff * Math.exp(-elapsedTime / tau);
    return Math.round(Math.max(0, Math.min(100, value)));
  }
  
  // Device state tracking
  class DeviceState {
    constructor(id) {
      this.id = id;
      this.currentValue = Math.floor(Math.random() * 101); // Random initial value 0-100
      this.targetValue = this.currentValue;
      this.startValue = this.currentValue; // Value at start of current movement
      this.movementStartTime = 0;
      this.isMoving = false;
      this.movementDuration = 0;
    }
    
    // Start a new movement to a random target
    startMovement(currentTime) {
      // Update current value to actual value at this moment (if moving, interpolate)
      if (this.isMoving) {
        this.currentValue = this.getValueAtTime(currentTime, false);
      }
      
      // Generate random target (different from current)
      let newTarget;
      do {
        newTarget = Math.floor(Math.random() * 101);
      } while (Math.abs(newTarget - this.currentValue) < 10); // At least 10 points difference
      
      this.startValue = this.currentValue;
      this.targetValue = newTarget;
      this.movementStartTime = currentTime;
      this.isMoving = true;
      // Random movement duration between 2-6 seconds
      this.movementDuration = 2000 + Math.random() * 4000;
    }
    
    // Get value at a given time
    getValueAtTime(currentTime, updateState = true) {
      if (!this.isMoving) {
        return this.currentValue;
      }
      
      const elapsed = (currentTime - this.movementStartTime) / 1000; // Convert to seconds
      
      if (elapsed >= this.movementDuration / 1000) {
        // Movement complete
        const finalValue = this.targetValue;
        if (updateState) {
          this.currentValue = finalValue;
          this.isMoving = false;
        }
        return finalValue;
      }
      
      // Interpolate during movement
      return interpolateValue(this.startValue, this.targetValue, elapsed);
    }
    
    // Check if should start new movement (random chance)
    shouldStartNewMovement(currentTime, minTimeBetweenMovements = 1000) {
      if (this.isMoving) return false;
      const timeSinceLastMovement = currentTime - (this.movementStartTime + this.movementDuration);
      if (timeSinceLastMovement < minTimeBetweenMovements) return false;
      
      // Random chance to start movement (higher chance as time passes)
      const chance = Math.min(0.3, (timeSinceLastMovement - minTimeBetweenMovements) / 5000);
      return Math.random() < chance;
    }
  }
  
  // Initialize 4 devices with random initial states
  const devices = [];
  for (let i = 1; i <= 4; i++) {
    const device = new DeviceState(i);
    // Random initial delay before first movement (0-3 seconds)
    device.movementStartTime = -Math.random() * 3000;
    devices.push(device);
  }
  
  // Generate records for all time points
  for (let t = 0; t <= totalDuration; t += interval) {
    for (const device of devices) {
      // Check if device should start a new movement
      if (device.shouldStartNewMovement(t)) {
        device.startMovement(t);
      }
      
      // Get current value
      const value = device.getValueAtTime(t);
      
      // Record value
      records.push({
        id: device.id,
        value: value,
        ts: t
      });
    }
  }
  
  // Sort by timestamp, then by device ID
  records.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.id - b.id;
  });
  
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, 'positionVisualizer', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Write to file
  const filename = path.join(logsDir, 'meter-log-simulated-30s-simultaneous.json');
  fs.writeFileSync(filename, JSON.stringify(records, null, 2), 'utf8');
  
  console.log(\\\\\\\`Generated \\\\\\\${records.length} records\\\\\\\`);
  console.log(\\\\\\\`Total duration: \\\\\\\${totalDuration / 1000} seconds\\\\\\\`);
  console.log(\\\\\\\`Devices: 4 (independent simultaneous movements)\\\\\\\`);
  console.log(\\\\\\\`Saved to: \\\\\\\${filename}\\\\\\\`);
  
  // Print sample values showing simultaneous movements
  console.log('\\\\\\\\nSample values showing simultaneous movements (first 30 records):');
  records.slice(0, 30).forEach(r => {
    console.log(\\\\\\\`  t=\\\\\\\${r.ts}ms: device \\\\\\\${r.id} = \\\\\\\${r.value}\\\\\\\`);
  });
  
  // Show example of simultaneous movement
  console.log('\\\\\\\\nExample simultaneous movement (around 5000ms):');
  records.filter(r => r.ts >= 4800 && r.ts <= 5200).forEach(r => {
    console.log(\\\\\\\`  t=\\\\\\\${r.ts}ms: device \\\\\\\${r.id} = \\\\\\\${r.value}\\\\\\\`);
  });
}

generateLog();

\\\`,
  "index.html": \\\`<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>positionVisualizer</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="preload" href="assets/icon.svg" as="image" type="image/svg+xml">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <script>
      (function(d) {
        var config = { kitId: 'kaz6zgt', scriptTimeout: 3000, async: true },
        h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\\\\\\\bwf-loading\\\\\\\\b/g,"")+" wf-inactive";},config.scriptTimeout),
        tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";
        tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;
        tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};
        s.parentNode.insertBefore(tk,s)
      })(document);
    </script>
    <style>
      /* Fallback styles */
      .container{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;justify-content:center;padding:0;max-width:100%;min-height:calc(100vh - 40px);margin:0 auto;}
      .controls{flex:0 1 calc(50% - 10px);min-width:300px;max-width:500px;height:480px;border:1px solid #334155;padding:20px;border-radius:16px}
      .visualizer{flex:1 1 calc(50% - 10px);min-width:300px;max-width:740px;height:480px;border:1px solid #334155;padding:24px;border-radius:16px;min-height:400px}
      .range-settings-section{flex:0 1 calc(50% - 10px);min-width:300px;max-width:500px;border:1px solid #334155;padding:16px;border-radius:16px}
      .log-sections{flex:1 1 calc(50% - 10px);min-width:300px;max-width:740px;border:1px solid #334155;padding:16px;border-radius:16px}
      .meter-container{position:relative;width:100%;max-width:980px;margin:0 auto;aspect-ratio:16/9}
      #icons-container{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
      button{cursor:pointer}

      /* オーバーレイボタン用スタイル */
      .visualizer-header {display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;}
      .overlay-button {
        background-color: #334155;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        font-size: 14px;
        transition: all 0.2s;
      }
      .overlay-button:hover {
        background-color: #1e293b;
      }
    </style>
    <script>
      // キャッシュクリア用のビルドクエリ
      window.__buildTs = Date.now();
    </script>
</head>
<body>
    <div class="container">
        <div class="controls">
            <h2>デバイス設定</h2>
            <div class="device-inputs">
                <div class="device-group">
                    <label>デバイス1</label>
                    <label class="icon-file-button" for="device1-icon">
                        <input type="file" id="device1-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス2</label>
                    <label class="icon-file-button" for="device2-icon">
                        <input type="file" id="device2-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス3</label>
                    <label class="icon-file-button" for="device3-icon">
                        <input type="file" id="device3-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス4</label>
                    <label class="icon-file-button" for="device4-icon">
                        <input type="file" id="device4-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス5</label>
                    <label class="icon-file-button" for="device5-icon">
                        <input type="file" id="device5-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス6</label>
                    <label class="icon-file-button" for="device6-icon">
                        <input type="file" id="device6-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
            </div>
        </div>

        <div class="visualizer">
            <div class="visualizer-header">
                <h2 class="visualizer-title">プレビュー</h2>
                <button id="open-overlay" class="overlay-button" title="オーバーレイウィンドウを開く">
                    オーバーレイを開く
                </button>
            </div>
            <div class="meter-container" id="meter-container">
                <div id="icons-container"></div>
            </div>
        </div>
        <div class="range-settings-section">
            <h3>値の範囲設定</h3>
            <div class="range-grid">
                <div class="device-group">
                    <label>最小値</label>
                    <input type="number" id="min-value" value="0" step="0.1">
                </div>
                <div class="device-group">
                    <label>最大値</label>
                    <input type="number" id="max-value" value="100" step="0.1">
                </div>
                <div class="device-group">
                    <label>単位</label>
                    <input type="text" id="value-unit" value="%" placeholder="例: %, °, kg">
                </div>
            </div>
        </div>
        
        <div class="log-sections">
            <div class="log-replay-section">
                <label>ログ再生</label>
                <input type="file" id="log-file" accept="application/json,.json">
                <div class="log-replay-buttons">
                    <button id="play-log">再生</button>
                    <button id="stop-log">停止</button>
                </div>
            </div>
            <div class="log-record-section">
                <label>ログ記録</label>
                <div class="log-record-status" id="log-record-status">停止中</div>
                <div class="log-record-buttons">
                    <button id="start-record">記録開始</button>
                    <button id="stop-record">記録終了</button>
                </div>
            </div>
        </div>
    </div>

    <script>window.USE_MVVM = true;</script>
    <script src="src/app/main.js"></script>
    <script>
        // オーバーレイを開くボタンの機能を追加
        document.addEventListener('DOMContentLoaded', function() {
            const openOverlayButton = document.getElementById('open-overlay');
            if (openOverlayButton) {
                openOverlayButton.addEventListener('click', function() {
                    // 別ウィンドウでオーバーレイを開く
                    window.open('overlay.html', 'overlay_window', 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no');
                });
            }
        });
    </script>
</body>
</html>


\\\`,
  "integrated-server.js": \\\`// integrated-server.js
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
  const match = String(deviceId).match(/(\\\\\\\\d+)$/);
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

        const filename = data.filename || \\\\\\\`meter-log-\\\\\\\${Date.now()}.json\\\\\\\`;
        const filepath = path.join(jsonDir, filename);
        const jsonContent = JSON.stringify(data.records, null, 2);

        fs.writeFile(filepath, jsonContent, 'utf8', (err) => {
          if (err) {
            console.error('Failed to save log:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save log file' }));
            return;
          }
          console.log(\\\\\\\`Log saved: \\\\\\\${filepath}\\\\\\\`);
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
        console.log(\\\\\\\`[bridge] device_update: device_id=\\\\\\\${device_id}, index=\\\\\\\${index}, value=\\\\\\\${valueData.value}\\\\\\\`);

        if (index >= 0 && index < 6 && typeof valueData.value === 'number') {
          latest.values[index] = valueData.value;
          latest.ts = Date.now();
          console.log(\\\\\\\`[bridge] Broadcasting update: index=\\\\\\\${index}, value=\\\\\\\${valueData.value}\\\\\\\`);
          broadcast({ type: 'state', payload: latest });
        } else {
          console.log(\\\\\\\`[bridge] device_update: invalid index or value (index=\\\\\\\${index}, value=\\\\\\\${valueData.value})\\\\\\\`);
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
  console.log(\\\\\\\`HTTPサーバーが起動しました http://\\\\\\\${HTTP_HOST}:\\\\\\\${HTTP_PORT}\\\\\\\`);
  console.log(\\\\\\\`WebSocketエンドポイント: ws://\\\\\\\${HTTP_HOST}:\\\\\\\${WS_PORT}\\\\\\\`);
  console.log(\\\\\\\`静的ファイル配信元: \\\\\\\${appDir}\\\\\\\`);

  // LeverAPIに接続
  connectToLeverAPI();

  // ブラウザを開く
  openBrowser();

  // コンソール表示
  console.log('\\\\\\\\n----------------------------------------');
  console.log('サーバーが起動しました');
  console.log('終了するには Q または q キーを押すか、Ctrl+C を押してください');
  console.log('----------------------------------------\\\\\\\\n');

  // キー入力待機
  waitForKeyPress();
});

// エラーハンドリング
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\\\\\\\`ポート \\\\\\\${HTTP_PORT} は既に使用されています。\\\\\\\`);
    console.error(\\\\\\\`ポート \\\\\\\${HTTP_PORT} を使用しているアプリケーションを終了するか、HTTP_PORT環境変数を設定して別のポートを使用してください。\\\\\\\`);
  } else {
    console.error('サーバーエラー:', err);
  }
  process.exit(1);
});

// ブラウザを開く関数
function openBrowser() {
  const url = \\\\\\\`http://\\\\\\\${HTTP_HOST}:\\\\\\\${HTTP_PORT}/\\\\\\\`;
  const overlayUrl = \\\\\\\`http://\\\\\\\${HTTP_HOST}:\\\\\\\${HTTP_PORT}/overlay.html\\\\\\\`;

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
    exec(\\\\\\\`\\\\\\\${command} "\\\\\\\${url}"\\\\\\\`);

    // 少し待ってからオーバーレイを開く（必ず別ウィンドウで）
    setTimeout(() => {
      if (process.platform === 'win32') {
        // Windowsでは新しいウィンドウを強制するオプションを指定
        exec(\\\\\\\`\\\\\\\${overlayCommand} "" "\\\\\\\${overlayUrl}"\\\\\\\`);
      } else if (process.platform === 'darwin') {
        // macOSでは -n オプションで必ず新しいウィンドウを開く
        exec(\\\\\\\`\\\\\\\${overlayCommand} "\\\\\\\${overlayUrl}"\\\\\\\`);
      } else {
        // Linuxなど
        exec(\\\\\\\`\\\\\\\${overlayCommand} "\\\\\\\${overlayUrl}"\\\\\\\`);
      }
    }, 1000);

    console.log(\\\\\\\`ブラウザが開きました: \\\\\\\${url}\\\\\\\`);
    console.log(\\\\\\\`オーバーレイ(別ウィンドウ): \\\\\\\${overlayUrl}\\\\\\\`);
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
});\\\`,
  "js/core/event.js": \\\`(function(){
  function Emitter(){ this.listeners = {}; }
  Emitter.prototype.on = function(event, fn){
    (this.listeners[event] ||= new Set()).add(fn); return () => this.off(event, fn);
  };
  Emitter.prototype.off = function(event, fn){
    const set = this.listeners[event]; if (!set) return; set.delete(fn);
  };
  Emitter.prototype.emit = function(event, payload){
    const set = this.listeners[event]; if (!set) return; set.forEach(fn => { try{ fn(payload); }catch(_){} });
  };
  window.MVVM = window.MVVM || {}; window.MVVM.Emitter = Emitter;
})();

\\\`,
  "js/core/model.js": \\\`(function(){
  function MeterState(values, names, icon, icons){
    // Initialize values array with null support (null means device not connected)
    if (Array.isArray(values)) {
      const arr = values.slice(0,6);
      while (arr.length < 6) arr.push(null);
      this.values = arr;
    } else {
      this.values = [null, null, null, null, null, null];
    }
    this.names = Array.isArray(names) ? names.slice(0,6) : ['','','','','',''];
    this.icon = icon || 'assets/icon.svg';
    // Per-index icons (optional). Falls back to single icon if not provided
    if (Array.isArray(icons)) {
      const arr = icons.slice(0,6);
      while (arr.length < 6) arr.push(null);
      this.icons = arr;
    } else {
      this.icons = [null, null, null, null, null, null];
    }
  }
  MeterState.prototype.clone = function(){ return new MeterState(this.values.slice(0,6), this.names.slice(0,6), this.icon, this.icons.slice(0,6)); };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterState = MeterState;
})();

\\\`,
  "js/core/viewModel.js": \\\`(function(){
  const Emitter = (window.MVVM && window.MVVM.Emitter);
  const MeterState = (window.MVVM && window.MVVM.MeterState);

  function MeterViewModel(initial){
    this.emitter = new Emitter();
    this.state = initial instanceof MeterState ? initial : new MeterState();
    this.running = false;
    this.pollIntervalMs = 100; // Fixed at 100ms
    this._timer = null;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Interpolation state for smooth animation
    this._interpolationDuration = 200; // ms
    this._interpolations = []; // Array of { index, startValue, targetValue, startTime, endTime }
    this._animationFrameId = null;
  }

  MeterViewModel.prototype.onChange = function(fn){ return this.emitter.on('change', fn); };
  MeterViewModel.prototype._notify = function(){ this.emitter.emit('change', this.state.clone()); };
  MeterViewModel.prototype.setPollInterval = function(ms){ this.pollIntervalMs = 100; }; // Fixed at 100ms, cannot be changed
  MeterViewModel.prototype.setMinValue = function(v){ 
    let min = Number(v);
    if (!isNaN(min)) {
      // Allow any numeric value, but ensure min < max
      if (min >= this.maxValue) {
        this.maxValue = min + 1;
      }
      this.minValue = min;
      this._notify();
    }
  };
  MeterViewModel.prototype.setMaxValue = function(v){ 
    let max = Number(v);
    if (!isNaN(max)) {
      // Allow any numeric value, but ensure max > min
      if (max <= this.minValue) {
        this.minValue = max - 1;
      }
      this.maxValue = max;
      this._notify();
    }
  };
  MeterViewModel.prototype.setUnit = function(v){ 
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };
  
  // Convert actual value to percentage (0-100) for meter position calculation
  MeterViewModel.prototype.normalizeValue = function(actualValue){
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };
  
  // Convert percentage (0-100) back to actual value
  MeterViewModel.prototype.denormalizeValue = function(percentage){
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };
  MeterViewModel.prototype.setName = function(index, name){
    if (index < 0 || index > 5) return; this.state.names[index] = String(name || '').trim() || this.state.names[index]; this._notify();
  };
  MeterViewModel.prototype.setValue = function(index, value, smooth, isNormalized){
    if (index < 0 || index > 5) return; 
    // Allow null to be set (indicates device not connected)
    if (value === null || value === undefined) {
      // Cancel any interpolation for this index
      this._interpolations = this._interpolations.filter(interp => interp.index !== index);
      this.state.values[index] = null;
      this._notify();
      return;
    }
    
    let normalized;
    if (isNormalized === true) {
      // Value is already normalized (0-100), use it directly
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      // Store actual value, but normalize to 0-100 for internal state
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }
    
    // Check if smooth interpolation is enabled (default: true)
    const useSmooth = smooth !== false;
    
    // Get current normalized value (may be null/undefined)
    const currentNormalized = this.state.values[index];
    
    if (useSmooth && currentNormalized !== null && currentNormalized !== undefined && !isNaN(currentNormalized)) {
      // Start interpolation from current value to target value
      const targetNormalized = normalized;
      
      // Only interpolate if there's a meaningful difference (reduced threshold for smoother animation)
      const diff = Math.abs(currentNormalized - targetNormalized);
      if (diff > 0.01) {
        // Remove any existing interpolation for this index
        this._interpolations = this._interpolations.filter(interp => interp.index !== index);
        
        // Add new interpolation
        const now = performance.now();
        this._interpolations.push({
          index: index,
          startValue: currentNormalized,
          targetValue: targetNormalized,
          startTime: now,
          endTime: now + this._interpolationDuration
        });
        
        // Start animation loop if not already running
        this._startInterpolation();
        return;
      }
    }
    
    // Set value immediately (no interpolation or difference too small)
    this.state.values[index] = normalized;
    this._notify();
  };
  
  // Start interpolation animation loop
  MeterViewModel.prototype._startInterpolation = function(){
    if (this._animationFrameId !== null) return; // Already running
    
    const self = this;
    const animate = function(){
      const now = performance.now();
      let needsUpdate = false;
      
      // Update all active interpolations
      self._interpolations.forEach(interp => {
        if (now >= interp.endTime) {
          // Interpolation complete - set to target value
          if (self.state.values[interp.index] !== interp.targetValue) {
            self.state.values[interp.index] = interp.targetValue;
            needsUpdate = true;
          }
        } else {
          // Interpolate between start and target
          const progress = (now - interp.startTime) / (interp.endTime - interp.startTime);
          const clampedProgress = Math.max(0, Math.min(1, progress)); // Ensure 0-1 range
          const currentValue = interp.startValue + (interp.targetValue - interp.startValue) * clampedProgress;
          self.state.values[interp.index] = currentValue;
          needsUpdate = true;
        }
      });
      
      // Remove completed interpolations
      const beforeCount = self._interpolations.length;
      self._interpolations = self._interpolations.filter(interp => now < interp.endTime);
      
      // Notify listeners if there was an update
      if (needsUpdate) {
        self._notify();
      }
      
      // Continue animation if there are active interpolations
      if (self._interpolations.length > 0) {
        self._animationFrameId = requestAnimationFrame(animate);
      } else {
        self._animationFrameId = null;
      }
    };
    
    this._animationFrameId = requestAnimationFrame(animate);
  };
  
  // Set interpolation duration
  MeterViewModel.prototype.setInterpolationDuration = function(ms){
    this._interpolationDuration = Math.max(0, Math.min(1000, Number(ms) || 200));
  };
  
  // Get actual value (not normalized) for display
  MeterViewModel.prototype.getActualValue = function(index){
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };
  
  // Get all actual values
  MeterViewModel.prototype.getActualValues = function(){
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };
  
  // Get connected device indices (indices where value is not null)
  MeterViewModel.prototype.getConnectedDeviceIndices = function(){
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };
  MeterViewModel.prototype.setIcon = function(path){ if (path) { this.state.icon = path; this._notify(); } };
  MeterViewModel.prototype.setIconAt = function(index, path){
    if (index < 0 || index > 3) return;
    this.state.icons[index] = String(path || '');
    this._notify();
  };

  MeterViewModel.prototype.setState = function(next){
    if (!next) return;
    if (!(next instanceof MeterState)) next = new MeterState(next.values, next.names, next.icon, next.icons);
    this.state = next;
    this._notify();
  };

  MeterViewModel.prototype.toJSON = function(){
    return { values: this.state.values.slice(0,6), names: this.state.names.slice(0,6), icon: this.state.icon, icons: this.state.icons.slice(0,6) };
  };

  MeterViewModel.prototype.start = function(){
    if (this.running) return; this.running = true;
    // Start polling for device data (handled by MonitorBinding)
    this._notify();
  };

  MeterViewModel.prototype.stop = function(){
    if (!this.running) return; this.running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    // Stop interpolation animation
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    // Complete all interpolations immediately
    this._interpolations.forEach(interp => {
      this.state.values[interp.index] = interp.targetValue;
    });
    this._interpolations = [];
    this._notify();
  };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterViewModel = MeterViewModel;
})();

\\\`,
  "js/views/iconRenderer.js": \\\`// Simple placeholder for potential separate icon rendering logic
// Currently handled inside meterRenderer. Expose a tiny API for compatibility.
(function () {
  function getIpForIndex(index) {
    const input = document.getElementById(\\\\\\\`device\\\\\\\${index + 1}-ip\\\\\\\`);
    return (input && input.value && input.value.trim()) || '';
  }

  // Get min/max/unit from DOM
  function getRangeSettings() {
    const minEl = document.getElementById('min-value');
    const maxEl = document.getElementById('max-value');
    const unitEl = document.getElementById('value-unit');
    const minValue = minEl ? Number(minEl.value) : 0;
    const maxValue = maxEl ? Number(maxEl.value) : 100;
    const unit = unitEl ? (unitEl.value || '%') : '%';
    return { minValue, maxValue, unit };
  }

  // Convert normalized percentage (0-100) to actual value based on min/max settings
  function denormalizeValue(percentage, minValue, maxValue) {
    const range = maxValue - minValue;
    if (range === 0) return minValue;
    return minValue + (percentage / 100) * range;
  }

  // Update value display for an icon
  function updateIconValue(g, index) {
    try {
      if (!g) return;
      
      // Get percentage from data attribute (0-100)
      const percentageAttr = g.getAttribute('data-percentage');
      if (!percentageAttr) return; // No percentage data yet
      
      const percentage = parseFloat(percentageAttr);
      if (isNaN(percentage)) return;
      
      // Get range settings
      const { minValue, maxValue, unit } = getRangeSettings();
      
      // Convert to actual value
      const actualValue = denormalizeValue(percentage, minValue, maxValue);
      const roundedValue = Math.round(actualValue);
      
      // Find or create text element
      let textEl = g.querySelector('text.icon-value');
      if (!textEl) {
        // Check if g is in an SVG context
        if (!g.ownerSVGElement && !g.closest('svg')) return;
        
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('class', 'icon-value');
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '15');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('font-weight', '700');
        textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        textEl.setAttribute('fill', '#ffffff');
        textEl.setAttribute('paint-order', 'stroke');
        textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        textEl.setAttribute('stroke-width', '3');
        g.appendChild(textEl);
      }
      
      // Update text content
      textEl.textContent = \\\\\\\`\\\\\\\${roundedValue}\\\\\\\${unit}\\\\\\\`;
      textEl.setAttribute('data-actual', String(roundedValue));
      textEl.setAttribute('data-unit', unit);
    } catch (error) {
      console.error('Error updating icon value:', error);
    }
  }

  // Cache range settings to avoid repeated DOM queries
  let cachedRangeSettings = null;
  let rangeSettingsCacheTime = 0;
  const RANGE_SETTINGS_CACHE_MS = 100; // Cache for 100ms

  function getCachedRangeSettings() {
    const now = Date.now();
    if (!cachedRangeSettings || (now - rangeSettingsCacheTime) > RANGE_SETTINGS_CACHE_MS) {
      cachedRangeSettings = getRangeSettings();
      rangeSettingsCacheTime = now;
    }
    return cachedRangeSettings;
  }

  // Update all icon values
  function updateAllIconValues() {
    try {
      const svg = document.querySelector('#meter-container svg[data-meter]');
      if (!svg) return;
      
      // Get range settings once for all icons
      const { minValue, maxValue, unit } = getCachedRangeSettings();
      
      for (let i = 0; i < 6; i++) {
        const g = svg.querySelector(\\\\\\\`g[data-perf="\\\\\\\${i}"]\\\\\\\`);
        if (g && g.style.display !== 'none') {
          updateIconValueFast(g, i, minValue, maxValue, unit);
        }
      }
    } catch (error) {
      console.error('Error updating all icon values:', error);
    }
  }

  // Fast version that accepts pre-fetched range settings
  function updateIconValueFast(g, index, minValue, maxValue, unit) {
    try {
      if (!g) return;
      
      const percentageAttr = g.getAttribute('data-percentage');
      if (!percentageAttr) return;
      
      const percentage = parseFloat(percentageAttr);
      if (isNaN(percentage)) return;
      
      const actualValue = denormalizeValue(percentage, minValue, maxValue);
      const roundedValue = Math.round(actualValue);
      
      let textEl = g.querySelector('text.icon-value');
      if (!textEl) {
        if (!g.ownerSVGElement && !g.closest('svg')) return;
        
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('class', 'icon-value');
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '15');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('font-weight', '700');
        textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        textEl.setAttribute('fill', '#ffffff');
        textEl.setAttribute('paint-order', 'stroke');
        textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        textEl.setAttribute('stroke-width', '3');
        g.appendChild(textEl);
      }
      
      const newText = \\\\\\\`\\\\\\\${roundedValue}\\\\\\\${unit}\\\\\\\`;
      if (textEl.textContent !== newText) {
        textEl.textContent = newText;
        textEl.setAttribute('data-actual', String(roundedValue));
        textEl.setAttribute('data-unit', unit);
      }
    } catch (error) {
      console.error('Error updating icon value:', error);
    }
  }

  function applyVisibility() {
    try {
      const svg = document.querySelector('#meter-container svg[data-meter]');
      if (!svg) return;
      for (let i = 0; i < 4; i++) {
        const g = svg.querySelector(\\\\\\\`g[data-perf="\\\\\\\${i}"]\\\\\\\`);
        if (!g) continue;
        const hasIp = !!getIpForIndex(i);
        g.style.display = hasIp ? '' : 'none';
      }
      // Update values immediately using requestAnimationFrame for smooth updates
      requestAnimationFrame(() => updateAllIconValues());
    } catch (error) {
      console.error('Error applying visibility:', error);
    }
  }

  function setupListeners() {
    ['device1-ip','device2-ip','device3-ip','device4-ip'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', applyVisibility);
      el.addEventListener('change', applyVisibility);
    });

    // Listen to range settings changes
    ['min-value', 'max-value', 'value-unit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateAllIconValues);
        el.addEventListener('change', updateAllIconValues);
      }
    });

    // Re-apply when meter SVG updates (animations preserved)
    const container = document.getElementById('meter-container');
    if (container && window.MutationObserver) {
      // Track last known values to detect changes
      const lastValues = new Map();
      
      const mo = new MutationObserver((mutations) => {
        try {
          const { minValue, maxValue, unit } = getCachedRangeSettings();
          let hasChildListChange = false;
          
          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'data-percentage' || 
                 mutation.attributeName === 'data-actual')) {
              // Update the specific icon that changed immediately (synchronously)
              const target = mutation.target;
              if (target && target.tagName === 'g' && target.hasAttribute('data-perf')) {
                const index = parseInt(target.getAttribute('data-perf') || '0', 10);
                if (!isNaN(index)) {
                  const percentageAttr = target.getAttribute('data-percentage');
                  if (percentageAttr) {
                    const percentage = parseFloat(percentageAttr);
                    const lastValue = lastValues.get(index);
                    // Only update if value actually changed
                    if (lastValue !== percentage) {
                      lastValues.set(index, percentage);
                      updateIconValueFast(target, index, minValue, maxValue, unit);
                    }
                  }
                }
              }
            } else if (mutation.type === 'childList') {
              hasChildListChange = true;
            }
          });
          
          // If new icons were added, update all
          if (hasChildListChange) {
            requestAnimationFrame(() => updateAllIconValues());
          }
        } catch (error) {
          console.error('Error in MutationObserver:', error);
        }
      });
      mo.observe(container, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['data-percentage', 'data-actual', 'style']
      });
      
      // Also poll for changes as a fallback to ensure real-time updates
      // This catches any changes that MutationObserver might miss
      let lastPollTime = Date.now();
      const pollInterval = 16; // ~60fps
      
      const pollForChanges = () => {
        const now = Date.now();
        if (now - lastPollTime < pollInterval) {
          requestAnimationFrame(pollForChanges);
          return;
        }
        lastPollTime = now;
        
        try {
          const svg = document.querySelector('#meter-container svg[data-meter]');
          if (!svg) {
            requestAnimationFrame(pollForChanges);
            return;
          }
          
          const { minValue, maxValue, unit } = getCachedRangeSettings();
          
          for (let i = 0; i < 6; i++) {
            const g = svg.querySelector(\\\\\\\`g[data-perf="\\\\\\\${i}"]\\\\\\\`);
            if (!g || g.style.display === 'none') continue;
            
            const percentageAttr = g.getAttribute('data-percentage');
            if (!percentageAttr) continue;
            
            const percentage = parseFloat(percentageAttr);
            if (isNaN(percentage)) continue;
            
            const lastValue = lastValues.get(i);
            if (lastValue !== percentage) {
              lastValues.set(i, percentage);
              updateIconValueFast(g, i, minValue, maxValue, unit);
            }
          }
        } catch (error) {
          console.error('Error in polling:', error);
        }
        
        requestAnimationFrame(pollForChanges);
      };
      
      // Start polling
      requestAnimationFrame(pollForChanges);
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupListeners();
        // Use requestAnimationFrame for faster initial render
        requestAnimationFrame(() => {
          applyVisibility();
          updateAllIconValues();
        });
      });
    } else {
      setupListeners();
      requestAnimationFrame(() => {
        applyVisibility();
        updateAllIconValues();
      });
    }
  }

  function placeIcons() {}

  init();
  window.IconRenderer = { placeIcons, applyVisibility, updateAllIconValues };
})();

\\\`,
  "js/views/meterRenderer.js": \\\`// Gradient meter + ticks + icons rendering
// Public API:
//   initMeter(containerEl)
//   updateMeter(values: number[], options?: { names?: string[], icon?: string })

(function () {
  const baseCx = 251.74;
  const baseCy = 168.17;
  const baseRadius = Math.sqrt((503.48 / 2) ** 2 + (168.17 * 0.52) ** 2);
  const strokeWidth = 100;
  const startAngle = -140;
  const endAngle = -40;
  const LANE_OFFSETS = [-40, -20, 0, 20, 40, 60]; // Fallback for max 6 devices
  const MAX_LANE_OFFSET = 30; // Maximum offset from base radius (within meter bounds)
  const MIN_LANE_OFFSET = -30; // Minimum offset from base radius (within meter bounds)

  // Calculate lane offsets dynamically based on device count
  function calculateLaneOffsets(deviceCount) {
    if (deviceCount <= 0) return [];
    if (deviceCount === 1) return [0]; // Center for single device
    // Distribute evenly between MIN_LANE_OFFSET and MAX_LANE_OFFSET
    const offsets = [];
    for (let i = 0; i < deviceCount; i++) {
      const t = deviceCount === 1 ? 0.5 : i / (deviceCount - 1); // 0 to 1
      const offset = MIN_LANE_OFFSET + (MAX_LANE_OFFSET - MIN_LANE_OFFSET) * t;
      offsets.push(offset);
    }
    return offsets;
  }

  const toRadians = (angle) => (angle * Math.PI) / 180;

  function calculateViewBox() { // 外側の円の大きさを計算（アイコンの位置も考慮）
    const outerRadius = baseRadius + strokeWidth / 2;
    const innerRadius = baseRadius - strokeWidth / 2;
    const angles = [startAngle, endAngle];
    for (let angle = Math.ceil(startAngle); angle <= Math.floor(endAngle); angle++) {
      if (angle % 90 === 0) angles.push(angle);
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    angles.forEach(angle => {
      const rad = (angle * Math.PI) / 180;
      const x_outer = baseCx + outerRadius * Math.cos(rad);
      const y_outer = baseCy + outerRadius * Math.sin(rad);
      const x_inner = baseCx + innerRadius * Math.cos(rad);
      const y_inner = baseCy + innerRadius * Math.sin(rad);
      minX = Math.min(minX, x_outer, x_inner);
      maxX = Math.max(maxX, x_outer, x_inner);
      minY = Math.min(minY, y_outer, y_inner);
      maxY = Math.max(maxY, y_outer, y_inner);
    });

    // Consider icon positions (icons are 50x50, with offsets up to 60)
    const maxIconOffset = Math.max(...LANE_OFFSETS.map(Math.abs));
    const iconRadius = 25; // Half of icon size (50/2)
    const maxRadius = baseRadius + maxIconOffset + iconRadius;

    // Check icon positions at start and end angles
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const iconPositions = [
      { x: baseCx + maxRadius * Math.cos(startRad), y: baseCy + maxRadius * Math.sin(startRad) },
      { x: baseCx + maxRadius * Math.cos(endRad), y: baseCy + maxRadius * Math.sin(endRad) }
    ];

    // Also check middle positions for icons
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const angle = startAngle + (endAngle - startAngle) * t;
      const angleRad = toRadians(angle);
      const radius = baseRadius + maxIconOffset;
      const x = baseCx + radius * Math.cos(angleRad);
      const y = baseCy + radius * Math.sin(angleRad);
      minX = Math.min(minX, x - iconRadius);
      maxX = Math.max(maxX, x + iconRadius);
      minY = Math.min(minY, y - iconRadius);
      maxY = Math.max(maxY, y + iconRadius);
    }

    // Add extra padding to ensure icons are never clipped
    const padding = 30; // Increased padding for overlay
    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      offsetX: -minX + padding,
      offsetY: -minY + padding
    };
  }

  const viewBox = calculateViewBox();
  const cx = baseCx + viewBox.offsetX;
  const cy = baseCy + viewBox.offsetY;

  function describeArc() {
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const innerRadius = baseRadius - strokeWidth / 2;
    const outerRadius = baseRadius + strokeWidth / 2;
    const x1 = cx + innerRadius * Math.cos(startRad);
    const y1 = cy + innerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(startRad);
    const y2 = cy + outerRadius * Math.sin(startRad);
    const x3 = cx + outerRadius * Math.cos(endRad);
    const y3 = cy + outerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(endRad);
    const y4 = cy + innerRadius * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return \\\\\\\`M \\\\\\\${x1} \\\\\\\${y1} L \\\\\\\${x2} \\\\\\\${y2} A \\\\\\\${outerRadius} \\\\\\\${outerRadius} 0 \\\\\\\${largeArc} 1 \\\\\\\${x3} \\\\\\\${y3} L \\\\\\\${x4} \\\\\\\${y4} A \\\\\\\${innerRadius} \\\\\\\${innerRadius} 0 \\\\\\\${largeArc} 0 \\\\\\\${x1} \\\\\\\${y1}\\\\\\\`;
  }

  function calculateIconPosition(percentage, laneIndex, deviceCount) {
    const clamped = Math.max(0, Math.min(100, percentage));
    const t = clamped / 100;
    const angle = startAngle + (endAngle - startAngle) * t;
    const angleRad = toRadians(angle);

    // Use dynamic lane offsets if deviceCount is provided, otherwise fallback to fixed offsets
    let laneOffsets;
    if (deviceCount && deviceCount > 0) {
      laneOffsets = calculateLaneOffsets(deviceCount);
    } else {
      laneOffsets = LANE_OFFSETS;
    }

    // Clamp laneIndex to valid range
    const safeLaneIndex = Math.max(0, Math.min(laneOffsets.length - 1, laneIndex));
    const offset = laneOffsets[safeLaneIndex] || 0;
    const radius = baseRadius + offset;
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    return { x, y };
  }

  function updateTickLabels(svg, minValue, maxValue, unit) {
    if (!svg) return;

    // Remove existing label group
    const existingGroup = svg.querySelector('g.tick-labels-group');
    if (existingGroup) {
      existingGroup.remove();
    }

  }

  function ensureSvg(containerEl) {
    let svg = containerEl.querySelector('svg[data-meter]');
    if (svg) return svg;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-meter', '');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', \\\\\\\`0 0 \\\\\\\${viewBox.width} \\\\\\\${viewBox.height}\\\\\\\`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.display = 'block';
    svg.style.verticalAlign = 'middle';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'meterGradient');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', String(viewBox.height / 2));
    gradient.setAttribute('x2', String(viewBox.width));
    gradient.setAttribute('y2', String(viewBox.height / 2));
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s1.setAttribute('offset', '0'); s1.setAttribute('stop-color', '#71cce2');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s2.setAttribute('offset', '1'); s2.setAttribute('stop-color', '#6e40a9');
    gradient.append(s1, s2);

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'iconShadow');
    const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    fe.setAttribute('dx', '0'); fe.setAttribute('dy', '2'); fe.setAttribute('stdDeviation', '3'); fe.setAttribute('flood-opacity', '0.3');
    filter.appendChild(fe);
    // Circle mask for icons (objectBoundingBox units to keep it centered)
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', 'maskIconCircle');
    mask.setAttribute('maskContentUnits', 'objectBoundingBox');
    mask.setAttribute('maskUnits', 'objectBoundingBox');
    const maskCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    maskCircle.setAttribute('cx', '0.5');
    maskCircle.setAttribute('cy', '0.5');
    maskCircle.setAttribute('r', '0.5');
    maskCircle.setAttribute('fill', '#fff');
    mask.appendChild(maskCircle);
    defs.append(gradient, filter, mask);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('data-arc', '');
    path.setAttribute('d', describeArc());
    path.setAttribute('fill', 'url(#meterGradient)');

    svg.append(defs, path);

    // ticks
    const tickCount = 11;
    const totalAngle = endAngle - startAngle;
    for (let i = 1; i < tickCount; i++) {
      const angle = startAngle + (totalAngle / tickCount) * i;
      const angleRad = toRadians(angle);
      const innerR = baseRadius - strokeWidth / 2;
      const outerR = baseRadius - strokeWidth / 2 + 10;
      const x1 = cx + innerR * Math.cos(angleRad);
      const y1 = cy + innerR * Math.sin(angleRad);
      const x2 = cx + outerR * Math.cos(angleRad);
      const y2 = cy + outerR * Math.sin(angleRad);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', '#fff'); line.setAttribute('stroke-width', '3');
      svg.appendChild(line);
    }

    containerEl.innerHTML = '';
    containerEl.appendChild(svg);
    return svg;
  }

  function updateMeter(values, options) {
    const icon = (options && options.icon !== undefined) ? options.icon : null; // Default to null instead of 'assets/icon.svg'
    const icons = (options && options.icons) || null; // per-index icons
    const connectedDeviceIndices = (options && options.connectedDeviceIndices) || null; // null means calculate from values (non-null indices)
    const actualValues = (options && options.actualValues) || null; // Actual values for display (not normalized)
    const unit = (options && options.unit) || '%'; // Unit for display
    const minValue = (options && typeof options.minValue === 'number') ? options.minValue : 0;
    const maxValue = (options && typeof options.maxValue === 'number') ? options.maxValue : 100;

    // Calculate device count from connected device indices
    let deviceCount = 0;
    if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
      deviceCount = connectedDeviceIndices.length;
    } else {
      // If null, count non-null values (including 0)
      deviceCount = values.filter(v => v !== null && v !== undefined && !isNaN(v)).length;
    }
    // If no devices connected, don't render anything (early return)
    if (deviceCount === 0) {
      // Remove all existing icons
      const containerEl = document.getElementById('meter-container');
      const svg = containerEl ? containerEl.querySelector('svg[data-meter]') : null;
      if (svg) {
        svg.querySelectorAll('g[data-perf]').forEach(g => g.remove());
      }
      return;
    }

    // Helper function to convert normalized value (0-100%) to actual value based on min/max settings
    function denormalizeValue(percentage) {
      const range = maxValue - minValue;
      if (range === 0) return minValue; // Avoid division by zero
      return minValue + (percentage / 100) * range;
    }

    const containerEl = document.getElementById('meter-container');
    const svg = ensureSvg(containerEl);

    const existing = new Map();
    svg.querySelectorAll('g[data-perf]').forEach(g => {
      existing.set(g.getAttribute('data-perf'), g);
    });

    values.slice(0, 6).forEach((val, index) => {
      // Skip if value is null (device not connected)
      if (val === null || val === undefined) {
        // Remove icon if it exists
        const existingG = svg.querySelector(\\\\\\\`g[data-perf="\\\\\\\${index}"]\\\\\\\`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      // Skip if this index should be hidden (when connectedDeviceIndices is specified)
      if (connectedDeviceIndices !== null && !connectedDeviceIndices.includes(index)) {
        // Remove icon if it exists
        const existingG = svg.querySelector(\\\\\\\`g[data-perf="\\\\\\\${index}"]\\\\\\\`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      // Map index to lane index based on connected device indices
      let laneIndex = 0;
      if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
        const positionInConnected = connectedDeviceIndices.indexOf(index);
        laneIndex = positionInConnected >= 0 ? positionInConnected : 0;
      } else {
        // If no connected device indices specified, use index directly (but limit to deviceCount)
        laneIndex = index % deviceCount;
      }

      const numericVal = Number(val);
      const safeVal = Number.isFinite(numericVal) ? numericVal : 0;
      const pos = calculateIconPosition(safeVal, laneIndex, deviceCount);

      let g = svg.querySelector(\\\\\\\`g[data-perf="\\\\\\\${index}"]\\\\\\\`);
      if (!g) {
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-perf', String(index));
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.style.willChange = 'transform';

        // Background user image (if provided), masked as circle
        const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        const bgHref = (icons && icons[index]) ? icons[index] : '';
        if (bgHref) {
          bgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', bgHref);
          bgImage.setAttribute('href', bgHref);
          bgImage.style.display = 'block';
        } else {
          bgImage.style.display = 'none';
        }
        bgImage.setAttribute('x', String(-25));
        bgImage.setAttribute('y', String(-25));
        bgImage.setAttribute('width', '50');
        bgImage.setAttribute('height', '50');
        bgImage.setAttribute('mask', 'url(#maskIconCircle)');

        // Foreground SVG icon (only if icon is provided)
        let fgImage = null;
        if (icon) {
          fgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          fgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
          fgImage.setAttribute('href', icon);
          fgImage.setAttribute('x', String(-25));
          fgImage.setAttribute('y', String(-25));
          fgImage.setAttribute('width', '50');
          fgImage.setAttribute('height', '50');
          fgImage.setAttribute('filter', 'url(#iconShadow)');
        }

        // Machine-readable attributes for UI parsing
        const displayValue = actualValues && actualValues[index] !== undefined
          ? actualValues[index]
          : denormalizeValue(safeVal);
        const roundedDisplay = Math.round(displayValue);
        g.setAttribute('data-percentage', String(Math.max(0, Math.min(100, safeVal))));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);

        // Append in order: background, foreground (if exists)
        if (fgImage) {
          g.append(bgImage, fgImage);
        } else {
          g.append(bgImage);
        }
        // Set initial transform (no animation on first paint)
        g.setAttribute('transform', \\\\\\\`translate(\\\\\\\${pos.x}, \\\\\\\${pos.y})\\\\\\\`);
        svg.appendChild(g);
      } else {
        // Remove any existing text element(legacy)
        const t = g.querySelector('text');
        if (t) {
          t.remove();
        }
        // Update machine-readable attributes
        const displayValue = actualValues && actualValues[index] !== undefined
          ? actualValues[index]
          : denormalizeValue(safeVal);
        const roundedDisplay = Math.round(displayValue);
        const clampedPercent = Math.max(0, Math.min(100, safeVal));
        g.setAttribute('data-percentage', String(clampedPercent));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);
        // Update background user icon and foreground SVG icon
        const imgs = g.querySelectorAll('image');
        // imgs[0] -> bg, imgs[1] -> fg (if exists)
        const bg = imgs[0];
        const fg = imgs.length >= 2 ? imgs[1] : null;

        if (bg) {
          const desiredBg = (icons && icons[index]) ? icons[index] : '';
          if (desiredBg) {
            if (bg.getAttribute('href') !== desiredBg) {
              bg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', desiredBg);
              bg.setAttribute('href', desiredBg);
            }
            bg.style.display = 'block';
          } else {
            // If no bg icon, clear href AND hide
            if (bg.getAttribute('href')) {
              bg.removeAttribute('href');
              bg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
            }
            bg.style.display = 'none';
          }
        }

        // Handle foreground icon
        if (icon) {
          // Icon should be shown
          if (fg) {
            // Update existing foreground icon
            if (fg.getAttribute('href') !== icon) {
              fg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
              fg.setAttribute('href', icon);
            }
          } else {
            // Create new foreground icon
            const newFg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            newFg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
            newFg.setAttribute('href', icon);
            newFg.setAttribute('x', String(-25));
            newFg.setAttribute('y', String(-25));
            newFg.setAttribute('width', '50');
            newFg.setAttribute('height', '50');
            newFg.setAttribute('filter', 'url(#iconShadow)');
            g.appendChild(newFg);
          }
        } else {
          // Icon should be hidden - remove foreground icon if it exists
          if (fg) {
            fg.remove();
          }
        }
        // Trigger transition by changing transform only
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.setAttribute('transform', \\\\\\\`translate(\\\\\\\${pos.x}, \\\\\\\${pos.y})\\\\\\\`);
      }
      existing.delete(String(index));
    });

    // Remove any extra stale groups
    existing.forEach((g) => g.remove());

    // Update tick labels with min/max values (after all other updates)
    updateTickLabels(svg, minValue, maxValue, unit);
  }

  function initMeter(containerEl) {
    ensureSvg(containerEl);
  }

  window.MeterRenderer = { initMeter, updateMeter };
})();

\\\`,
  "jsconfig.json": \\\`{
  "compilerOptions": {
    // Environment setup & latest features
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,

    // Bundler mode
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,

    // Best practices
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Some stricter flags (disabled by default)
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  }
}
\\\`,
  "overlay.html": \\\`<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LeverScope - Overlay</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <script>
      (function(d) {
        var config = { kitId: 'kaz6zgt', scriptTimeout: 3000, async: true },
        h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\\\\\\\bwf-loading\\\\\\\\b/g,"")+" wf-inactive";},config.scriptTimeout),
        tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";
        tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;
        tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};
        s.parentNode.insertBefore(tk,s)
      })(document);
    </script>
    <style>
      html,body{margin:0;padding:0;background:#00ff00;overflow:hidden} /* Green for chroma key */
      .overlay-root{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:#00ff00} /* Green for chroma key */
      .meter-only{width:100%;max-width:1920px;padding:120px;margin:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center} /* Increased padding to prevent icon clipping */
      #meter-container{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
      #meter-container svg{display:block;margin:0 auto}
      /* Optional safe padding for cropping */
      .pad{padding:0}
    </style>
</head>
<body>
  <div class="overlay-root">
    <div id="meter-container" class="meter-only"></div>
  </div>

  <script>window.USE_MVVM = true;</script>
  <script src="src/app/overlayApp.js"></script>
</body>
</html>


\\\`,
  "package-lock.json": \\\`{
  "name": "lever-scope",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "lever-scope",
      "version": "1.0.0",
      "license": "ISC",
      "dependencies": {
        "socket.io-client": "^4.7.5",
        "ws": "^8.18.3"
      },
      "bin": {
        "lever-scope": "start-app.js"
      },
      "devDependencies": {
        "pkg": "^5.8.1"
      }
    },
    "node_modules/@babel/generator": {
      "version": "7.18.2",
      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.18.2.tgz",
      "integrity": "sha512-W1lG5vUwFvfMd8HVXqdfbuG7RuaSrTCCD8cl8fP8wOivdbtbIg2Db3IWUcgvfxKbbn6ZBGYRW/Zk1MIwK49mgw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.18.2",
        "@jridgewell/gen-mapping": "^0.3.0",
        "jsesc": "^2.5.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-string-parser": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz",
      "integrity": "sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-identifier": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.28.5.tgz",
      "integrity": "sha512-qSs4ifwzKJSV39ucNjsvc6WVHs6b7S03sOh2OcHF9UHfVPqWWALUsNUVzhSBiItjRZoLHx7nIarVjqKVusUZ1Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/parser": {
      "version": "7.18.4",
      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.18.4.tgz",
      "integrity": "sha512-FDge0dFazETFcxGw/EXzOkN8uJp0PC7Qbm+Pe9T+av2zlBpOgunFHkQPPn+eRuClU73JF+98D531UgayY89tow==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "parser": "bin/babel-parser.js"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/types": {
      "version": "7.19.0",
      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.19.0.tgz",
      "integrity": "sha512-YuGopBq3ke25BVSiS6fgF49Ul9gH1x70Bcr6bqRLjWCkcX8Hre1/5+z+IiWOIerRMSSEfGZVB9z9kyq7wVs9YA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-string-parser": "^7.18.10",
        "@babel/helper-validator-identifier": "^7.18.6",
        "to-fast-properties": "^2.0.0"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.5.tgz",
      "integrity": "sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@socket.io/component-emitter": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@socket.io/component-emitter/-/component-emitter-3.1.2.tgz",
      "integrity": "sha512-9BCxFwvbGg/RsZK9tjXd8s4UcwR0MWeFQ1XEKIQVVvAGJyINdrqKMcTRyLoK8Rse1GjzLV9cwjWV1olXRWEXVA==",
      "license": "MIT"
    },
    "node_modules/agent-base": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/agent-base/-/agent-base-6.0.2.tgz",
      "integrity": "sha512-RZNwNclF7+MS/8bDg70amg32dyeZGZxiDuQmZxKLAlQjr3jGyLx+4Kkk58UO7D2QdgFIQCovuSuZESne6RG6XQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "debug": "4"
      },
      "engines": {
        "node": ">= 6.0.0"
      }
    },
    "node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
      "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/array-union": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/array-union/-/array-union-2.1.0.tgz",
      "integrity": "sha512-HGyxoOTYUyCM6stUe6EJgnd4EoewAI7zMdfqO+kGjnlZmBDz/cR5pf8r/cR4Wq60sL/p0IkcjUEEPwS3GFrIyw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/at-least-node": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/at-least-node/-/at-least-node-1.0.0.tgz",
      "integrity": "sha512-+q/t7Ekv1EDY2l6Gda6LLiX14rU9TV20Wa3ofeQmwPFZbOMo9DXrLbOjFaaclkXKWidIaopwAObQDqwWtGUjqg==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">= 4.0.0"
      }
    },
    "node_modules/base64-js": {
      "version": "1.5.1",
      "resolved": "https://registry.npmjs.org/base64-js/-/base64-js-1.5.1.tgz",
      "integrity": "sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/bl": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/bl/-/bl-4.1.0.tgz",
      "integrity": "sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "buffer": "^5.5.0",
        "inherits": "^2.0.4",
        "readable-stream": "^3.4.0"
      }
    },
    "node_modules/bl/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/buffer": {
      "version": "5.7.1",
      "resolved": "https://registry.npmjs.org/buffer/-/buffer-5.7.1.tgz",
      "integrity": "sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "base64-js": "^1.3.1",
        "ieee754": "^1.1.13"
      }
    },
    "node_modules/chalk": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.1.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/chalk?sponsor=1"
      }
    },
    "node_modules/chownr": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/chownr/-/chownr-1.1.4.tgz",
      "integrity": "sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/cliui": {
      "version": "7.0.4",
      "resolved": "https://registry.npmjs.org/cliui/-/cliui-7.0.4.tgz",
      "integrity": "sha512-OcRE68cOsVMXp1Yvonl/fzkQOyjLSu/8bhPDfQt0e0/Eb283TKP20Fs2MqoPsr9SwA595rRCA+QMzYc9nBP+JQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "string-width": "^4.2.0",
        "strip-ansi": "^6.0.0",
        "wrap-ansi": "^7.0.0"
      }
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
      "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
      "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/core-util-is": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/core-util-is/-/core-util-is-1.0.3.tgz",
      "integrity": "sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/debug": {
      "version": "4.3.7",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.3.7.tgz",
      "integrity": "sha512-Er2nc/H7RrMXZBFCEim6TCmMk02Z8vLC2Rbi1KEBggpo0fS6l0S1nnapwmIi3yW/+GOJap1Krg4w0Hg80oCqgQ==",
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/decompress-response": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/decompress-response/-/decompress-response-6.0.0.tgz",
      "integrity": "sha512-aW35yZM6Bb/4oJlZncMH2LCoZtJXTRxES17vE3hoRiowU2kWHaJKFkSBDnDR+cm9J+9QhXmREyIfv0pji9ejCQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "mimic-response": "^3.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/deep-extend": {
      "version": "0.6.0",
      "resolved": "https://registry.npmjs.org/deep-extend/-/deep-extend-0.6.0.tgz",
      "integrity": "sha512-LOHxIOaPYdHlJRtCQfDIVZtfw/ufM8+rVj649RIHzcm/vGwQRXFt6OPqIFWsm2XEMrNIEtWR64sY1LEKD2vAOA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4.0.0"
      }
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/dir-glob": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/dir-glob/-/dir-glob-3.0.1.tgz",
      "integrity": "sha512-WkrWp9GR4KXfKGYzOLmTuGVi1UWFfws377n9cc55/tb6DuqyF6pcQ5AbiHEshaDpY9v6oaSr2XCDidGmMwdzIA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-type": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/end-of-stream": {
      "version": "1.4.5",
      "resolved": "https://registry.npmjs.org/end-of-stream/-/end-of-stream-1.4.5.tgz",
      "integrity": "sha512-ooEGc6HP26xXq/N+GCGOT0JKCLDGrq2bQUZrQ7gyrJiZANJ/8YDTxTpQBXGMn+WbIQXNVpyWymm7KYVICQnyOg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "once": "^1.4.0"
      }
    },
    "node_modules/engine.io-client": {
      "version": "6.6.3",
      "resolved": "https://registry.npmjs.org/engine.io-client/-/engine.io-client-6.6.3.tgz",
      "integrity": "sha512-T0iLjnyNWahNyv/lcjS2y4oE358tVS/SYQNxYXGAJ9/GLgH4VCvOQ/mhTjqU88mLZCQgiG8RIegFHYCdVC+j5w==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.1",
        "engine.io-parser": "~5.2.1",
        "ws": "~8.17.1",
        "xmlhttprequest-ssl": "~2.1.1"
      }
    },
    "node_modules/engine.io-client/node_modules/ws": {
      "version": "8.17.1",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.17.1.tgz",
      "integrity": "sha512-6XQFvXTkbfUOZOKKILFG1PDK2NDQs4azKQl26T0YS5CxqWLgXajbPZ+h4gZekJyRqFU8pvnbAbbs/3TgRPy+GQ==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    },
    "node_modules/engine.io-parser": {
      "version": "5.2.3",
      "resolved": "https://registry.npmjs.org/engine.io-parser/-/engine.io-parser-5.2.3.tgz",
      "integrity": "sha512-HqD3yTBfnBxIrbnM1DoD6Pcq8NECnh8d4As1Qgh0z5Gg3jRRIqijury0CL3ghu/edArpUYiYqQiDUQBIs4np3Q==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/expand-template": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/expand-template/-/expand-template-2.0.3.tgz",
      "integrity": "sha512-XYfuKMvj4O35f/pOXLObndIRvyQ+/+6AhODh+OKWj9S9498pHHn/IMszH+gt0fBCRWMNfk1ZSp5x3AifmnI2vg==",
      "dev": true,
      "license": "(MIT OR WTFPL)",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fast-glob": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.3.tgz",
      "integrity": "sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fastq": {
      "version": "1.19.1",
      "resolved": "https://registry.npmjs.org/fastq/-/fastq-1.19.1.tgz",
      "integrity": "sha512-GwLTyxkCXjXbxqIhTsMI2Nui8huMPtnxg7krajPJAjnEG/iiOS7i+zCtWGZR9G0NBKbXKh6X9m9UIsYX/N6vvQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/from2": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/from2/-/from2-2.3.0.tgz",
      "integrity": "sha512-OMcX/4IC/uqEPVgGeyfN22LJk6AZrMkRZHxcHBMBvHScDGgwTm2GT2Wkgtocyd3JfZffjj2kYUDXXII0Fk9W0g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.1",
        "readable-stream": "^2.0.0"
      }
    },
    "node_modules/fs-constants": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/fs-constants/-/fs-constants-1.0.0.tgz",
      "integrity": "sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fs-extra": {
      "version": "9.1.0",
      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-9.1.0.tgz",
      "integrity": "sha512-hcg3ZmepS30/7BSFqRvoo3DOMQu7IjqxO5nCDt+zM9XWjb33Wg7ziNT+Qvqbuc3+gWpzO02JubVyk2G4Zvo1OQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "at-least-node": "^1.0.0",
        "graceful-fs": "^4.2.0",
        "jsonfile": "^6.0.1",
        "universalify": "^2.0.0"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
      "integrity": "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-caller-file": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/get-caller-file/-/get-caller-file-2.0.5.tgz",
      "integrity": "sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": "6.* || 8.* || >= 10.*"
      }
    },
    "node_modules/github-from-package": {
      "version": "0.0.0",
      "resolved": "https://registry.npmjs.org/github-from-package/-/github-from-package-0.0.0.tgz",
      "integrity": "sha512-SyHy3T1v2NUXn29OsWdxmK6RwHD+vkj3v8en8AOBZ1wBQ/hCAQ5bAQTD02kW4W9tUp/3Qh6J8r9EvntiyCmOOw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/globby": {
      "version": "11.1.0",
      "resolved": "https://registry.npmjs.org/globby/-/globby-11.1.0.tgz",
      "integrity": "sha512-jhIXaOzy1sb8IyocaruWSn1TjmnBVs8Ayhcy83rmxNJ8q2uWKCAj3CnJY+KpGSXCueAPc0i05kVvVKtP1t9S3g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-union": "^2.1.0",
        "dir-glob": "^3.0.1",
        "fast-glob": "^3.2.9",
        "ignore": "^5.2.0",
        "merge2": "^1.4.1",
        "slash": "^3.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
      "integrity": "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/has": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/has/-/has-1.0.4.tgz",
      "integrity": "sha512-qdSAmqLF6209RFj4VVItywPMbm3vWylknmB3nvNiUIs72xAimcM8nVYxYr7ncvZq5qzk9MKIZR8ijqD/1QuYjQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4.0"
      }
    },
    "node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.2.tgz",
      "integrity": "sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/https-proxy-agent": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/https-proxy-agent/-/https-proxy-agent-5.0.1.tgz",
      "integrity": "sha512-dFcAjpTQFgoLMzC2VwU+C/CbS7uRL0lWmxDITmqm7C+7F0Odmj6s9l6alZc6AELXhrnggM2CeWSXHGOdX2YtwA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "agent-base": "6",
        "debug": "4"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/ieee754": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/ieee754/-/ieee754-1.2.1.tgz",
      "integrity": "sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz",
      "integrity": "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/inherits": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
      "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/ini": {
      "version": "1.3.8",
      "resolved": "https://registry.npmjs.org/ini/-/ini-1.3.8.tgz",
      "integrity": "sha512-JV/yugV2uzW5iMRSiZAyDtQd+nxtUnjeLt0acNdw98kKLrvuRVyB80tsREOE7yvGVgalhZ6RNXCmEHkUKBKxew==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/into-stream": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/into-stream/-/into-stream-6.0.0.tgz",
      "integrity": "sha512-XHbaOAvP+uFKUFsOgoNPRjLkwB+I22JFPFe5OjTkQ0nwgj6+pSjb4NmB6VMxaPshLiOf+zcpOCBQuLwC1KHhZA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "from2": "^2.3.0",
        "p-is-promise": "^3.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.9.0",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.9.0.tgz",
      "integrity": "sha512-+5FPy5PnwmO3lvfMb0AsoPaBG+5KHUI0wYFXOtYPnVVVspTFUuMZNfNaNVRt3FZadstu2c8x23vykRW/NBoU6A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has": "^1.0.3"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-fullwidth-code-point": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz",
      "integrity": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/isarray": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/isarray/-/isarray-1.0.0.tgz",
      "integrity": "sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/jsesc": {
      "version": "2.5.2",
      "resolved": "https://registry.npmjs.org/jsesc/-/jsesc-2.5.2.tgz",
      "integrity": "sha512-OYu7XEzjkCQ3C5Ps3QIZsQfNpqoJyZZA99wd9aWd05NCtC5pWOkShK2mkL6HXQR6/Cy2lbNdPlZBpuQHXE63gA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jsesc": "bin/jsesc"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/jsonfile": {
      "version": "6.2.0",
      "resolved": "https://registry.npmjs.org/jsonfile/-/jsonfile-6.2.0.tgz",
      "integrity": "sha512-FGuPw30AdOIUTRMC2OMRtQV+jkVj2cfPqSeWXv1NEAJ1qZ5zb1X6z1mFhbfOB/iy3ssJCD+3KuZ8r8C3uVFlAg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "universalify": "^2.0.0"
      },
      "optionalDependencies": {
        "graceful-fs": "^4.1.6"
      }
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "resolved": "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz",
      "integrity": "sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/mimic-response": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/mimic-response/-/mimic-response-3.1.0.tgz",
      "integrity": "sha512-z0yWI+4FDrrweS8Zmt4Ej5HdJmky15+L2e6Wgn3+iK5fWzb6T3fhNFq2+MeTRb064c6Wr4N/wv0DzQTjNzHNGQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/minimist/-/minimist-1.2.8.tgz",
      "integrity": "sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/mkdirp-classic": {
      "version": "0.5.3",
      "resolved": "https://registry.npmjs.org/mkdirp-classic/-/mkdirp-classic-0.5.3.tgz",
      "integrity": "sha512-gKLcREMhtuZRwRAfqP3RFW+TK4JqApVBtOIftVgjuABpAtpxhPGaDcfvbhNvD0B8iD1oUr/txX35NjcaY6Ns/A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "license": "MIT"
    },
    "node_modules/multistream": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/multistream/-/multistream-4.1.0.tgz",
      "integrity": "sha512-J1XDiAmmNpRCBfIWJv+n0ymC4ABcf/Pl+5YvC5B/D2f/2+8PtHvCNxMPKiQcZyi922Hq69J2YOpb1pTywfifyw==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "once": "^1.4.0",
        "readable-stream": "^3.6.0"
      }
    },
    "node_modules/multistream/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/napi-build-utils": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/napi-build-utils/-/napi-build-utils-1.0.2.tgz",
      "integrity": "sha512-ONmRUqK7zj7DWX0D9ADe03wbwOBZxNAfF20PlGfCWQcD3+/MakShIHrMqx9YwPTfxDdF1zLeL+RGZiR9kGMLdg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/node-abi": {
      "version": "3.85.0",
      "resolved": "https://registry.npmjs.org/node-abi/-/node-abi-3.85.0.tgz",
      "integrity": "sha512-zsFhmbkAzwhTft6nd3VxcG0cvJsT70rL+BIGHWVq5fi6MwGrHwzqKaxXE+Hl2GmnGItnDKPPkO5/LQqjVkIdFg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "semver": "^7.3.5"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/node-fetch": {
      "version": "2.7.0",
      "resolved": "https://registry.npmjs.org/node-fetch/-/node-fetch-2.7.0.tgz",
      "integrity": "sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "whatwg-url": "^5.0.0"
      },
      "engines": {
        "node": "4.x || >=6.0.0"
      },
      "peerDependencies": {
        "encoding": "^0.1.0"
      },
      "peerDependenciesMeta": {
        "encoding": {
          "optional": true
        }
      }
    },
    "node_modules/once": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
      "integrity": "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "wrappy": "1"
      }
    },
    "node_modules/p-is-promise": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/p-is-promise/-/p-is-promise-3.0.0.tgz",
      "integrity": "sha512-Wo8VsW4IRQSKVXsJCn7TomUaVtyfjVDn3nUP7kE967BQk0CwFpdbZs0X0uk5sW9mkBa9eNM7hCMaG93WUAwxYQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/path-parse/-/path-parse-1.0.7.tgz",
      "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/path-type": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-type/-/path-type-4.0.0.tgz",
      "integrity": "sha512-gDKb8aZMDeD/tZWs9P6+q0J9Mwkdl6xMV8TjnGP3qJVJ06bdMgkbBlLU8IdfOsIsFz2BW1rNVT3XuNEl8zPAvw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/picomatch": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.1.tgz",
      "integrity": "sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pkg": {
      "version": "5.8.1",
      "resolved": "https://registry.npmjs.org/pkg/-/pkg-5.8.1.tgz",
      "integrity": "sha512-CjBWtFStCfIiT4Bde9QpJy0KeH19jCfwZRJqHFDFXfhUklCx8JoFmMj3wgnEYIwGmZVNkhsStPHEOnrtrQhEXA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/generator": "7.18.2",
        "@babel/parser": "7.18.4",
        "@babel/types": "7.19.0",
        "chalk": "^4.1.2",
        "fs-extra": "^9.1.0",
        "globby": "^11.1.0",
        "into-stream": "^6.0.0",
        "is-core-module": "2.9.0",
        "minimist": "^1.2.6",
        "multistream": "^4.1.0",
        "pkg-fetch": "3.4.2",
        "prebuild-install": "7.1.1",
        "resolve": "^1.22.0",
        "stream-meter": "^1.0.4"
      },
      "bin": {
        "pkg": "lib-es5/bin.js"
      },
      "peerDependencies": {
        "node-notifier": ">=9.0.1"
      },
      "peerDependenciesMeta": {
        "node-notifier": {
          "optional": true
        }
      }
    },
    "node_modules/pkg-fetch": {
      "version": "3.4.2",
      "resolved": "https://registry.npmjs.org/pkg-fetch/-/pkg-fetch-3.4.2.tgz",
      "integrity": "sha512-0+uijmzYcnhC0hStDjm/cl2VYdrmVVBpe7Q8k9YBojxmR5tG8mvR9/nooQq3QSXiQqORDVOTY3XqMEqJVIzkHA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chalk": "^4.1.2",
        "fs-extra": "^9.1.0",
        "https-proxy-agent": "^5.0.0",
        "node-fetch": "^2.6.6",
        "progress": "^2.0.3",
        "semver": "^7.3.5",
        "tar-fs": "^2.1.1",
        "yargs": "^16.2.0"
      },
      "bin": {
        "pkg-fetch": "lib-es5/bin.js"
      }
    },
    "node_modules/prebuild-install": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/prebuild-install/-/prebuild-install-7.1.1.tgz",
      "integrity": "sha512-jAXscXWMcCK8GgCoHOfIr0ODh5ai8mj63L2nWrjuAgXE6tDyYGnx4/8o/rCgU+B4JSyZBKbeZqzhtwtC3ovxjw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "detect-libc": "^2.0.0",
        "expand-template": "^2.0.3",
        "github-from-package": "0.0.0",
        "minimist": "^1.2.3",
        "mkdirp-classic": "^0.5.3",
        "napi-build-utils": "^1.0.1",
        "node-abi": "^3.3.0",
        "pump": "^3.0.0",
        "rc": "^1.2.7",
        "simple-get": "^4.0.0",
        "tar-fs": "^2.0.0",
        "tunnel-agent": "^0.6.0"
      },
      "bin": {
        "prebuild-install": "bin.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/process-nextick-args": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/process-nextick-args/-/process-nextick-args-2.0.1.tgz",
      "integrity": "sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/progress": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/progress/-/progress-2.0.3.tgz",
      "integrity": "sha512-7PiHtLll5LdnKIMw100I+8xJXR5gW2QwWYkT6iJva0bXitZKa/XMrSbdmg3r2Xnaidz9Qumd0VPaMrZlF9V9sA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/pump": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/pump/-/pump-3.0.3.tgz",
      "integrity": "sha512-todwxLMY7/heScKmntwQG8CXVkWUOdYxIvY2s0VWAAMh/nd8SoYiRaKjlr7+iCs984f2P8zvrfWcDDYVb73NfA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "end-of-stream": "^1.1.0",
        "once": "^1.3.1"
      }
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/rc": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/rc/-/rc-1.2.8.tgz",
      "integrity": "sha512-y3bGgqKj3QBdxLbLkomlohkvsA8gdAiUQlSBJnBhfn+BPxg4bc62d8TcBW15wavDfgexCgccckhcZvywyQYPOw==",
      "dev": true,
      "license": "(BSD-2-Clause OR MIT OR Apache-2.0)",
      "dependencies": {
        "deep-extend": "^0.6.0",
        "ini": "~1.3.0",
        "minimist": "^1.2.0",
        "strip-json-comments": "~2.0.1"
      },
      "bin": {
        "rc": "cli.js"
      }
    },
    "node_modules/readable-stream": {
      "version": "2.3.8",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-2.3.8.tgz",
      "integrity": "sha512-8p0AUk4XODgIewSi0l8Epjs+EVnWiK7NoDIEGU0HhE7+ZyY8D1IMY7odu5lRrFXGg71L15KG8QrPmum45RTtdA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "core-util-is": "~1.0.0",
        "inherits": "~2.0.3",
        "isarray": "~1.0.0",
        "process-nextick-args": "~2.0.0",
        "safe-buffer": "~5.1.1",
        "string_decoder": "~1.1.1",
        "util-deprecate": "~1.0.1"
      }
    },
    "node_modules/require-directory": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz",
      "integrity": "sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.11",
      "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.22.11.tgz",
      "integrity": "sha512-RfqAvLnMl313r7c9oclB1HhUEAezcpLjz95wFH4LVuhk9JF/r22qmVP9AMmOU4vMX7Q8pN8jwNg/CSpdFnMjTQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve/node_modules/is-core-module": {
      "version": "2.16.1",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.16.1.tgz",
      "integrity": "sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/reusify/-/reusify-1.1.0.tgz",
      "integrity": "sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/run-parallel/-/run-parallel-1.2.0.tgz",
      "integrity": "sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/safe-buffer": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.1.2.tgz",
      "integrity": "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "7.7.3",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.7.3.tgz",
      "integrity": "sha512-SdsKMrI9TdgjdweUSR9MweHA4EJ8YxHn8DFaDisvhVlUOe4BF1tLD7GAj0lIqWVl+dPb/rExr0Btby5loQm20Q==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/simple-concat": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/simple-concat/-/simple-concat-1.0.1.tgz",
      "integrity": "sha512-cSFtAPtRhljv69IK0hTVZQ+OfE9nePi/rtJmw5UjHeVyVroEqJXP1sFztKUy1qU+xvz3u/sfYJLa947b7nAN2Q==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/simple-get": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/simple-get/-/simple-get-4.0.1.tgz",
      "integrity": "sha512-brv7p5WgH0jmQJr1ZDDfKDOSeWWg+OVypG99A/5vYGPqJ6pxiaHLy8nxtFjBA7oMa01ebA9gfh1uMCFqOuXxvA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "decompress-response": "^6.0.0",
        "once": "^1.3.1",
        "simple-concat": "^1.0.0"
      }
    },
    "node_modules/slash": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/slash/-/slash-3.0.0.tgz",
      "integrity": "sha512-g9Q1haeby36OSStwb4ntCGGGaKsaVSjQ68fBxoQcutl5fS1vuY18H3wSt3jFyFtrkx+Kz0V1G85A4MyAdDMi2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/socket.io-client": {
      "version": "4.8.1",
      "resolved": "https://registry.npmjs.org/socket.io-client/-/socket.io-client-4.8.1.tgz",
      "integrity": "sha512-hJVXfu3E28NmzGk8o1sHhN3om52tRvwYeidbj7xKy2eIIse5IoKX3USlS6Tqt3BHAtflLIkCQBkzVrEEfWUyYQ==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.2",
        "engine.io-client": "~6.6.1",
        "socket.io-parser": "~4.2.4"
      },
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/socket.io-parser": {
      "version": "4.2.4",
      "resolved": "https://registry.npmjs.org/socket.io-parser/-/socket.io-parser-4.2.4.tgz",
      "integrity": "sha512-/GbIKmo8ioc+NIWIhwdecY0ge+qVBSMdgxGygevmdHj24bsfgtCmcUUcQ5ZzcylGFHsN3k4HB4Cgkl96KVnuew==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.1"
      },
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/stream-meter": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/stream-meter/-/stream-meter-1.0.4.tgz",
      "integrity": "sha512-4sOEtrbgFotXwnEuzzsQBYEV1elAeFSO8rSGeTwabuX1RRn/kEq9JVH7I0MRBhKVRR0sJkr0M0QCH7yOLf9fhQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "readable-stream": "^2.1.4"
      }
    },
    "node_modules/string_decoder": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/string_decoder/-/string_decoder-1.1.1.tgz",
      "integrity": "sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "safe-buffer": "~5.1.0"
      }
    },
    "node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-json-comments": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-2.0.1.tgz",
      "integrity": "sha512-4gB8na07fecVVkOI6Rs4e7T6NOTki5EmL7TUduTs6bu3EdnSycntVJ4re8kgZA+wx9IueI2Y11bfbgwtzuE0KQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/supports-color": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
      "integrity": "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/supports-preserve-symlinks-flag/-/supports-preserve-symlinks-flag-1.0.0.tgz",
      "integrity": "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tar-fs": {
      "version": "2.1.4",
      "resolved": "https://registry.npmjs.org/tar-fs/-/tar-fs-2.1.4.tgz",
      "integrity": "sha512-mDAjwmZdh7LTT6pNleZ05Yt65HC3E+NiQzl672vQG38jIrehtJk/J3mNwIg+vShQPcLF/LV7CMnDW6vjj6sfYQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chownr": "^1.1.1",
        "mkdirp-classic": "^0.5.2",
        "pump": "^3.0.0",
        "tar-stream": "^2.1.4"
      }
    },
    "node_modules/tar-stream": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/tar-stream/-/tar-stream-2.2.0.tgz",
      "integrity": "sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "bl": "^4.0.3",
        "end-of-stream": "^1.4.1",
        "fs-constants": "^1.0.0",
        "inherits": "^2.0.3",
        "readable-stream": "^3.1.1"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/tar-stream/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/to-fast-properties": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/to-fast-properties/-/to-fast-properties-2.0.0.tgz",
      "integrity": "sha512-/OaKK0xYrs3DmxRYqL/yDc+FxFUVYhDlXMhRmv3z915w2HF1tnN1omB354j8VUGO/hbRzyD6Y3sA7v7GS/ceog==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/tr46": {
      "version": "0.0.3",
      "resolved": "https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz",
      "integrity": "sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/tunnel-agent": {
      "version": "0.6.0",
      "resolved": "https://registry.npmjs.org/tunnel-agent/-/tunnel-agent-0.6.0.tgz",
      "integrity": "sha512-McnNiV1l8RYeY8tBgEpuodCC1mLUdbSN+CYBL7kJsJNInOP8UjDDEwdk6Mw60vdLLrr5NHKZhMAOSrR2NZuQ+w==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "safe-buffer": "^5.0.1"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/universalify": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/universalify/-/universalify-2.0.1.tgz",
      "integrity": "sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlRUtConJRlvaw6DuX0wO5Jeko9sWrMBhh+PsYAZ7oXAiOnf/UKogyiw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 10.0.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
      "integrity": "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/webidl-conversions": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-3.0.1.tgz",
      "integrity": "sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==",
      "dev": true,
      "license": "BSD-2-Clause"
    },
    "node_modules/whatwg-url": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/whatwg-url/-/whatwg-url-5.0.0.tgz",
      "integrity": "sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "tr46": "~0.0.3",
        "webidl-conversions": "^3.0.0"
      }
    },
    "node_modules/wrap-ansi": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-7.0.0.tgz",
      "integrity": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.0.0",
        "string-width": "^4.1.0",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/wrap-ansi?sponsor=1"
      }
    },
    "node_modules/wrappy": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz",
      "integrity": "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/ws": {
      "version": "8.18.3",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.18.3.tgz",
      "integrity": "sha512-PEIGCY5tSlUt50cqyMXfCzX+oOPqN0vuGqWzbcJ2xvnkzkq46oOpz7dQaTDBdfICb4N14+GARUDw2XV2N4tvzg==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    },
    "node_modules/xmlhttprequest-ssl": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/xmlhttprequest-ssl/-/xmlhttprequest-ssl-2.1.2.tgz",
      "integrity": "sha512-TEU+nJVUUnA4CYJFLvK5X9AOeH4KvDvhIfm0vV1GaQRtchnG0hgK5p8hw/xjv8cunWYCsiPCSDzObPyhEwq3KQ==",
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/y18n": {
      "version": "5.0.8",
      "resolved": "https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz",
      "integrity": "sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yargs": {
      "version": "16.2.0",
      "resolved": "https://registry.npmjs.org/yargs/-/yargs-16.2.0.tgz",
      "integrity": "sha512-D1mvvtDG0L5ft/jGWkLpG1+m0eQxOfaBvTNELraWj22wSVUMWxZUvYgJYcKh6jGGIkJFhH4IZPQhR4TKpc8mBw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cliui": "^7.0.2",
        "escalade": "^3.1.1",
        "get-caller-file": "^2.0.5",
        "require-directory": "^2.1.1",
        "string-width": "^4.2.0",
        "y18n": "^5.0.5",
        "yargs-parser": "^20.2.2"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yargs-parser": {
      "version": "20.2.9",
      "resolved": "https://registry.npmjs.org/yargs-parser/-/yargs-parser-20.2.9.tgz",
      "integrity": "sha512-y11nGElTIV+CT3Zv9t7VKl+Q3hTQoT9a1Qzezhhl6Rp21gJ/IVTW7Z3y9EWXhuUBC2Shnf+DX0antecpAwSP8w==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    }
  }
}
\\\`,
  "package.json": \\\`{
  "name": "lever-scope",
  "version": "1.0.0",
  "description": "レバー位置可視化アプリケーション",
  "main": "integrated-server.js",
  "bin": "integrated-server.js",
  "scripts": {
    "test": "echo \\\\\\\\"Error: no test specified\\\\\\\\" && exit 1",
    "start": "node integrated-server.js",
    "build": "npm run build:win && npm run build:mac",
    "build:win": "bun build ./integrated-server.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverVisualizer.exe",
    "build:mac": "bun build ./integrated-server.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverVisualizer",

    "build:servers": "npm run build:http && npm run build:bridge",
    "bundle-static": "node ./tools/bundle-static.js",

    "build:http": "npm run bundle-static && npm run build:http:win && npm run build:http:mac",
    "build:http:win": "bun build ./tools/http-server-bundled.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverHTTP.exe",
    "build:http:mac": "bun build ./tools/http-server-bundled.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverHTTP",

    "build:http:nobundle": "npm run build:http:nobundle:win && npm run build:http:nobundle:mac",
    "build:http:nobundle:win": "bun build ./tools/http-server.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverHTTP.exe",
    "build:http:nobundle:mac": "bun build ./tools/http-server.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverHTTP",

    "build:bridge": "npm run build:bridge:win && npm run build:bridge:mac",
    "build:bridge:win": "bun build ./tools/bridge-server.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverBridge.exe",
    "build:bridge:mac": "bun build ./tools/bridge-server.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverBridge",

    "build:api": "npm run build:api:win && npm run build:api:mac",
    "build:api:win": "cd ../LeverAPI && python -m PyInstaller --onefile --collect-submodules=dns --collect-submodules=eventlet --hidden-import=engineio.async_drivers.eventlet --hidden-import=api.discovery --hidden-import=api.device_manager --hidden-import=api.transformers --hidden-import=api.cache --name LeverAPI app.py && copy /Y dist\\\\\\\\\\\\\\\\LeverAPI.exe ..\\\\\\\\\\\\\\\\app\\\\\\\\\\\\\\\\Windows\\\\\\\\\\\\\\\\",
    "build:api:mac": "cd ../LeverAPI && python3 -m PyInstaller --onefile --collect-submodules=dns --collect-submodules=eventlet --hidden-import=engineio.async_drivers.eventlet --hidden-import=api.discovery --hidden-import=api.device_manager --hidden-import=api.transformers --hidden-import=api.cache --name LeverAPI app.py && cp dist/LeverAPI ../app/macOS/",
    "build:all": "npm run build && npm run build:servers && npm run build:api",
    "build:all:win": "npm run build:win && npm run build:http:win && npm run build:bridge:win && npm run build:api:win",
    "build:all:mac": "npm run build:mac && npm run build:http:mac && npm run build:bridge:mac && npm run build:api:mac"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/notMelonBread/positionVisualizer.git"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "bugs": {
    "url": "https://github.com/notMelonBread/positionVisualizer/issues"
  },
  "homepage": "https://github.com/notMelonBread/positionVisualizer#readme",
  "dependencies": {
    "ws": "^8.18.3",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "private": true,
  "peerDependencies": {
    "typescript": "^5"
  }
}
\\\`,
  "src/app/main.js": \\\`/**
 * main.js - Application Entry Point
 * メインページのエントリーポイント
 */
(function() {
  'use strict';

  /**
   * スクリプトを動的に読み込む
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (src.includes('meterRenderer.js') && window.MeterRenderer) {
        resolve();
        return;
      }
      if (src.includes('iconRenderer.js') && window.IconRenderer) {
        resolve();
        return;
      }
      if (src.includes('event.js') && window.MVVM && window.MVVM.Emitter) {
        resolve();
        return;
      }
      if (src.includes('model.js') && window.MVVM && window.MVVM.MeterState) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      const cacheBuster = '?v=' + Date.now();
      script.src = src + cacheBuster;
      script.onload = resolve;
      script.onerror = () => {
        console.error('Failed to load script:', src);
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Domain Layerを読み込む
   */
  async function loadDomainLayer() {
    const domainScripts = [
      'src/domain/ValueRange.js',
      'src/domain/DeviceConfig.js',
      'src/domain/DeviceState.js',
      'src/domain/SessionLog.js',
      'src/domain/LogEntry.js'
    ];

    for (const src of domainScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Infra Layerを読み込む
   */
  async function loadInfraLayer() {
    const infraScripts = [
      'src/infra/repositories/DeviceStateRepository.js',
      'src/infra/repositories/ValueRangeRepository.js',
      'src/infra/repositories/DeviceConfigRepository.js',
      'src/infra/repositories/SessionLogRepository.js',
      'src/infra/bridge/WebSocketBridgeClient.js',
      'src/infra/bridge/HttpPollingClient.js',
      'src/infra/storage/LogFileStorage.js',
      'src/infra/storage/SettingsStorage.js',
      'src/infra/sync/OverlayChannel.js'
    ];

    for (const src of infraScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * UseCase Layerを読み込む
   */
  async function loadUseCaseLayer() {
    const useCaseScripts = [
      'src/usecases/LiveMonitorService.js',
      'src/usecases/RecordingService.js',
      'src/usecases/ReplayService.js',
      'src/usecases/SettingsService.js',
      'src/usecases/IconService.js'
    ];

    for (const src of useCaseScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Presentation Layerを読み込む
   */
  async function loadPresentationLayer() {
    // Legacy MVVM modules (for compatibility)
    const legacyScripts = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/views/meterRenderer.js',
      'js/views/iconRenderer.js'
    ];

    for (const src of legacyScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // New Presentation Layer
    const presentationScripts = [
      'src/presentation/viewmodels/MainPageViewModel.js',
      'src/presentation/bindings/MainPageBindings.js'
    ];

    for (const src of presentationScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * アプリケーションを初期化
   */
  async function initApp() {
    try {
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
      }

      // Load all layers in order
      await loadDomainLayer();
      await loadInfraLayer();
      await loadUseCaseLayer();
      await loadPresentationLayer();

      // Verify required modules
      if (!window.ValueRange || !window.DeviceConfig || !window.DeviceState || 
          !window.SessionLog || !window.LogEntry) {
        throw new Error('Domain Layer modules failed to load');
      }

      if (!window.DeviceStateRepository || !window.ValueRangeRepository || 
          !window.DeviceConfigRepository || !window.SessionLogRepository) {
        throw new Error('Infra Layer repositories failed to load');
      }

      if (!window.LogFileStorage || !window.SettingsStorage) {
        throw new Error('Infra Layer storage failed to load');
      }

      if (!window.LiveMonitorService || !window.RecordingService || 
          !window.ReplayService || !window.SettingsService || !window.IconService) {
        throw new Error('UseCase Layer services failed to load');
      }

      if (!window.MainPageViewModel || !window.MainPageBindings) {
        throw new Error('Presentation Layer modules failed to load');
      }

      // Initialize repositories (Infra Layer)
      const deviceStateRepository = new window.DeviceStateRepository();
      const valueRangeRepository = new window.ValueRangeRepository(0, 100, '%');
      const deviceConfigRepository = new window.DeviceConfigRepository();
      const sessionLogRepository = new window.SessionLogRepository();

      // Initialize storage (Infra Layer)
      const logFileStorage = new window.LogFileStorage();
      const settingsStorage = new window.SettingsStorage();

      // Initialize clients (Infra Layer)
      const webSocketClient = new window.WebSocketBridgeClient();
      const overlayChannel = new window.OverlayChannel();

      // Initialize UseCase services
      const liveMonitorService = new window.LiveMonitorService(deviceStateRepository, valueRangeRepository);
      const recordingService = new window.RecordingService(sessionLogRepository, logFileStorage);
      const replayService = new window.ReplayService(logFileStorage, deviceStateRepository);
      const settingsService = new window.SettingsService(valueRangeRepository);
      const iconService = new window.IconService(deviceConfigRepository);

      // Initialize initial state from DOM
      const initialNames = [];
      for (let i = 1; i <= 6; i++) {
        const el = document.getElementById(\\\\\\\`device\\\\\\\${i}-name\\\\\\\`);
        initialNames.push(el ? (el.value || '') : '');
      }

      // Create initial MeterState (legacy compatibility)
      const MeterState = window.MVVM && window.MVVM.MeterState;
      const initial = new MeterState(
        [],
        initialNames,
        null
      );

      // Initialize ViewModel (Presentation Layer)
      const viewModel = new window.MainPageViewModel(
        initial,
        liveMonitorService,
        recordingService,
        replayService,
        settingsService,
        iconService
      );

      // Initialize bindings (Presentation Layer)
      const mainPageBindings = new window.MainPageBindings(
        viewModel,
        liveMonitorService,
        recordingService,
        replayService,
        settingsService,
        iconService,
        webSocketClient,
        overlayChannel
      );
      mainPageBindings.attach();

      // Initialize UI bindings (legacy compatibility)
      if (window.MVVM && window.MVVM.Bindings) {
        const uiBinding = new window.MVVM.Bindings.UIBinding(viewModel);
        uiBinding.monitorBinding = mainPageBindings; // For recording compatibility
        uiBinding.attach();
      }

      // Start monitoring
      viewModel.start();

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      // Show error message to user
      const container = document.querySelector('.container');
      if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'padding: 20px; background: #ffebee; color: #c62828; border-radius: 8px; margin: 20px;';
        errorDiv.innerHTML = '<h3>初期化エラー</h3><p>アプリケーションの初期化に失敗しました。コンソールを確認してください。</p>';
        container.insertBefore(errorDiv, container.firstChild);
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

\\\`,
  "src/app/overlayApp.js": \\\`/**
 * overlayApp.js - Application Entry Point
 * オーバーレイウィンドウのエントリーポイント
 */
(function() {
  'use strict';

  /**
   * スクリプトを動的に読み込む
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (src.includes('meterRenderer.js') && window.MeterRenderer) {
        resolve();
        return;
      }
      if (src.includes('iconRenderer.js') && window.IconRenderer) {
        resolve();
        return;
      }
      if (src.includes('event.js') && window.MVVM && window.MVVM.Emitter) {
        resolve();
        return;
      }
      if (src.includes('model.js') && window.MVVM && window.MVVM.MeterState) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      const cacheBuster = '?v=' + Date.now();
      script.src = src + cacheBuster;
      script.onload = resolve;
      script.onerror = () => {
        console.error('Failed to load script:', src);
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Domain Layerを読み込む
   */
  async function loadDomainLayer() {
    const domainScripts = [
      'src/domain/ValueRange.js',
      'src/domain/DeviceConfig.js',
      'src/domain/DeviceState.js',
      'src/domain/SessionLog.js',
      'src/domain/LogEntry.js'
    ];

    for (const src of domainScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Infra Layerを読み込む
   */
  async function loadInfraLayer() {
    const infraScripts = [
      'src/infra/repositories/DeviceStateRepository.js',
      'src/infra/repositories/ValueRangeRepository.js',
      'src/infra/bridge/WebSocketBridgeClient.js',
      'src/infra/bridge/HttpPollingClient.js',
      'src/infra/storage/LogFileStorage.js',
      'src/infra/sync/OverlayChannel.js'
    ];

    for (const src of infraScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * UseCase Layerを読み込む
   */
  async function loadUseCaseLayer() {
    const useCaseScripts = [
      'src/usecases/ReplayService.js',
      'src/usecases/SettingsService.js'
    ];

    for (const src of useCaseScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Presentation Layerを読み込む
   */
  async function loadPresentationLayer() {
    // Legacy MVVM modules (for compatibility)
    const legacyScripts = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/views/meterRenderer.js',
      'js/views/iconRenderer.js'
    ];

    for (const src of legacyScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // New Presentation Layer
    const presentationScripts = [
      'src/presentation/viewmodels/OverlayViewModel.js',
      'src/presentation/bindings/OverlayBindings.js'
    ];

    for (const src of presentationScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * アプリケーションを初期化
   */
  async function initOverlayApp() {
    try {
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
      }

      // Load all layers in order
      await loadDomainLayer();
      await loadInfraLayer();
      await loadUseCaseLayer();
      await loadPresentationLayer();

      // Verify required modules
      if (!window.ValueRange || !window.DeviceState) {
        throw new Error('Domain Layer modules failed to load');
      }

      if (!window.DeviceStateRepository || !window.ValueRangeRepository) {
        throw new Error('Infra Layer repositories failed to load');
      }

      if (!window.LogFileStorage) {
        throw new Error('Infra Layer storage failed to load');
      }

      if (!window.ReplayService || !window.SettingsService) {
        throw new Error('UseCase Layer services failed to load');
      }

      if (!window.OverlayViewModel || !window.OverlayBindings) {
        throw new Error('Presentation Layer modules failed to load');
      }

      // Initialize repositories (Infra Layer)
      const valueRangeRepository = new window.ValueRangeRepository(0, 100, '%');
      const deviceStateRepository = new window.DeviceStateRepository();

      // Initialize storage (Infra Layer)
      const logFileStorage = new window.LogFileStorage();

      // Initialize clients (Infra Layer)
      const webSocketClient = new window.WebSocketBridgeClient();
      const httpPollingClient = new window.HttpPollingClient();
      const overlayChannel = new window.OverlayChannel();

      // Initialize UseCase services
      const replayService = new window.ReplayService(logFileStorage, deviceStateRepository);
      const settingsService = new window.SettingsService(valueRangeRepository);

      // Create initial MeterState (legacy compatibility)
      const MeterState = window.MVVM && window.MVVM.MeterState;
      const initial = new MeterState([], ['','','','','',''], null);

      // Initialize ViewModel (Presentation Layer)
      const viewModel = new window.OverlayViewModel(
        initial,
        replayService,
        settingsService
      );

      // Initialize bindings (Presentation Layer)
      const overlayBindings = new window.OverlayBindings(
        viewModel,
        webSocketClient,
        httpPollingClient,
        overlayChannel
      );
      overlayBindings.attach();

      console.log('Overlay application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize overlay application:', error);
      // Show error message
      const container = document.getElementById('meter-container');
      if (container) {
        container.innerHTML = '<div style="padding: 20px; color: #c62828;">初期化エラー: コンソールを確認してください</div>';
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initOverlayApp);
  } else {
    initOverlayApp();
  }
})();

\\\`,
  "src/domain/DeviceConfig.js": \\\`/**
 * DeviceConfig - Domain Model
 * デバイスの設定情報（IP、アイコンURLなど）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function DeviceConfig(id, ip, iconUrl, name) {
    this.id = id || null;
    this.ip = String(ip || '').trim();
    this.iconUrl = String(iconUrl || '').trim();
    this.name = String(name || '').trim();
  }

  /**
   * デバイスが設定されているかどうか
   */
  DeviceConfig.prototype.isConfigured = function() {
    return this.ip.length > 0 || this.name.length > 0;
  };

  /**
   * クローンを作成
   */
  DeviceConfig.prototype.clone = function() {
    return new DeviceConfig(this.id, this.ip, this.iconUrl, this.name);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceConfig;
  } else {
    window.DeviceConfig = DeviceConfig;
  }
})();

\\\`,
  "src/domain/DeviceState.js": \\\`/**
 * DeviceState - Domain Model
 * デバイスの状態（正規化値、実際の値、接続状態）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function DeviceState(index, normalizedValue, actualValue, connected) {
    this.index = Number(index) || 0;
    this.normalizedValue = normalizedValue !== null && normalizedValue !== undefined ? Number(normalizedValue) : null;
    this.actualValue = actualValue !== null && actualValue !== undefined ? Number(actualValue) : null;
    this.connected = Boolean(connected);
  }

  /**
   * デバイスが接続されているかどうか
   */
  DeviceState.prototype.isConnected = function() {
    return this.connected && this.normalizedValue !== null;
  };

  /**
   * 値が更新されたかどうか
   */
  DeviceState.prototype.hasChanged = function(other) {
    if (!other || !(other instanceof DeviceState)) return true;
    return this.normalizedValue !== other.normalizedValue ||
           this.actualValue !== other.actualValue ||
           this.connected !== other.connected;
  };

  /**
   * クローンを作成
   */
  DeviceState.prototype.clone = function() {
    return new DeviceState(this.index, this.normalizedValue, this.actualValue, this.connected);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceState;
  } else {
    window.DeviceState = DeviceState;
  }
})();

\\\`,
  "src/domain/LogEntry.js": \\\`/**
 * LogEntry - Domain Model
 * ログエントリ（タイムスタンプ、正規化値、id）を表す純粋なデータクラス
 */
(function () {
  'use strict';

  function LogEntry(timestamp, id, value) {
    this.timestamp = timestamp ? new Date(timestamp) : new Date();
    this.id = id;
    this.value = value;
  }

  /**
   * クローンを作成
   */
  LogEntry.prototype.clone = function () {
    return new LogEntry(this.timestamp, this.id, this.value);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogEntry;
  } else {
    window.LogEntry = LogEntry;
  }
})();

\\\`,
  "src/domain/SessionLog.js": \\\`/**
 * SessionLog - Domain Model
 * セッションログ（開始時刻、終了時刻、ログエントリのリスト）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function SessionLog(startedAt, endedAt, entries) {
    this.startedAt = startedAt ? new Date(startedAt) : new Date();
    this.endedAt = endedAt ? new Date(endedAt) : null;
    this.entries = Array.isArray(entries) ? entries.slice() : [];
  }

  /**
   * ログエントリを追加
   */
  SessionLog.prototype.addEntry = function(entry) {
    if (entry && typeof entry.timestamp !== 'undefined') {
      this.entries.push(entry);
    }
  };

  /**
   * セッションが終了しているかどうか
   */
  SessionLog.prototype.isEnded = function() {
    return this.endedAt !== null;
  };

  /**
   * セッションを終了
   */
  SessionLog.prototype.end = function() {
    if (!this.isEnded()) {
      this.endedAt = new Date();
    }
  };

  /**
   * エントリ数を取得
   */
  SessionLog.prototype.getEntryCount = function() {
    return this.entries.length;
  };

  /**
   * クローンを作成
   */
  SessionLog.prototype.clone = function() {
    return new SessionLog(this.startedAt, this.endedAt, this.entries.slice());
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionLog;
  } else {
    window.SessionLog = SessionLog;
  }
})();

\\\`,
  "src/domain/ValueRange.js": \\\`/**
 * ValueRange - Domain Model
 * 値の範囲（最小値、最大値、単位）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function ValueRange(min, max, unit) {
    this.min = Number(min) || 0;
    this.max = Number(max) || 100;
    this.unit = String(unit || '%').trim() || '%';
    
    // Validation: ensure min < max
    if (this.min >= this.max) {
      this.max = this.min + 1;
    }
  }

  /**
   * 実際の値を0-100の正規化値に変換
   */
  ValueRange.prototype.normalize = function(actualValue) {
    const range = this.max - this.min;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.min) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値（0-100）を実際の値に変換
   */
  ValueRange.prototype.denormalize = function(normalizedValue) {
    const range = this.max - this.min;
    return this.min + (normalizedValue / 100) * range;
  };

  /**
   * 値が範囲内かどうかをチェック
   */
  ValueRange.prototype.isInRange = function(value) {
    return value >= this.min && value <= this.max;
  };

  /**
   * クローンを作成
   */
  ValueRange.prototype.clone = function() {
    return new ValueRange(this.min, this.max, this.unit);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueRange;
  } else {
    window.ValueRange = ValueRange;
  }
})();

\\\`,
  "src/infra/bridge/HttpPollingClient.js": \\\`/**
 * HttpPollingClient - Infra Layer
 * HTTPポーリングでブリッジサーバーから状態を取得するクライアント
 */
(function() {
  'use strict';

  function HttpPollingClient(url, interval) {
    this.url = url || 'http://127.0.0.1:8123/state';
    this.interval = interval || 1500; // Default 1.5 seconds
    this.pollTimer = null;
    this.subscribers = [];
    this.isPolling = false;
  }

  /**
   * ポーリングを開始
   */
  HttpPollingClient.prototype.start = function() {
    if (this.isPolling) return;
    this.isPolling = true;
    this._poll();
  };

  /**
   * ポーリングを停止
   */
  HttpPollingClient.prototype.stop = function() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  };

  /**
   * ポーリング実行
   */
  HttpPollingClient.prototype._poll = function() {
    if (!this.isPolling) return;

    fetch(this.url, { cache: 'no-store' })
      .then(response => {
        if (!response || !response.ok) {
          throw new Error(\\\\\\\`HTTP \\\\\\\${response.status}\\\\\\\`);
        }
        return response.json();
      })
      .then(data => {
        this._notifySubscribers({ type: 'data', data });
      })
      .catch(error => {
        this._notifySubscribers({ type: 'error', error });
      })
      .finally(() => {
        if (this.isPolling) {
          this.pollTimer = setTimeout(() => {
            this.pollTimer = null;
            this._poll();
          }, this.interval);
        }
      });
  };

  /**
   * イベントを購読
   */
  HttpPollingClient.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  HttpPollingClient.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  HttpPollingClient.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HttpPollingClient;
  } else {
    window.HttpPollingClient = HttpPollingClient;
  }
})();

\\\`,
  "src/infra/bridge/WebSocketBridgeClient.js": \\\`/**
 * WebSocketBridgeClient - Infra Layer
 * WebSocket経由でブリッジサーバーと通信するクライアント
 */
(function() {
  'use strict';

  function WebSocketBridgeClient(url) {
    this.url = url || 'ws://127.0.0.1:8123';
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 1500;
    this.subscribers = [];
    this.isConnected = false;
  }

  /**
   * 接続を確立
   */
  WebSocketBridgeClient.prototype.connect = function() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          try {
            this.ws.close();
          } catch (e) {}
          this.ws = null;
        }

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
          this.isConnected = true;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this._notifySubscribers({ type: 'connected' });
          resolve();
        };

        ws.onclose = () => {
          this.isConnected = false;
          this._notifySubscribers({ type: 'disconnected' });
          // Auto-reconnect
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect().catch(() => {}); // Ignore errors during reconnect
            }, this.reconnectDelay);
          }
        };

        ws.onerror = (error) => {
          this._notifySubscribers({ type: 'error', error });
          try {
            ws.close();
          } catch (e) {}
          reject(error);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this._notifySubscribers({ type: 'message', data });
          } catch (e) {
            // Not JSON or invalid format, ignore
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * メッセージを送信
   */
  WebSocketBridgeClient.prototype.send = function(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(message);
        return true;
      } catch (e) {
        console.error('Failed to send message:', e);
        return false;
      }
    }
    return false;
  };

  /**
   * 接続を切断
   */
  WebSocketBridgeClient.prototype.disconnect = function() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  };

  /**
   * イベントを購読
   */
  WebSocketBridgeClient.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  WebSocketBridgeClient.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  WebSocketBridgeClient.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketBridgeClient;
  } else {
    window.WebSocketBridgeClient = WebSocketBridgeClient;
  }
})();

\\\`,
  "src/infra/repositories/DeviceConfigRepository.js": \\\`/**
 * DeviceConfigRepository - Infra Layer
 * DeviceConfigの永続化を管理するRepository
 */
(function() {
  'use strict';

  const DeviceConfig = window.DeviceConfig || (typeof module !== 'undefined' && module.exports ? require('../../domain/DeviceConfig') : null);

  function DeviceConfigRepository() {
    this.configs = new Array(6).fill(null).map((_, i) => {
      return new DeviceConfig(i, '', '', '');
    });
  }

  /**
   * インデックスで取得
   */
  DeviceConfigRepository.prototype.getByIndex = function(index) {
    if (index < 0 || index >= 6) return null;
    return this.configs[index];
  };

  /**
   * デバイスIDで取得
   */
  DeviceConfigRepository.prototype.getByDeviceId = function(deviceId) {
    const index = this._deviceIdToIndex(deviceId);
    if (index >= 0 && index < 6) {
      return this.configs[index];
    }
    return null;
  };

  /**
   * すべての設定を取得
   */
  DeviceConfigRepository.prototype.getAll = function() {
    return this.configs.slice();
  };

  /**
   * 設定を保存
   */
  DeviceConfigRepository.prototype.save = function(config) {
    if (!config || !(config instanceof DeviceConfig)) return;
    if (config.id >= 0 && config.id < 6) {
      this.configs[config.id] = config;
    }
  };

  /**
   * デバイスIDをインデックスに変換
   */
  DeviceConfigRepository.prototype._deviceIdToIndex = function(deviceId) {
    if (!deviceId) return -1;
    const match = String(deviceId).match(/(\\\\\\\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceConfigRepository;
  } else {
    window.DeviceConfigRepository = DeviceConfigRepository;
  }
})();

\\\`,
  "src/infra/repositories/DeviceStateRepository.js": \\\`/**
 * DeviceStateRepository - Infra Layer
 * DeviceStateの永続化を管理するRepository
 */
(function() {
  'use strict';

  const DeviceState = window.DeviceState || (typeof module !== 'undefined' && module.exports ? require('../../domain/DeviceState') : null);

  function DeviceStateRepository() {
    this.states = new Map(); // Map<deviceId, DeviceState>
    this.statesByIndex = new Array(6).fill(null); // Array<DeviceState>
  }

  /**
   * デバイスIDで取得
   */
  DeviceStateRepository.prototype.getByDeviceId = function(deviceId) {
    if (!this.states.has(deviceId)) {
      // インデックスを推測
      const index = this._deviceIdToIndex(deviceId);
      const state = new DeviceState(index, null, null, false);
      this.states.set(deviceId, state);
      if (index >= 0 && index < 6) {
        this.statesByIndex[index] = state;
      }
    }
    return this.states.get(deviceId);
  };

  /**
   * インデックスで取得
   */
  DeviceStateRepository.prototype.getByIndex = function(index) {
    if (index < 0 || index >= 6) return null;
    
    if (!this.statesByIndex[index]) {
      const deviceId = \\\\\\\`lever\\\\\\\${index + 1}\\\\\\\`;
      const state = new DeviceState(index, null, null, false);
      this.states.set(deviceId, state);
      this.statesByIndex[index] = state;
    }
    return this.statesByIndex[index];
  };

  /**
   * すべての状態を取得
   */
  DeviceStateRepository.prototype.getAll = function() {
    return Array.from(this.states.values());
  };

  /**
   * 状態を保存
   */
  DeviceStateRepository.prototype.save = function(deviceState) {
    if (!deviceState || !(deviceState instanceof DeviceState)) return;
    
    this.states.set(\\\\\\\`lever\\\\\\\${deviceState.index + 1}\\\\\\\`, deviceState);
    if (deviceState.index >= 0 && deviceState.index < 6) {
      this.statesByIndex[deviceState.index] = deviceState;
    }
  };

  /**
   * デバイスIDをインデックスに変換
   */
  DeviceStateRepository.prototype._deviceIdToIndex = function(deviceId) {
    if (!deviceId) return -1;
    const match = String(deviceId).match(/(\\\\\\\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceStateRepository;
  } else {
    window.DeviceStateRepository = DeviceStateRepository;
  }
})();

\\\`,
  "src/infra/repositories/SessionLogRepository.js": \\\`/**
 * SessionLogRepository - Infra Layer
 * SessionLogの永続化を管理するRepository
 */
(function() {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../../domain/SessionLog') : null);

  function SessionLogRepository() {
    this.sessions = [];
    this.currentSession = null;
  }

  /**
   * セッションを保存
   */
  SessionLogRepository.prototype.save = function(sessionLog) {
    if (!sessionLog || !(sessionLog instanceof SessionLog)) return;
    
    // 既存のセッションを更新
    const startedAtTime = sessionLog.startedAt instanceof Date ? sessionLog.startedAt.getTime() : sessionLog.startedAt;
    const index = this.sessions.findIndex(s => {
      const sTime = s.startedAt instanceof Date ? s.startedAt.getTime() : s.startedAt;
      return sTime === startedAtTime;
    });
    if (index >= 0) {
      this.sessions[index] = sessionLog;
    } else {
      this.sessions.push(sessionLog);
    }
    
    this.currentSession = sessionLog;
  };

  /**
   * 現在のセッションを取得
   */
  SessionLogRepository.prototype.getCurrent = function() {
    return this.currentSession;
  };

  /**
   * すべてのセッションを取得
   */
  SessionLogRepository.prototype.getAll = function() {
    return this.sessions.slice();
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionLogRepository;
  } else {
    window.SessionLogRepository = SessionLogRepository;
  }
})();

\\\`,
  "src/infra/repositories/ValueRangeRepository.js": \\\`/**
 * ValueRangeRepository - Infra Layer
 * ValueRangeの永続化を管理するRepository
 */
(function() {
  'use strict';

  const ValueRange = window.ValueRange || (typeof module !== 'undefined' && module.exports ? require('../../domain/ValueRange') : null);

  function ValueRangeRepository(defaultMin, defaultMax, defaultUnit) {
    this.valueRange = new ValueRange(defaultMin || 0, defaultMax || 100, defaultUnit || '%');
  }

  /**
   * ValueRangeを取得
   */
  ValueRangeRepository.prototype.get = function() {
    return this.valueRange;
  };

  /**
   * ValueRangeを保存
   */
  ValueRangeRepository.prototype.save = function(valueRange) {
    if (valueRange && valueRange instanceof ValueRange) {
      this.valueRange = valueRange;
    }
  };

  /**
   * ValueRangeを更新
   */
  ValueRangeRepository.prototype.update = function(min, max, unit) {
    this.valueRange = new ValueRange(min, max, unit);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueRangeRepository;
  } else {
    window.ValueRangeRepository = ValueRangeRepository;
  }
})();

\\\`,
  "src/infra/storage/LogFileStorage.js": \\\`/**
 * LogFileStorage - Infra Layer
 * ログファイルの保存・読み込みを管理するストレージ
 */
(function() {
  'use strict';

  function LogFileStorage(serverUrl) {
    this.serverUrl = serverUrl || 'http://127.0.0.1:8123';
  }

  /**
   * ログデータを保存
   */
  LogFileStorage.prototype.save = function(data) {
    return new Promise((resolve, reject) => {
      if (!data || data.length === 0) {
        reject(new Error('記録されたデータがありません'));
        return;
      }

      // Create JSON content
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = \\\\\\\`meter-log-\\\\\\\${timestamp}.json\\\\\\\`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also save to server (backup)
      this._saveToServer(data, filename)
        .then(() => resolve({ filename, data }))
        .catch(err => {
          console.warn('Failed to save to server:', err);
          // Download already succeeded, so resolve anyway
          resolve({ filename, data });
        });
    });
  };

  /**
   * サーバーに保存
   */
  LogFileStorage.prototype._saveToServer = function(data, filename) {
    return fetch(\\\\\\\`\\\\\\\${this.serverUrl}/save-log\\\\\\\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: data, filename: filename }),
      cache: 'no-store'
    }).then(response => {
      if (!response.ok) {
        throw new Error(\\\\\\\`Server returned \\\\\\\${response.status}\\\\\\\`);
      }
    });
  };

  /**
   * ログファイルを読み込む
   */
  LogFileStorage.prototype.load = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogFileStorage;
  } else {
    window.LogFileStorage = LogFileStorage;
  }
})();

\\\`,
  "src/infra/storage/SettingsStorage.js": \\\`/**
 * SettingsStorage - Infra Layer
 * 設定（値の範囲、デバイス設定など）の保存・読み込みを管理するストレージ
 */
(function() {
  'use strict';

  function SettingsStorage() {
    this.storageKey = 'positionVisualizer-settings';
  }

  /**
   * 設定を保存
   */
  SettingsStorage.prototype.save = function(settings) {
    try {
      const data = JSON.stringify(settings);
      localStorage.setItem(this.storageKey, data);
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  };

  /**
   * 設定を読み込む
   */
  SettingsStorage.prototype.load = function() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
      return null;
    }
  };

  /**
   * 設定を削除
   */
  SettingsStorage.prototype.clear = function() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (e) {
      console.error('Failed to clear settings:', e);
      return false;
    }
  };

  /**
   * 値の範囲を保存
   */
  SettingsStorage.prototype.saveValueRange = function(valueRange) {
    const settings = this.load() || {};
    settings.valueRange = {
      min: valueRange.min,
      max: valueRange.max,
      unit: valueRange.unit
    };
    return this.save(settings);
  };

  /**
   * 値の範囲を読み込む
   */
  SettingsStorage.prototype.loadValueRange = function() {
    const settings = this.load();
    if (settings && settings.valueRange) {
      return settings.valueRange;
    }
    return null;
  };

  /**
   * デバイス設定を保存
   */
  SettingsStorage.prototype.saveDeviceConfigs = function(configs) {
    const settings = this.load() || {};
    settings.deviceConfigs = configs.map(config => ({
      id: config.id,
      ip: config.ip,
      iconUrl: config.iconUrl,
      name: config.name
    }));
    return this.save(settings);
  };

  /**
   * デバイス設定を読み込む
   */
  SettingsStorage.prototype.loadDeviceConfigs = function() {
    const settings = this.load();
    if (settings && settings.deviceConfigs) {
      return settings.deviceConfigs;
    }
    return null;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsStorage;
  } else {
    window.SettingsStorage = SettingsStorage;
  }
})();

\\\`,
  "src/infra/sync/OverlayChannel.js": \\\`/**
 * OverlayChannel - Infra Layer
 * BroadcastChannelを使用してオーバーレイウィンドウと同期するチャネル
 */
(function() {
  'use strict';

  function OverlayChannel(channelName) {
    this.channelName = channelName || 'meter-overlay';
    this.bc = null;
    this.subscribers = [];
    
    try {
      this.bc = new BroadcastChannel(this.channelName);
      this.bc.onmessage = (event) => {
        this._notifySubscribers({ type: 'message', data: event.data });
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  /**
   * メッセージを送信
   */
  OverlayChannel.prototype.postMessage = function(data) {
    if (this.bc) {
      try {
        this.bc.postMessage(data);
        return true;
      } catch (e) {
        console.error('Failed to post message:', e);
        return false;
      }
    }
    return false;
  };

  /**
   * イベントを購読
   */
  OverlayChannel.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  OverlayChannel.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  OverlayChannel.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * チャネルを閉じる
   */
  OverlayChannel.prototype.close = function() {
    if (this.bc) {
      try {
        this.bc.close();
      } catch (e) {}
      this.bc = null;
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayChannel;
  } else {
    window.OverlayChannel = OverlayChannel;
  }
})();

\\\`,
  "src/presentation/bindings/MainPageBindings.js": \\\`/**
 * MainPageBindings - Presentation Layer
 * メインページのDOMバインディング
 */
(function () {
  'use strict';

  const MeterRenderer = window.MeterRenderer;
  const IconRenderer = window.IconRenderer;

  function MainPageBindings(viewModel, liveMonitorService, recordingService, replayService, settingsService, iconService, webSocketClient, overlayChannel) {
    this.viewModel = viewModel;
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;
    this.webSocketClient = webSocketClient;
    this.overlayChannel = overlayChannel;

    this.deviceIdMap = new Map();
  }

  /**
   * デバイスIDをインデックスにマッピング
   */
  MainPageBindings.prototype._getDeviceIndex = function (deviceId) {
    if (!deviceId) return -1;

    if (this.deviceIdMap.has(deviceId)) {
      return this.deviceIdMap.get(deviceId);
    }

    const match = deviceId.match(/(\\\\\\\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        const index = num - 1;
        this.deviceIdMap.set(deviceId, index);
        return index;
      }
    }

    // Try to find by IP address or name
    for (let i = 0; i < 6; i++) {
      const ipEl = document.getElementById(\\\\\\\`device\\\\\\\${i + 1}-ip\\\\\\\`);
      const nameEl = document.getElementById(\\\\\\\`device\\\\\\\${i + 1}-name\\\\\\\`);
      const ip = ipEl ? ipEl.value.trim() : '';
      const name = nameEl ? nameEl.value.trim() : '';
      if (name && name.toLowerCase().includes(deviceId.toLowerCase())) {
        this.deviceIdMap.set(deviceId, i);
        return i;
      }
    }

    return -1;
  };

  /**
   * WebSocketメッセージを処理
   */
  MainPageBindings.prototype._handleWebSocketMessage = function (event) {
    if (event.type !== 'message') return;

    const data = event.data;

    // Handle state messages
    if (data.type === 'state' && data.payload) {
      const payload = data.payload;
      if (payload.values && Array.isArray(payload.values)) {
        for (let i = 0; i < 6; i++) {
          const value = payload.values[i];
          const prevValue = this.viewModel.state.values[i];

          if (value !== null && value !== undefined) {
            this.viewModel.setValue(i, value, true, true);

            // Record data if recording is active
            if (this.recordingService && prevValue !== value) {
              const deviceId = \\\\\\\`lever\\\\\\\${i + 1}\\\\\\\`;
              this.recordingService.recordDeviceData(deviceId, value);
            }
          } else {
            this.viewModel.setValue(i, null, false);
          }
        }
      }
      return;
    }

    // Handle device data JSON (legacy format)
    if (data.device_id && data.data) {
      this._processDeviceData(data);
    } else if (data.type === 'device' && data.payload) {
      this._processDeviceData(data.payload);
    } else if (Array.isArray(data)) {
      data.forEach(item => this._processDeviceData(item));
    }
  };

  /**
   * デバイスデータを処理
   */
  MainPageBindings.prototype._processDeviceData = function (jsonData) {
    try {
      if (!jsonData || typeof jsonData !== 'object') return;

      const deviceId = jsonData.device_id;
      if (!deviceId) return;

      const index = this._getDeviceIndex(deviceId);
      if (index < 0 || index > 5) return;

      const data = jsonData.data;
      if (!data) return;

      let value = null;
      if (typeof data.value === 'number') {
        value = data.value;
      } else if (typeof data.smoothed === 'number') {
        value = data.smoothed;
      } else if (typeof data.raw === 'number') {
        value = data.raw;
      }

      if (value !== null && !isNaN(value)) {
        this.viewModel.setValue(index, value);

        // Record data if recording is active
        if (this.recordingService) {
          const normalizedValue = this.viewModel.state.values[index];
          this.recordingService.recordDeviceData(deviceId, normalizedValue);
        }
      }
    } catch (error) {
      console.error('Error processing device data:', error);
    }
  };

  /**
   * 状態をブロードキャスト
   */
  MainPageBindings.prototype.broadcast = function () {
    const state = this.viewModel.toJSON();
    const isPlaying = this.replayService && this.replayService.isPlaying;

    // SVG string - expensive to serialize!
    // Skip serialization during playback to improve performance
    let svgMarkup = '';
    if (!isPlaying) {
      const svgEl = document.querySelector('#meter-container svg[data-meter]');
      svgMarkup = svgEl ? svgEl.outerHTML : '';
    }

    // BroadcastChannel
    if (this.overlayChannel) {
      // During playback, we send only data (no SVG) to keep 60fps
      // Add isReplaying flag so Overlay knows to ignore Live Data
      this.overlayChannel.postMessage({ ...state, svg: svgMarkup, isReplaying: !!isPlaying });
    }

    // localStorage
    // Skip high-frequency writes during playback
    if (!isPlaying) {
      try {
        localStorage.setItem('meter-state', JSON.stringify({ ...state, ts: Date.now(), isReplaying: false }));
        if (svgMarkup) localStorage.setItem('meter-svg', svgMarkup);
      } catch (e) { }
    } else {
      // Optionally update state sparingly or just rely on Channel? 
      // If we don't update localStorage, Overlay won't see it if it only looks there? 
      // Overlay looks at Channel too.
      // But if we want to support "Ghost Replay" prevention, we might want to write isReplaying: true once?
      // Let's safe-guard by writing ONE minimal state if it changed? No, 60fps write is bad.
      // Overlay listens to Channel so it's fine.
    }

    // WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.send({ type: 'state', payload: { ...state, svg: svgMarkup, isReplaying: !!isPlaying } });
    }
  };

  /**
   * バインディングをアタッチ
   */
  MainPageBindings.prototype.attach = function () {
    const vm = this.viewModel;
    const self = this;

    // Initialize meter renderer
    MeterRenderer.initMeter(document.getElementById('meter-container'));

    // Connect WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.subscribe((event) => {
        self._handleWebSocketMessage(event);
      });
      this.webSocketClient.connect();
    }

    // Subscribe to ViewModel changes
    vm.onChange((state) => {
      const connectedDeviceIndices = vm.getConnectedDeviceIndices();
      const actualValues = vm.getActualValues();

      MeterRenderer.updateMeter(state.values, {
        names: state.names,
        icon: state.icon,
        numbersOnly: true,
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: vm.unit,
        minValue: vm.minValue,
        maxValue: vm.maxValue,
        icons: state.icons
      });

      self.broadcast();
    });

    // Initial paint
    const initialConnectedDeviceIndices = vm.getConnectedDeviceIndices();
    const initialActualValues = vm.getActualValues();
    MeterRenderer.updateMeter(vm.state.values, {
      names: vm.state.names,
      icon: vm.state.icon,
      numbersOnly: true,
      textYOffset: 15,
      connectedDeviceIndices: initialConnectedDeviceIndices,
      actualValues: initialActualValues,
      unit: vm.unit,
      minValue: vm.minValue,
      maxValue: vm.maxValue,
      icons: vm.state.icons
    });
    this.broadcast();

    // Bind UI controls
    this._bindUIControls();
  };

  /**
   * UIコントロールをバインディング
   */
  MainPageBindings.prototype._bindUIControls = function () {
    const vm = this.viewModel;
    const self = this;

    // Bind device name inputs
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(\\\\\\\`device\\\\\\\${i}-name\\\\\\\`);
      if (el) {
        const handler = () => vm.setName(i - 1, el.value);
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    }

    // Bind range settings
    const minValueInput = document.getElementById('min-value');
    const maxValueInput = document.getElementById('max-value');
    const unitInput = document.getElementById('value-unit');

    if (minValueInput) {
      minValueInput.addEventListener('change', () => vm.setMinValue(minValueInput.value));
      minValueInput.addEventListener('input', () => vm.setMinValue(minValueInput.value));
    }

    if (maxValueInput) {
      maxValueInput.addEventListener('change', () => vm.setMaxValue(maxValueInput.value));
      maxValueInput.addEventListener('input', () => vm.setMaxValue(maxValueInput.value));
    }

    if (unitInput) {
      unitInput.addEventListener('change', () => vm.setUnit(unitInput.value));
      unitInput.addEventListener('input', () => vm.setUnit(unitInput.value));
    }

    // Bind icon uploads
    for (let i = 1; i <= 6; i++) {
      const input = document.getElementById(\\\\\\\`device\\\\\\\${i}-icon\\\\\\\`);
      if (input) {
        const button = input.closest('.icon-file-button');
        const buttonText = button ? button.querySelector('.icon-button-text') : null;

        const updateIconState = () => {
          const hasIcon = vm.state.icons && vm.state.icons[i - 1];
          if (button) {
            if (hasIcon) {
              button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            } else {
              button.classList.remove('has-icon');
              if (buttonText) buttonText.textContent = '画像を選択';
            }
          }
        };

        updateIconState();

        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) {
            if (button) button.classList.remove('has-icon');
            if (buttonText) buttonText.textContent = '画像を選択';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (dataUrl) {
              vm.setIconAt(i - 1, dataUrl);
              if (button) button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            }
          };
          reader.readAsDataURL(file);
        });

        vm.onChange(() => {
          updateIconState();
        });
      }
    }

    // Bind recording controls
    const startRecordBtn = document.getElementById('start-record');
    const stopRecordBtn = document.getElementById('stop-record');
    const recordStatusEl = document.getElementById('log-record-status');

    const updateRecordStatus = () => {
      if (!recordStatusEl || !this.recordingService) return;
      const status = this.recordingService.getRecordingStatus();
      if (status.isRecording) {
        recordStatusEl.textContent = \\\\\\\`記録中... (\\\\\\\${status.recordCount}件)\\\\\\\`;
        recordStatusEl.style.color = '#d32f2f';
      } else {
        recordStatusEl.textContent = '停止中';
        recordStatusEl.style.color = '#666';
      }
    };

    if (startRecordBtn && this.recordingService) {
      startRecordBtn.addEventListener('click', () => {
        // Pass current values to capture initial state
        this.recordingService.startRecording(this.viewModel.state.values);
        updateRecordStatus();
      });
    }

    if (stopRecordBtn && this.recordingService) {
      stopRecordBtn.addEventListener('click', () => {
        const entries = this.recordingService.stopRecording();
        if (entries && entries.length > 0) {
          try {
            // Use RecordingService to save data (it handles formatting and download)
            this.recordingService.saveRecordedData(entries);
          } catch (e) {
            console.error('Failed to save log:', e);
            alert('ログの保存に失敗しました: ' + e.message);
          }
        }
        updateRecordStatus();
      });
    }

    // Subscribe to recording status changes
    if (this.recordingService) {
      this.recordingService.subscribe(() => {
        updateRecordStatus();
      });
    }

    updateRecordStatus();

    // Bind replay controls
    const logFile = document.getElementById('log-file');
    const playBtn = document.getElementById('play-log');
    const stopBtn = document.getElementById('stop-log');

    if (playBtn && logFile && this.replayService) {
      playBtn.addEventListener('click', () => {
        const f = logFile.files && logFile.files[0];
        if (!f) {
          alert('ログファイル（JSON）を選択してください');
          return;
        }
        this.replayService.loadFile(f).then(() => {
          this.replayService.play();
        }).catch((err) => {
          alert('読み込み失敗: ' + err.message);
        });
      });
    }

    if (stopBtn && this.replayService) {
      stopBtn.addEventListener('click', () => {
        this.replayService.stop();
      });
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainPageBindings;
  } else {
    window.MainPageBindings = MainPageBindings;
  }
})();

\\\`,
  "src/presentation/bindings/OverlayBindings.js": \\\`/**
 * OverlayBindings - Presentation Layer
 * オーバーレイウィンドウのDOMバインディング
 */
(function () {
  'use strict';

  const MeterRenderer = window.MeterRenderer;

  function OverlayBindings(viewModel, webSocketClient, httpPollingClient, overlayChannel) {
    this.viewModel = viewModel;
    this.webSocketClient = webSocketClient;
    this.httpPollingClient = httpPollingClient;
    this.overlayChannel = overlayChannel;
    this.initialized = false;
    this.isMainPageReplaying = false;
  }

  /**
   * SVGを完全にレンダリング
   */
  OverlayBindings.prototype._renderSvgFull = function (svgMarkup) {
    if (!svgMarkup) return;
    const container = document.getElementById('meter-container');
    if (!container) return;

    container.innerHTML = svgMarkup;
    this.initialized = true;

    if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
      setTimeout(() => {
        window.IconRenderer.updateAllIconValues();
      }, 50);
    }
  };

  /**
   * SVGをパッチ（差分更新）
   */
  OverlayBindings.prototype._patchSvg = function (svgMarkup) {
    if (!svgMarkup) return;
    const container = document.getElementById('meter-container');
    if (!container) return;

    const existingSvg = container.querySelector('svg[data-meter]');
    if (!existingSvg) {
      this._renderSvgFull(svgMarkup);
      return;
    }

    const temp = document.createElement('div');
    temp.innerHTML = svgMarkup;
    const nextSvg = temp.querySelector('svg[data-meter]');
    if (!nextSvg) return;

    // Update viewBox if changed
    const nextViewBox = nextSvg.getAttribute('viewBox');
    if (nextViewBox && existingSvg.getAttribute('viewBox') !== nextViewBox) {
      existingSvg.setAttribute('viewBox', nextViewBox);
    }

    // Update perf groups
    const nextGroups = nextSvg.querySelectorAll('g[data-perf]');
    nextGroups.forEach((ng) => {
      const key = ng.getAttribute('data-perf');
      let g = existingSvg.querySelector(\\\\\\\`g[data-perf="\\\\\\\${key}"]\\\\\\\`);
      if (!g) {
        g = ng.cloneNode(true);
        existingSvg.appendChild(g);
        return;
      }

      // Update transform
      const tr = ng.getAttribute('transform');
      if (tr) g.setAttribute('transform', tr);

      // Update data attributes
      const dataPercentage = ng.getAttribute('data-percentage');
      const dataActual = ng.getAttribute('data-actual');
      const dataUnit = ng.getAttribute('data-unit');
      if (dataPercentage !== null) g.setAttribute('data-percentage', dataPercentage);
      if (dataActual !== null) g.setAttribute('data-actual', dataActual);
      if (dataUnit !== null) g.setAttribute('data-unit', dataUnit);

      // Update text
      const nt = ng.querySelector('text');
      const ct = g.querySelector('text');
      if (nt && ct) {
        if (ct.textContent !== nt.textContent) ct.textContent = nt.textContent;
        ct.setAttribute('y', nt.getAttribute('y') || ct.getAttribute('y') || '15');
      }

      // Update icon-value text
      const nIconText = ng.querySelector('text.icon-value');
      const cIconText = g.querySelector('text.icon-value');
      if (nIconText) {
        if (!cIconText) {
          g.appendChild(nIconText.cloneNode(true));
        } else {
          cIconText.textContent = nIconText.textContent;
          cIconText.setAttribute('data-actual', nIconText.getAttribute('data-actual') || '');
          cIconText.setAttribute('data-unit', nIconText.getAttribute('data-unit') || '');
        }
      }

      // Update images
      const nimgs = ng.querySelectorAll('image');
      const cimgs = g.querySelectorAll('image');
      if (nimgs && nimgs.length) {
        for (let i = 0; i < nimgs.length; i++) {
          if (!cimgs[i]) {
            g.insertBefore(nimgs[i].cloneNode(true), ct || null);
          }
        }
        const updatedCImgs = g.querySelectorAll('image');
        for (let i = 0; i < nimgs.length; i++) {
          const nimg = nimgs[i];
          const cimg = updatedCImgs[i];
          if (cimg) {
            const href = nimg.getAttribute('href') || nimg.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (href) {
              cimg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
              cimg.setAttribute('href', href);
            } else {
              cimg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
              cimg.removeAttribute('href');
            }

            // Copy style (display: none, etc)
            const style = nimg.getAttribute('style');
            if (style) {
              cimg.setAttribute('style', style);
            } else {
              cimg.removeAttribute('style');
            }
          }
        }
      }
    });

    if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
      setTimeout(() => {
        window.IconRenderer.updateAllIconValues();
      }, 50);
    }
  };

  /**
   * 状態を処理
   */
  OverlayBindings.prototype._handleState = function (payload) {
    if (payload && payload.isReplaying !== undefined) {
      this.isMainPageReplaying = !!payload.isReplaying;
    }
    if (payload && typeof payload.svg === 'string' && payload.svg) {
      if (!this.initialized) {
        this._renderSvgFull(payload.svg);
      } else {
        this._patchSvg(payload.svg);
      }
      return;
    }

    if (payload && Array.isArray(payload.values)) {
      const values = payload.values;

      // Update icons if present in payload (fixes missing images during replay)
      if (payload.icons && Array.isArray(payload.icons)) {
        this.viewModel.state.icons = payload.icons.slice(0, 6);
      }

      for (let i = 0; i < 6; i++) {
        const value = values[i];
        if (value !== null && value !== undefined) {
          this.viewModel.setValue(i, value, true, true);
        } else {
          this.viewModel.setValue(i, null, false);
        }
      }

      if (payload.icon !== undefined) {
        this.viewModel.setIcon(payload.icon);
      }
      if (payload.unit !== undefined) {
        this.viewModel.setUnit(payload.unit);
      }
      if (payload.minValue !== undefined) {
        this.viewModel.setMinValue(payload.minValue);
      }
      if (payload.maxValue !== undefined) {
        this.viewModel.setMaxValue(payload.maxValue);
      }

      this.initialized = true;
    }
  };

  /**
   * バインディングをアタッチ
   */
  OverlayBindings.prototype.attach = function () {
    const container = document.getElementById('meter-container');
    const self = this;

    // Initialize meter
    try {
      MeterRenderer.initMeter(container);
      MeterRenderer.updateMeter([], { icon: null });
      this.initialized = !!container.querySelector('svg[data-meter]');

      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 100);
      }
    } catch (e) { }

    // BroadcastChannel receiver
    if (this.overlayChannel) {
      this.overlayChannel.subscribe((event) => {
        if (event.type === 'message') {
          const d = event.data || {};
          if (typeof d.svg === 'string' && d.svg) {
            if (!self.initialized) {
              self._renderSvgFull(d.svg);
            } else {
              self._patchSvg(d.svg);
            }
            return;
          }
          if (Array.isArray(d.values)) {
            self._handleState(d);
            try {
              const svg = localStorage.getItem('meter-svg');
              if (svg) {
                if (!self.initialized) {
                  self._renderSvgFull(svg);
                } else {
                  self._patchSvg(svg);
                }
              }
            } catch (e) { }
          }
        }
      });
    }

    // localStorage storage event
    window.addEventListener('storage', (e) => {
      if (e.key === 'meter-svg' && typeof e.newValue === 'string') {
        if (!self.initialized) {
          self._renderSvgFull(e.newValue);
        } else {
          self._patchSvg(e.newValue);
        }
      }
    });

    // Initial load from localStorage
    try {
      const svg = localStorage.getItem('meter-svg');
      if (svg) {
        this._renderSvgFull(svg);
      }
    } catch (e) { }

    // WebSocket receiver
    if (this.webSocketClient) {
      this.webSocketClient.subscribe((event) => {
        if (self.isMainPageReplaying) return; // Ignore live data during replay

        if (event.type === 'message') {
          const msg = event.data || {};
          if (msg && msg.type === 'state' && msg.payload) {
            self._handleState(msg.payload);
          }
        }
      });
      this.webSocketClient.connect();
    }

    // HTTP polling fallback
    if (this.httpPollingClient) {
      this.httpPollingClient.subscribe((event) => {
        if (self.isMainPageReplaying) return; // Ignore live data during replay

        if (event.type === 'data') {
          self._handleState(event.data);
        }
      });
      this.httpPollingClient.start();
    }

    // Subscribe to ViewModel changes
    this.viewModel.onChange((state) => {
      const connectedDeviceIndices = this.viewModel.getConnectedDeviceIndices();
      const actualValues = this.viewModel.getActualValues();

      MeterRenderer.updateMeter(state.values, {
        names: state.names,
        icon: state.icon,
        numbersOnly: true,
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: this.viewModel.unit,
        minValue: this.viewModel.minValue,
        maxValue: this.viewModel.maxValue,
        icons: state.icons
      });

      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 50);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayBindings;
  } else {
    window.OverlayBindings = OverlayBindings;
  }
})();

\\\`,
  "src/presentation/viewmodels/MainPageViewModel.js": \\\`/**
 * MainPageViewModel - Presentation Layer
 * メインページのUI状態とUseCase呼び出しを管理するViewModel
 */
(function () {
  'use strict';

  const Emitter = window.MVVM && window.MVVM.Emitter;
  const MeterState = window.MVVM && window.MVVM.MeterState;

  function MainPageViewModel(initialState, liveMonitorService, recordingService, replayService, settingsService, iconService) {
    this.emitter = new Emitter();
    this.state = initialState instanceof MeterState ? initialState : new MeterState();

    // UseCase services
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;

    // UI state
    this.running = false;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';

    // Interpolation state
    this._interpolationDuration = 200;
    this._interpolations = [];
    this._animationFrameId = null;

    // Subscribe to UseCase events
    this._setupUseCaseSubscriptions();
  }

  /**
   * UseCaseのイベントを購読
   */
  MainPageViewModel.prototype._setupUseCaseSubscriptions = function () {
    const self = this;

    // LiveMonitorServiceの購読
    if (this.liveMonitorService) {
      this.liveMonitorService.subscribe((deviceState) => {
        const index = deviceState.index;
        if (index >= 0 && index < 6) {
          if (deviceState.isConnected()) {
            self.setValue(index, deviceState.normalizedValue, true, true);
          } else {
            self.setValue(index, null, false);
          }
        }
      });
    }

    // RecordingServiceの購読
    if (this.recordingService) {
      this.recordingService.subscribe((event) => {
        self._notify();
      });
    }

    // ReplayServiceの購読
    if (this.replayService) {
      this.replayService.subscribe((event) => {
        if (event.type === 'frameUpdated') {
          // Update state values from replay
          if (event.values) {
            for (let i = 0; i < 6; i++) {
              const value = event.values[i];
              if (value !== null && value !== undefined) {
                self.setValue(i, value, true, true);
              } else {
                self.setValue(i, null, false);
              }
            }
          }
        } else if (event.type === 'valuesReset') {
          for (let i = 0; i < 6; i++) {
            self.setValue(i, null, false);
          }
        }
      });
    }

    // SettingsServiceの購読
    if (this.settingsService) {
      this.settingsService.subscribe((valueRange) => {
        self.minValue = valueRange.min;
        self.maxValue = valueRange.max;
        self.unit = valueRange.unit;
        self._notify();
      });
    }

    // IconServiceの購読
    if (this.iconService) {
      this.iconService.subscribe((index, config) => {
        if (index >= 0 && index < 6) {
          self.state.icons[index] = config.iconUrl;
          self._notify();
        }
      });
    }
  };

  /**
   * 変更イベントを購読
   */
  MainPageViewModel.prototype.onChange = function (fn) {
    return this.emitter.on('change', fn);
  };

  /**
   * 変更を通知
   */
  MainPageViewModel.prototype._notify = function () {
    this.emitter.emit('change', this.state.clone());
  };

  /**
   * 値の範囲を設定
   */
  MainPageViewModel.prototype.setMinValue = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(v, currentRange.max, currentRange.unit);
    } else {
      let min = Number(v);
      if (!isNaN(min)) {
        if (min >= this.maxValue) {
          this.maxValue = min + 1;
        }
        this.minValue = min;
        this._notify();
      }
    }
  };

  MainPageViewModel.prototype.setMaxValue = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(currentRange.min, v, currentRange.unit);
    } else {
      let max = Number(v);
      if (!isNaN(max)) {
        if (max <= this.minValue) {
          this.minValue = max - 1;
        }
        this.maxValue = max;
        this._notify();
      }
    }
  };

  MainPageViewModel.prototype.setUnit = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(currentRange.min, currentRange.max, v);
    } else {
      this.unit = String(v || '%').trim() || '%';
      this._notify();
    }
  };

  /**
   * 値を正規化
   */
  MainPageViewModel.prototype.normalizeValue = function (actualValue) {
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50;
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値を実際の値に変換
   */
  MainPageViewModel.prototype.denormalizeValue = function (percentage) {
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };

  /**
   * デバイス名を設定
   */
  MainPageViewModel.prototype.setName = function (index, name) {
    if (index < 0 || index > 5) return;
    this.state.names[index] = String(name || '').trim() || this.state.names[index];
    this._notify();
  };

  /**
   * 値を設定
   */
  MainPageViewModel.prototype.setValue = function (index, value, smooth, isNormalized) {
    if (index < 0 || index > 5) return;

    if (value === null || value === undefined) {
      this._interpolations = this._interpolations.filter(interp => interp.index !== index);
      this.state.values[index] = null;
      this._notify();
      return;
    }

    let normalized;
    if (isNormalized === true) {
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }

    const useSmooth = smooth !== false;
    const currentNormalized = this.state.values[index];

    if (useSmooth && currentNormalized !== null && currentNormalized !== undefined && !isNaN(currentNormalized)) {
      const targetNormalized = normalized;
      const diff = Math.abs(currentNormalized - targetNormalized);
      if (diff > 0.01) {
        this._interpolations = this._interpolations.filter(interp => interp.index !== index);
        const now = performance.now();
        this._interpolations.push({
          index: index,
          startValue: currentNormalized,
          targetValue: targetNormalized,
          startTime: now,
          endTime: now + this._interpolationDuration
        });
        this._startInterpolation();
        return;
      }
    }

    this.state.values[index] = normalized;
    this._notify();
  };

  /**
   * 補間アニメーションを開始
   */
  MainPageViewModel.prototype._startInterpolation = function () {
    if (this._animationFrameId !== null) return;

    const self = this;
    const animate = function () {
      const now = performance.now();
      let needsUpdate = false;

      self._interpolations.forEach(interp => {
        if (now >= interp.endTime) {
          if (self.state.values[interp.index] !== interp.targetValue) {
            self.state.values[interp.index] = interp.targetValue;
            needsUpdate = true;
          }
        } else {
          const progress = (now - interp.startTime) / (interp.endTime - interp.startTime);
          const clampedProgress = Math.max(0, Math.min(1, progress));
          const currentValue = interp.startValue + (interp.targetValue - interp.startValue) * clampedProgress;
          self.state.values[interp.index] = currentValue;
          needsUpdate = true;
        }
      });

      self._interpolations = self._interpolations.filter(interp => now < interp.endTime);

      if (needsUpdate) {
        self._notify();
      }

      if (self._interpolations.length > 0) {
        self._animationFrameId = requestAnimationFrame(animate);
      } else {
        self._animationFrameId = null;
      }
    };

    this._animationFrameId = requestAnimationFrame(animate);
  };

  /**
   * 実際の値を取得
   */
  MainPageViewModel.prototype.getActualValue = function (index) {
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };

  MainPageViewModel.prototype.getActualValues = function () {
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };

  /**
   * 接続されているデバイスのインデックスを取得
   */
  MainPageViewModel.prototype.getConnectedDeviceIndices = function () {
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };

  /**
   * アイコンを設定
   */
  MainPageViewModel.prototype.setIcon = function (path) {
    if (path) {
      this.state.icon = path;
      this._notify();
    }
  };

  MainPageViewModel.prototype.setIconAt = function (index, path) {
    if (index < 0 || index > 5) return;
    if (this.iconService) {
      this.iconService.setIcon(index, path);
    } else {
      this.state.icons[index] = String(path || '');
      this._notify();
    }
  };

  /**
   * 状態を設定
   */
  MainPageViewModel.prototype.setState = function (next) {
    if (!next) return;
    if (!(next instanceof MeterState)) {
      next = new MeterState(next.values, next.names, next.icon, next.icons);
    }
    this.state = next;
    this._notify();
  };

  /**
   * JSONに変換
   */
  MainPageViewModel.prototype.toJSON = function () {
    return {
      values: this.state.values.slice(0, 6),
      names: this.state.names.slice(0, 6),
      icon: this.state.icon,
      icons: this.state.icons.slice(0, 6)
    };
  };

  /**
   * 監視を開始
   */
  MainPageViewModel.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    if (this.liveMonitorService) {
      this.liveMonitorService.start();
    }
    this._notify();
  };

  /**
   * 監視を停止
   */
  MainPageViewModel.prototype.stop = function () {
    if (!this.running) return;
    this.running = false;
    if (this.liveMonitorService) {
      this.liveMonitorService.stop();
    }
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this._interpolations.forEach(interp => {
      this.state.values[interp.index] = interp.targetValue;
    });
    this._interpolations = [];
    this._notify();
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainPageViewModel;
  } else {
    window.MainPageViewModel = MainPageViewModel;
  }
})();

\\\`,
  "src/presentation/viewmodels/OverlayViewModel.js": \\\`/**
 * OverlayViewModel - Presentation Layer
 * オーバーレイウィンドウのUI状態とUseCase呼び出しを管理するViewModel
 */
(function() {
  'use strict';

  const Emitter = window.MVVM && window.MVVM.Emitter;
  const MeterState = window.MVVM && window.MVVM.MeterState;

  function OverlayViewModel(initialState, replayService, settingsService) {
    this.emitter = new Emitter();
    this.state = initialState instanceof MeterState ? initialState : new MeterState();
    
    // UseCase services
    this.replayService = replayService;
    this.settingsService = settingsService;
    
    // UI state
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Subscribe to UseCase events
    this._setupUseCaseSubscriptions();
  }

  /**
   * UseCaseのイベントを購読
   */
  OverlayViewModel.prototype._setupUseCaseSubscriptions = function() {
    const self = this;
    
    // ReplayServiceの購読
    if (this.replayService) {
      this.replayService.subscribe((event) => {
        if (event.type === 'frameUpdated') {
          // Update state values from replay
          if (event.values) {
            for (let i = 0; i < 6; i++) {
              self.state.values[i] = event.values[i] !== undefined ? event.values[i] : null;
            }
            self._notify();
          }
        } else if (event.type === 'valuesReset') {
          for (let i = 0; i < 6; i++) {
            self.state.values[i] = null;
          }
          self._notify();
        }
      });
    }
    
    // SettingsServiceの購読
    if (this.settingsService) {
      this.settingsService.subscribe((valueRange) => {
        self.minValue = valueRange.min;
        self.maxValue = valueRange.max;
        self.unit = valueRange.unit;
        self._notify();
      });
    }
  };

  /**
   * 変更イベントを購読
   */
  OverlayViewModel.prototype.onChange = function(fn) {
    return this.emitter.on('change', fn);
  };

  /**
   * 変更を通知
   */
  OverlayViewModel.prototype._notify = function() {
    this.emitter.emit('change', this.state.clone());
  };

  /**
   * 値を正規化
   */
  OverlayViewModel.prototype.normalizeValue = function(actualValue) {
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50;
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値を実際の値に変換
   */
  OverlayViewModel.prototype.denormalizeValue = function(percentage) {
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };

  /**
   * 値を設定
   */
  OverlayViewModel.prototype.setValue = function(index, value, smooth, isNormalized) {
    if (index < 0 || index > 5) return;
    
    if (value === null || value === undefined) {
      this.state.values[index] = null;
      this._notify();
      return;
    }
    
    let normalized;
    if (isNormalized === true) {
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }
    
    this.state.values[index] = normalized;
    this._notify();
  };

  /**
   * 実際の値を取得
   */
  OverlayViewModel.prototype.getActualValue = function(index) {
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };

  OverlayViewModel.prototype.getActualValues = function() {
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };

  /**
   * 接続されているデバイスのインデックスを取得
   */
  OverlayViewModel.prototype.getConnectedDeviceIndices = function() {
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };

  /**
   * アイコンを設定
   */
  OverlayViewModel.prototype.setIcon = function(path) {
    if (path) {
      this.state.icon = path;
      this._notify();
    }
  };

  /**
   * 単位を設定
   */
  OverlayViewModel.prototype.setUnit = function(v) {
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };

  /**
   * 最小値を設定
   */
  OverlayViewModel.prototype.setMinValue = function(v) {
    let min = Number(v);
    if (!isNaN(min)) {
      if (min >= this.maxValue) {
        this.maxValue = min + 1;
      }
      this.minValue = min;
      this._notify();
    }
  };

  /**
   * 最大値を設定
   */
  OverlayViewModel.prototype.setMaxValue = function(v) {
    let max = Number(v);
    if (!isNaN(max)) {
      if (max <= this.minValue) {
        this.minValue = max - 1;
      }
      this.maxValue = max;
      this._notify();
    }
  };

  /**
   * 状態を設定
   */
  OverlayViewModel.prototype.setState = function(next) {
    if (!next) return;
    if (!(next instanceof MeterState)) {
      next = new MeterState(next.values, next.names, next.icon, next.icons);
    }
    this.state = next;
    this._notify();
  };

  /**
   * JSONに変換
   */
  OverlayViewModel.prototype.toJSON = function() {
    return {
      values: this.state.values.slice(0, 6),
      names: this.state.names.slice(0, 6),
      icon: this.state.icon,
      icons: this.state.icons.slice(0, 6)
    };
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayViewModel;
  } else {
    window.OverlayViewModel = OverlayViewModel;
  }
})();

\\\`,
  "src/usecases/IconService.js": \\\`/**
 * IconService - UseCase Layer
 * アイコン設定を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function IconService(deviceConfigRepository) {
    this.deviceConfigRepository = deviceConfigRepository;
    this.subscribers = [];
  }

  /**
   * デバイスのアイコンを設定
   */
  IconService.prototype.setIcon = function(deviceIndex, iconUrl) {
    const deviceConfig = this.deviceConfigRepository.getByIndex(deviceIndex);
    if (deviceConfig) {
      const oldConfig = deviceConfig.clone();
      deviceConfig.iconUrl = String(iconUrl || '').trim();
      
      // 変更があった場合のみ通知
      if (deviceConfig.iconUrl !== oldConfig.iconUrl) {
        this._notifySubscribers(deviceIndex, deviceConfig);
      }
    }
  };

  /**
   * デバイスのアイコンを取得
   */
  IconService.prototype.getIcon = function(deviceIndex) {
    const deviceConfig = this.deviceConfigRepository.getByIndex(deviceIndex);
    return deviceConfig ? deviceConfig.iconUrl : '';
  };

  /**
   * 変更を購読
   */
  IconService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  IconService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  IconService.prototype._notifySubscribers = function(deviceIndex, deviceConfig) {
    this.subscribers.forEach(callback => {
      try {
        callback(deviceIndex, deviceConfig);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IconService;
  } else {
    window.IconService = IconService;
  }
})();

\\\`,
  "src/usecases/LiveMonitorService.js": \\\`/**
 * LiveMonitorService - UseCase Layer
 * 値の購読を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function LiveMonitorService(deviceStateRepository, valueRangeRepository) {
    this.deviceStateRepository = deviceStateRepository;
    this.valueRangeRepository = valueRangeRepository;
    this.subscribers = [];
    this.isMonitoring = false;
  }

  /**
   * 値の変更を購読
   */
  LiveMonitorService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  LiveMonitorService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * デバイス値の更新を処理
   */
  LiveMonitorService.prototype.updateDeviceValue = function(deviceId, actualValue) {
    // Domain LayerのValueRangeを使用して正規化
    const valueRange = this.valueRangeRepository.get();
    const normalizedValue = valueRange.normalize(actualValue);
    
    // Domain LayerのDeviceStateを更新
    const deviceState = this.deviceStateRepository.getByDeviceId(deviceId);
    if (deviceState) {
      const oldState = deviceState.clone();
      deviceState.normalizedValue = normalizedValue;
      deviceState.actualValue = actualValue;
      deviceState.connected = true;
      
      // 変更があった場合のみ通知
      if (deviceState.hasChanged(oldState)) {
        this._notifySubscribers(deviceState);
      }
    }
  };

  /**
   * デバイスの接続状態を更新
   */
  LiveMonitorService.prototype.updateConnectionState = function(deviceId, connected) {
    const deviceState = this.deviceStateRepository.getByDeviceId(deviceId);
    if (deviceState) {
      deviceState.connected = connected;
      if (!connected) {
        deviceState.normalizedValue = null;
        deviceState.actualValue = null;
      }
      this._notifySubscribers(deviceState);
    }
  };

  /**
   * 購読者に通知
   */
  LiveMonitorService.prototype._notifySubscribers = function(deviceState) {
    this.subscribers.forEach(callback => {
      try {
        callback(deviceState);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * 監視を開始
   */
  LiveMonitorService.prototype.start = function() {
    this.isMonitoring = true;
  };

  /**
   * 監視を停止
   */
  LiveMonitorService.prototype.stop = function() {
    this.isMonitoring = false;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveMonitorService;
  } else {
    window.LiveMonitorService = LiveMonitorService;
  }
})();

\\\`,
  "src/usecases/RecordingService.js": \\\`/**
 * RecordingService - UseCase Layer
 * ログ生成を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function () {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../domain/SessionLog') : null);
  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function RecordingService(sessionLogRepository, logFileStorage) {
    this.sessionLogRepository = sessionLogRepository;
    this.logFileStorage = logFileStorage;
    this.currentSession = null;
    this.subscribers = [];
    this.recordingStartTimeMs = null; // Track session start for relative timestamps
  }

  /**
   * 記録を開始
   */
  RecordingService.prototype.startRecording = function (initialValues) {
    if (this.currentSession && !this.currentSession.isEnded()) {
      return; // Already recording
    }

    const sessionLog = new SessionLog();
    this.currentSession = sessionLog;
    this.sessionLogRepository.save(sessionLog);
    this.recordingStartTimeMs = sessionLog.startedAt instanceof Date ? sessionLog.startedAt.getTime() : Date.now();

    this._notifySubscribers({ type: 'started', session: sessionLog });

    // Record initial values if provided
    if (Array.isArray(initialValues)) {
      initialValues.forEach((val, index) => {
        if (val !== null && val !== undefined) {
          // Device IDs are 1-based usually, or index based? 
          // LogEntry uses numeric ID. Main use \\\\\\\`i+1\\\\\\\`?
          // In recordDeviceData: \\\\\\\`const match = deviceId.match(/(\\\\\\\\d+)$/);\\\\\\\`
          // Let's assume ID is index+1.
          this.recordDeviceData(\\\\\\\`lever\\\\\\\${index + 1}\\\\\\\`, val);
        }
      });
    }
  };

  /**
   * 記録を停止
   */
  RecordingService.prototype.stopRecording = function () {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return null;
    }

    this.currentSession.end();
    const entries = this.currentSession.entries.slice();

    this._notifySubscribers({ type: 'stopped', session: this.currentSession });

    const session = this.currentSession;
    this.currentSession = null;

    return entries;
  };

  /**
   * デバイスデータを記録
   */
  RecordingService.prototype.recordDeviceData = function (deviceId, normalizedValue) {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return;
    }

    if (!deviceId || normalizedValue === null || normalizedValue === undefined) {
      return;
    }

    // Convert deviceId to numeric id if possible
    let id = deviceId;
    if (typeof deviceId === 'string') {
      const match = deviceId.match(/(\\\\\\\\d+)$/);
      if (match) {
        id = parseInt(match[1], 10);
      } else {
        // Use hash of string as id
        let hash = 0;
        for (let i = 0; i < deviceId.length; i++) {
          hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
          hash = hash & hash;
        }
        id = Math.abs(hash);
      }
    }

    const numValue = Number(normalizedValue);
    if (!Number.isFinite(numValue)) {
      return;
    }

    // Unpack array if necessary (though it should be a single value now)
    const finalValue = Array.isArray(numValue) ? numValue[0] : numValue;

    const logEntry = new LogEntry(Date.now(), id, finalValue);

    this.currentSession.addEntry(logEntry);
    this._notifySubscribers({ type: 'recorded', entry: logEntry });
  };

  /**
   * 記録されたデータを保存
   */
  RecordingService.prototype.saveRecordedData = function (entries) {
    if (!entries || entries.length === 0) {
      throw new Error('記録されたデータがありません');
    }

    // Determine base timestamp (relative start). Prefer recorded start time; fallback to first entry timestamp.
    let baseTs = Number.isFinite(this.recordingStartTimeMs) ? this.recordingStartTimeMs : null;
    if (!Number.isFinite(baseTs)) {
      const firstEntryTs = entries[0] && entries[0].timestamp instanceof Date
        ? entries[0].timestamp.getTime()
        : Number(entries[0] && entries[0].timestamp);
      baseTs = Number.isFinite(firstEntryTs) ? firstEntryTs : Date.now();
    }

    // Convert LogEntry objects to serializable format { id, value, ts }
    const serializableData = entries.map(entry => {
      const entryTs = entry.timestamp instanceof Date ? entry.timestamp.getTime() : Number(entry.timestamp);
      const ts = Number.isFinite(entryTs) ? Math.max(0, Math.round(entryTs - baseTs)) : 0;

      return {
        id: entry.id,
        value: entry.value,
        ts: ts
      };
    }).filter(item => item !== null);

    // Clear stored start time after exporting to avoid reuse across sessions
    this.recordingStartTimeMs = null;

    // Save via storage
    return this.logFileStorage.save(serializableData);
  };

  /**
   * 記録ステータスを取得
   */
  RecordingService.prototype.getRecordingStatus = function () {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return {
        isRecording: false,
        recordCount: 0,
        startTime: null
      };
    }

    return {
      isRecording: true,
      recordCount: this.currentSession.getEntryCount(),
      startTime: this.currentSession.startedAt
    };
  };

  /**
   * 変更を購読
   */
  RecordingService.prototype.subscribe = function (callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  RecordingService.prototype.unsubscribe = function (callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  RecordingService.prototype._notifySubscribers = function (event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordingService;
  } else {
    window.RecordingService = RecordingService;
  }
})();

\\\`,
  "src/usecases/ReplayService.js": \\\`/**
 * ReplayService - UseCase Layer
 * ログ再生を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function ReplayService(logFileStorage, deviceStateRepository) {
    this.logFileStorage = logFileStorage;
    this.deviceStateRepository = deviceStateRepository;
    this.frames = [];
    this.isPlaying = false;
    this.playbackStartTime = null;
    this.animationFrameId = null;
    this.subscribers = [];
    this.intervalMs = 200;
  }

  /**
   * ログデータを読み込む（JSONオブジェクトから）
   */
  ReplayService.prototype.loadLog = function(data) {
    try {
      const logArray = Array.isArray(data) ? data : (Array.isArray(data.records) ? data.records : null);
      
      if (!logArray) {
        throw new Error('Invalid log format');
      }

      this._parseLogArray(logArray);
      this._notifySubscribers({ type: 'logLoaded', framesCount: this.frames.length, intervalMs: this.intervalMs });
    } catch (e) {
      throw e;
    }
  };

  /**
   * ログファイルを読み込む
   */
  ReplayService.prototype.loadFile = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const logArray = Array.isArray(data) ? data : (Array.isArray(data.records) ? data.records : null);
          
          if (!logArray) {
            reject(new Error('Invalid log format'));
            return;
          }

          this._parseLogArray(logArray);
          resolve({ framesCount: this.frames.length, intervalMs: this.intervalMs });
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  /**
   * ログ配列をパースしてフレームに変換
   */
  ReplayService.prototype._parseLogArray = function(arr) {
    const byTs = new Map(); // Map<timestamp, Map<deviceId, value>>
    const ids = new Set();

    // First pass: collect all device IDs and group by timestamp
    arr.forEach(r => {
      if (!r) return;
      const id = Number(r.id);
      const v = Number(r.value);
      const ts = Number(r.ts);
      if (!Number.isFinite(id) || !Number.isFinite(v) || !Number.isFinite(ts)) return;
      ids.add(id);
      if (!byTs.has(ts)) byTs.set(ts, new Map());
      byTs.get(ts).set(id, Math.max(0, Math.min(100, v)));
    });

    const sortedTs = Array.from(byTs.keys()).sort((a, b) => a - b);
    this.intervalMs = 200; // Fixed interval

    // Create sorted list of device IDs (up to 6 devices)
    const idList = Array.from(ids).sort((a, b) => a - b).slice(0, 6);

    // Normalize timestamps to start from 0 (relative time)
    const firstTs = sortedTs.length > 0 ? sortedTs[0] : 0;

    // Build frames with carry-forward values
    const lastVals = new Map();
    this.frames = sortedTs.map(ts => {
      const m = byTs.get(ts);
      idList.forEach(id => {
        if (m.has(id)) lastVals.set(id, m.get(id));
      });

      const values = [null, null, null, null, null, null];
      for (let i = 0; i < idList.length; i++) {
        const deviceId = idList[i];
        if (lastVals.has(deviceId)) {
          values[i] = lastVals.get(deviceId);
        }
      }

      return { ts: ts - firstTs, values, idList };
    });
  };

  /**
   * 再生を開始
   */
  ReplayService.prototype.play = function() {
    if (!this.frames.length) return;
    if (this.isPlaying) return;

    this.stop(); // Clear any existing playback
    this.isPlaying = true;
    this.playbackStartTime = Date.now();

    this._notifySubscribers({ type: 'playbackStarted' });

    // Use requestAnimationFrame for smooth playback
    const updateFrame = () => {
      if (!this.isPlaying || this.frames.length === 0) {
        this.animationFrameId = null;
        return;
      }

      const currentTime = Date.now() - this.playbackStartTime;

      // Find the frame that should be playing now
      let prevFrameIndex = -1;
      let nextFrameIndex = -1;

      for (let i = 0; i < this.frames.length; i++) {
        if (this.frames[i].ts <= currentTime) {
          prevFrameIndex = i;
        } else {
          nextFrameIndex = i;
          break;
        }
      }

      // Before first frame
      if (prevFrameIndex < 0) {
        if (this.frames.length > 0) {
          this._applyFrameValues(this.frames[0].values);
        }
        this.animationFrameId = requestAnimationFrame(updateFrame);
        return;
      }

      // Past last frame
      if (currentTime >= this.frames[this.frames.length - 1].ts) {
        this._resetAllValues();
        this.stop();
        return;
      }

      // Interpolate between frames
      const prevFrame = this.frames[prevFrameIndex];
      let interpolatedValues = prevFrame.values.slice();

      if (nextFrameIndex >= 0 && nextFrameIndex < this.frames.length) {
        const nextFrame = this.frames[nextFrameIndex];
        const prevTime = prevFrame.ts;
        const nextTime = nextFrame.ts;

        const t = nextTime > prevTime ? (currentTime - prevTime) / (nextTime - prevTime) : 0;
        const clampedT = Math.max(0, Math.min(1, t));

        for (let i = 0; i < 6; i++) {
          const prevVal = prevFrame.values[i];
          const nextVal = nextFrame.values[i];

          if (prevVal !== null && prevVal !== undefined && nextVal !== null && nextVal !== undefined) {
            interpolatedValues[i] = prevVal + (nextVal - prevVal) * clampedT;
          } else if (prevVal !== null && prevVal !== undefined) {
            interpolatedValues[i] = prevVal;
          } else if (nextVal !== null && nextVal !== undefined) {
            interpolatedValues[i] = nextVal;
          } else {
            interpolatedValues[i] = null;
          }
        }
      }

      this._applyFrameValues(interpolatedValues);
      this.animationFrameId = requestAnimationFrame(updateFrame);
    };

    this.animationFrameId = requestAnimationFrame(updateFrame);
  };

  /**
   * 再生を停止
   */
  ReplayService.prototype.stop = function() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isPlaying = false;
    this.playbackStartTime = null;
    this._resetAllValues();
    this._notifySubscribers({ type: 'playbackStopped' });
  };

  /**
   * フレームの値を適用
   */
  ReplayService.prototype._applyFrameValues = function(values) {
    for (let i = 0; i < 6; i++) {
      const deviceState = this.deviceStateRepository.getByIndex(i);
      if (deviceState) {
        const value = values[i];
        if (value !== null && value !== undefined) {
          deviceState.normalizedValue = value;
          deviceState.connected = true;
        } else {
          deviceState.normalizedValue = null;
          deviceState.connected = false;
        }
      }
    }
    this._notifySubscribers({ type: 'frameUpdated', values });
  };

  /**
   * すべての値をリセット
   */
  ReplayService.prototype._resetAllValues = function() {
    for (let i = 0; i < 6; i++) {
      const deviceState = this.deviceStateRepository.getByIndex(i);
      if (deviceState) {
        deviceState.normalizedValue = null;
        deviceState.actualValue = null;
        deviceState.connected = false;
      }
    }
    this._notifySubscribers({ type: 'valuesReset' });
  };

  /**
   * 変更を購読
   */
  ReplayService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  ReplayService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  ReplayService.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReplayService;
  } else {
    window.ReplayService = ReplayService;
  }
})();

\\\`,
  "src/usecases/SettingsService.js": \\\`/**
 * SettingsService - UseCase Layer
 * 範囲・単位更新を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function SettingsService(valueRangeRepository) {
    this.valueRangeRepository = valueRangeRepository;
    this.subscribers = [];
  }

  /**
   * 値の範囲を更新
   */
  SettingsService.prototype.updateRange = function(min, max, unit) {
    const valueRange = this.valueRangeRepository.get();
    const oldRange = valueRange.clone();
    
    valueRange.min = Number(min) || 0;
    valueRange.max = Number(max) || 100;
    valueRange.unit = String(unit || '%').trim() || '%';
    
    // Validation: ensure min < max
    if (valueRange.min >= valueRange.max) {
      valueRange.max = valueRange.min + 1;
    }
    
    // 変更があった場合のみ通知
    if (valueRange.min !== oldRange.min || 
        valueRange.max !== oldRange.max || 
        valueRange.unit !== oldRange.unit) {
      this._notifySubscribers(valueRange);
    }
  };

  /**
   * 値の範囲を取得
   */
  SettingsService.prototype.getRange = function() {
    return this.valueRangeRepository.get().clone();
  };

  /**
   * 変更を購読
   */
  SettingsService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  SettingsService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  SettingsService.prototype._notifySubscribers = function(valueRange) {
    this.subscribers.forEach(callback => {
      try {
        callback(valueRange);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsService;
  } else {
    window.SettingsService = SettingsService;
  }
})();

\\\`,
  "sw.js": \\\`// Empty service worker to prevent 404 errors
// This file exists only to satisfy browser requests for service worker registration
// No actual service worker functionality is implemented

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// No fetch handler - all requests pass through normally

\\\`,
  "testApp/test-bun-detection.js": \\\`#!/usr/bin/env node
// コンパイル時の検出方法をテスト

console.log('=== Compilation Detection Tests ===');

// 通常のNode.js検出
console.log('1. require.main === module:', require.main === module);

// Bunの検出
console.log('2. typeof Bun !== "undefined":', typeof Bun !== 'undefined');

// process.pkgの検出（PKGによるコンパイル）
console.log('3. process.pkg:', process.pkg);

// import.meta.mainを使った検出（Bunのみ）
if (typeof import.meta !== 'undefined') {
  console.log('4. Bun.main:', Bun.main);
  console.log('5. import.meta.path:', import.meta.path);
}

// __filenameとBun.mainの比較
if (typeof Bun !== 'undefined' && Bun.main) {
  console.log('6. Bun.main === import.meta.path:', Bun.main === import.meta.path);
  console.log('7. Bun.main === __filename:', Bun.main === __filename);
}

// process.execPathがバイナリを指しているか
console.log('8. process.execPath:', process.execPath);
console.log('9. process.execPath includes ".exe" or compiled binary:',
  process.execPath.includes('.exe') ||
  process.execPath.includes('compiled') ||
  !process.execPath.includes('bun')
);

// 実行ファイルかどうかの判定
const isCompiledBinary = (
  typeof Bun !== 'undefined' &&
  Bun.main &&
  Bun.main.startsWith('/$bunfs/')
);

console.log('\\\\\\\\n=== Result ===');
console.log('Is Compiled Binary:', isCompiledBinary);
\\\`,
  "testApp/test-bun-serve.js": \\\`#!/usr/bin/env node
// Bun.serveを使ったシンプルなサーバーテスト

console.log('=== Bun.serve Test ===');
console.log('process.execPath:', process.execPath);
console.log('__dirname:', __dirname);
console.log('Bun.main:', typeof Bun !== 'undefined' ? Bun.main : 'N/A');

if (typeof Bun !== 'undefined' && Bun.serve) {
  console.log('\\\\\\\\nStarting Bun.serve...');

  const server = Bun.serve({
    port: 3000,
    hostname: '127.0.0.1',
    fetch(req) {
      return new Response('Hello from Bun.serve!\\\\\\\\n', {
        headers: { 'Content-Type': 'text/plain' }
      });
    },
  });

  console.log(\\\\\\\`Server running at http://\\\\\\\${server.hostname}:\\\\\\\${server.port}\\\\\\\`);
  console.log('Press Ctrl+C to stop');
} else {
  console.log('\\\\\\\\nBun.serve is not available. This must be run with Bun.');
}
\\\`,
  "testApp/test-bunfs.js": \\\`#!/usr/bin/env node
// $bunfsファイルシステムのテスト

const fs = require('fs');
const path = require('path');

console.log('=== Bun FileSystem Test ===\\\\\\\\n');

// 基本情報
console.log('1. Basic Information:');
console.log('   process.execPath:', process.execPath);
console.log('   __dirname:', __dirname);
console.log('   __filename:', __filename);

if (typeof Bun !== 'undefined') {
  console.log('   Bun.main:', Bun.main);
  console.log('   import.meta.path:', import.meta.path);
  console.log('   import.meta.dir:', import.meta.dir);
}

// コンパイル検出
const isCompiled = typeof Bun !== 'undefined' && Bun.main && Bun.main.startsWith('/$bunfs/');
console.log('\\\\\\\\n2. Compilation Detection:');
console.log('   Is Compiled:', isCompiled);

// 埋め込みファイルのリスト（Bun 1.x以降）
if (typeof Bun !== 'undefined' && Bun.embeddedFiles) {
  console.log('\\\\\\\\n3. Embedded Files:');
  console.log('   Bun.embeddedFiles:', Bun.embeddedFiles);
} else {
  console.log('\\\\\\\\n3. Embedded Files:');
  console.log('   Bun.embeddedFiles: Not available');
}

// ファイルの存在チェック
console.log('\\\\\\\\n4. File Existence Checks:');
console.log('   Current directory files:');
try {
  const files = fs.readdirSync(__dirname);
  files.forEach(file => {
    console.log('   -', file);
  });
} catch (error) {
  console.log('   Error reading directory:', error.message);
}

// process.cwdとの比較
console.log('\\\\\\\\n5. Working Directory:');
console.log('   process.cwd():', process.cwd());
console.log('   __dirname === process.cwd():', __dirname === process.cwd());

// パス解決のテスト
console.log('\\\\\\\\n6. Path Resolution:');
const testPath = path.join(__dirname, 'test.txt');
console.log('   path.join(__dirname, "test.txt"):', testPath);
console.log('   path.resolve("test.txt"):', path.resolve('test.txt'));

// 実行ファイルのディレクトリ
if (isCompiled) {
  const execDir = path.dirname(process.execPath);
  console.log('\\\\\\\\n7. Executable Directory (Compiled):');
  console.log('   path.dirname(process.execPath):', execDir);

  try {
    const files = fs.readdirSync(execDir);
    console.log('   Files in executable directory:');
    files.slice(0, 10).forEach(file => {
      console.log('   -', file);
    });
  } catch (error) {
    console.log('   Error:', error.message);
  }
}
\\\`,
  "testApp/test-child-process.js": \\\`#!/usr/bin/env node
// 子プロセスからの起動をテスト

const child_process = require('child_process');
const path = require('path');

console.log('=== Parent Process Information ===');
console.log('process.execPath:', process.execPath);
console.log('__dirname:', __dirname);

console.log('\\\\\\\\n=== Spawning Child Process ===');

// 子プロセスを起動
const childScript = path.join(__dirname, 'test-execpath.js');
console.log('Spawning:', childScript);

const child = child_process.spawn(
  process.execPath,
  [childScript],
  {
    stdio: 'inherit'
  }
);

child.on('exit', (code) => {
  console.log('\\\\\\\\nChild process exited with code:', code);
});

child.on('error', (error) => {
  console.error('Error spawning child:', error);
});
\\\`,
  "testApp/test-execpath.js": \\\`#!/usr/bin/env node
// process.execPath の挙動をテスト

console.log('=== Process Information ===');
console.log('process.execPath:', process.execPath);
console.log('process.argv[0]:', process.argv[0]);
console.log('process.argv[1]:', process.argv[1]);
console.log('__filename:', __filename);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('process.platform:', process.platform);

// Bunの特有のプロパティをチェック
if (typeof Bun !== 'undefined') {
  console.log('\\\\\\\\n=== Bun Specific ===');
  console.log('Bun.main:', Bun.main);
  console.log('Bun.argv:', Bun.argv);

  if (typeof import.meta !== 'undefined') {
    console.log('import.meta.path:', import.meta.path);
    console.log('import.meta.dir:', import.meta.dir);
    console.log('import.meta.file:', import.meta.file);
  }
}

// pkgによるコンパイル時のプロパティ
if (process.pkg) {
  console.log('\\\\\\\\n=== PKG Specific ===');
  console.log('process.pkg:', process.pkg);
}
\\\`,
};

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

module.exports = {
  resources,
  getResource,
  getMimeType,
  listResources
};
\`,
  "css/style.css": \`* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: fot-udkakugoc80-pro, sans-serif;
  background: linear-gradient(135deg, #0b0d12 0%, #1a1d29 100%);
  color: #e5e7eb;
  font-weight: 400;
  font-style: normal;
  min-height: 100vh;
  padding: 20px;
}

.container {
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  min-height: calc(100vh - 40px);
  align-items: flex-start;
  align-content: flex-start;
}

/* 上段左: デバイス設定 */
.controls {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
  max-width: 500px;
}

/* 上段右: プレビュー */
.visualizer {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
}

.range-settings-section {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
  max-width: 500px;
}

.log-sections {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
}

/* コントロールパネルと履歴パネル */
.controls,
.history-panel {
  width: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.controls:hover,
.history-panel:hover {
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.controls h2,
.history-panel h3,
.visualizer-title {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #f1f5f9;
  font-weight: 700;
  border-bottom: 2px solid #334155;
  padding-bottom: 12px;
}

.controls h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #cbd5e1;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

/* ビジュアライザー */
.visualizer {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 400px;
}

.meter-container {
  position: relative;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  background: #00ff00; /* Green for chroma key */
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #1e293b;
}

#icons-container {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* モードセレクター */
.mode-selector {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
  border: 1px solid #334155;
}

.mode-selector label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 400;
  transition: color 0.2s ease;
}

.mode-selector label:hover {
  color: #f1f5f9;
}

/* カスタムチェックボックス */
.mode-selector input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #475569;
  border-radius: 6px;
  background: #0b1220;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mode-selector input[type="checkbox"]:hover {
  border-color: #64748b;
  background: #1e293b;
}

.mode-selector input[type="checkbox"]:checked {
  background: #5FADCF;
  border-color: #7F57B8;
}

.mode-selector input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 14px;
  font-weight: bold;
}

/* デバイス入力 */
.device-inputs {
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.device-group label {
  font-size: 13px;
  margin-bottom: 4px;
}

.device-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  gap: 8px;
}

.device-group label {
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ip-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}


/* 手動操作セクション */
#manual-controls {
  flex: 1 1 100%;
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  margin-top: 0;
}

.manual-controls-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 12px;
}

/* 値の範囲設定セクション */
.range-settings-section {
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.range-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.range-settings-section h3 {
  grid-column: 1 / -1;
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #cbd5e1;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

/* 値の範囲設定セクションの入力欄 */
.range-settings-section .device-group input[type="number"],
.range-settings-section .device-group input[type="text"] {
  margin-top: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 14px;
  font-weight: 400;
  transition: all 0.2s ease;
  font-family: inherit;
  width: 100%;
}

.range-settings-section .device-group input[type="number"]:focus,
.range-settings-section .device-group input[type="text"]:focus {
  outline: none;
  border-color: #5FADCF;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

.range-settings-section .device-group input[type="number"]:hover,
.range-settings-section .device-group input[type="text"]:hover {
  border-color: #475569;
}

.range-settings-section .device-group input[type="text"]::placeholder {
  color: #64748b;
}

/* 数値入力のスピナーボタンのスタイル */
.range-settings-section .device-group input[type="number"]::-webkit-inner-spin-button,
.range-settings-section .device-group input[type="number"]::-webkit-outer-spin-button {
  opacity: 1;
  cursor: pointer;
  height: 20px;
}

.range-settings-section .device-group input[type="number"]::-webkit-inner-spin-button:hover,
.range-settings-section .device-group input[type="number"]::-webkit-outer-spin-button:hover {
  opacity: 0.8;
}

/* ログ再生セクション */
.log-replay-section {
  padding: 0;
  background: transparent;
  border: none;
}

.log-sections {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.log-replay-section label,
.log-record-section label {
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.log-replay-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.log-replay-buttons button {
  flex: 1;
}

/* ログ記録セクション */
.log-record-section {
  padding: 0;
  background: transparent;
  border: none;
}

.log-record-status {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.log-record-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.log-record-buttons button {
  flex: 1;
}

#manual-controls .device-group {
  margin-bottom: 0;
}

#manual-controls label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #cbd5e1;
  margin-bottom: 8px;
}

#manual-controls label span {
  color: #5FADCF;
  font-weight: 700;
  font-size: 16px;
}

/* カスタムスライダー */
input[type="range"] {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #1e293b;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5FADCF;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: #7F57B8;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5FADCF;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

input[type="range"]::-moz-range-thumb:hover {
  background: #7F57B8;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

input[type="range"]::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: #1e293b;
}

/* ボタン */
.control-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

button {
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  border: none;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  box-shadow: 0 2px 4px rgba(95, 173, 207, 0.3);
  flex: 1;
  min-width: 80px;
}

button:hover {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(95, 173, 207, 0.3);
}

button:disabled {
  background: #334155;
  color: #64748b;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

button:disabled:hover {
  background: #334155;
  transform: none;
}

/* ステータス */
.status {
  margin-top: 16px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status input[type="number"] {
  width: 80px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  transition: all 0.2s ease;
}

.status input[type="number"]:focus {
  outline: none;
  border-color: #5FADCF;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

/* アイコンファイル入力（ボタンのみ） */
.icon-file-button {
  position: relative;
  display: block;
  width: 100%;
  height: 36px;
  cursor: pointer;
}

.icon-file-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.icon-button-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid #334155;
  background: linear-gradient(135deg, #334155 0%, #475569 100%);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
  font-family: inherit;
  box-sizing: border-box;
}

.icon-file-button:hover .icon-button-text {
  background: linear-gradient(135deg, #475569 0%, #64748b 100%);
  color: #f1f5f9;
  border-color: #475569;
}

.icon-file-input:focus + .icon-button-text {
  outline: none;
  border-color: #5FADCF;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

/* 登録済み状態（アイコンが設定されている場合） */
.icon-file-button.has-icon .icon-button-text {
  border-color: #5FADCF;
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  color: #fff;
}

.icon-file-button.has-icon:hover .icon-button-text {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  border-color: #7F57B8;
}

/* ログ再生のファイル入力 */
.log-replay-section input[type="file"] {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.log-replay-section input[type="file"]:hover {
  border-color: #475569;
  background: #0f172a;
}

.log-replay-section input[type="file"]:focus {
  outline: none;
  border-color: #5FADCF;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

.log-replay-section input[type="file"]::file-selector-button {
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 12px;
  font-family: inherit;
}

.log-replay-section input[type="file"]::file-selector-button:hover {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(127, 87, 184, 0.3);
}

/* 履歴パネル */
#history-content {
  max-height: 600px;
  overflow-y: auto;
  padding-right: 8px;
}

#history-content::-webkit-scrollbar {
  width: 6px;
}

#history-content::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 3px;
}

#history-content::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

#history-content::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

#history-content > div {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid #334155;
  font-size: 13px;
  font-weight: 400;
  color: #cbd5e1;
  transition: all 0.2s ease;
  line-height: 1.5;
}

#history-content > div:hover {
  background: rgba(15, 23, 42, 0.7);
  border-color: #475569;
}

#history-content > div:first-child {
  background: rgba(95, 173, 207, 0.1);
  border-color: #5FADCF;
}

/* スクロールバーのスタイル */
.controls::-webkit-scrollbar {
  width: 8px;
}

.controls::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 4px;
}

.controls::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

.controls::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

/* レスポンシブデザイン */
@media (max-width: 1200px) {
  .controls,
  .visualizer,
  .range-settings-section,
  .log-sections {
    flex: 1 1 100%;
    max-width: 100%;
  }
  
  .log-sections {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  body {
    padding: 12px;
  }

  .container {
    gap: 16px;
  }

  .controls,
  .visualizer,
  .range-settings-section,
  .log-sections {
    min-width: 100%;
  }

  .history-panel,
  .visualizer {
    padding: 16px;
  }

  button {
    width: 100%;
  }
  
  .range-grid {
    grid-template-columns: 1fr;
  }
}
\`,
  "generate-log.js": \`// Generate log data with simultaneous independent device movements
// Each device moves independently to different target values at different times
// Devices can increase or decrease simultaneously

const fs = require('fs');
const path = require('path');

function generateLog() {
  const records = [];
  const totalDuration = 30000; // 30 seconds total
  const interval = 200; // 200ms sampling interval
  const tau = 0.5; // Time constant (0.5 seconds) for exponential movement
  
  // Interpolate value from start to target using exponential function
  // f(x) = target - (target - start) * e^(-x/tau)
  function interpolateValue(startValue, targetValue, elapsedTime) {
    const diff = targetValue - startValue;
    const value = targetValue - diff * Math.exp(-elapsedTime / tau);
    return Math.round(Math.max(0, Math.min(100, value)));
  }
  
  // Device state tracking
  class DeviceState {
    constructor(id) {
      this.id = id;
      this.currentValue = Math.floor(Math.random() * 101); // Random initial value 0-100
      this.targetValue = this.currentValue;
      this.startValue = this.currentValue; // Value at start of current movement
      this.movementStartTime = 0;
      this.isMoving = false;
      this.movementDuration = 0;
    }
    
    // Start a new movement to a random target
    startMovement(currentTime) {
      // Update current value to actual value at this moment (if moving, interpolate)
      if (this.isMoving) {
        this.currentValue = this.getValueAtTime(currentTime, false);
      }
      
      // Generate random target (different from current)
      let newTarget;
      do {
        newTarget = Math.floor(Math.random() * 101);
      } while (Math.abs(newTarget - this.currentValue) < 10); // At least 10 points difference
      
      this.startValue = this.currentValue;
      this.targetValue = newTarget;
      this.movementStartTime = currentTime;
      this.isMoving = true;
      // Random movement duration between 2-6 seconds
      this.movementDuration = 2000 + Math.random() * 4000;
    }
    
    // Get value at a given time
    getValueAtTime(currentTime, updateState = true) {
      if (!this.isMoving) {
        return this.currentValue;
      }
      
      const elapsed = (currentTime - this.movementStartTime) / 1000; // Convert to seconds
      
      if (elapsed >= this.movementDuration / 1000) {
        // Movement complete
        const finalValue = this.targetValue;
        if (updateState) {
          this.currentValue = finalValue;
          this.isMoving = false;
        }
        return finalValue;
      }
      
      // Interpolate during movement
      return interpolateValue(this.startValue, this.targetValue, elapsed);
    }
    
    // Check if should start new movement (random chance)
    shouldStartNewMovement(currentTime, minTimeBetweenMovements = 1000) {
      if (this.isMoving) return false;
      const timeSinceLastMovement = currentTime - (this.movementStartTime + this.movementDuration);
      if (timeSinceLastMovement < minTimeBetweenMovements) return false;
      
      // Random chance to start movement (higher chance as time passes)
      const chance = Math.min(0.3, (timeSinceLastMovement - minTimeBetweenMovements) / 5000);
      return Math.random() < chance;
    }
  }
  
  // Initialize 4 devices with random initial states
  const devices = [];
  for (let i = 1; i <= 4; i++) {
    const device = new DeviceState(i);
    // Random initial delay before first movement (0-3 seconds)
    device.movementStartTime = -Math.random() * 3000;
    devices.push(device);
  }
  
  // Generate records for all time points
  for (let t = 0; t <= totalDuration; t += interval) {
    for (const device of devices) {
      // Check if device should start a new movement
      if (device.shouldStartNewMovement(t)) {
        device.startMovement(t);
      }
      
      // Get current value
      const value = device.getValueAtTime(t);
      
      // Record value
      records.push({
        id: device.id,
        value: value,
        ts: t
      });
    }
  }
  
  // Sort by timestamp, then by device ID
  records.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.id - b.id;
  });
  
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, 'positionVisualizer', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Write to file
  const filename = path.join(logsDir, 'meter-log-simulated-30s-simultaneous.json');
  fs.writeFileSync(filename, JSON.stringify(records, null, 2), 'utf8');
  
  console.log(\\\`Generated \\\${records.length} records\\\`);
  console.log(\\\`Total duration: \\\${totalDuration / 1000} seconds\\\`);
  console.log(\\\`Devices: 4 (independent simultaneous movements)\\\`);
  console.log(\\\`Saved to: \\\${filename}\\\`);
  
  // Print sample values showing simultaneous movements
  console.log('\\\\nSample values showing simultaneous movements (first 30 records):');
  records.slice(0, 30).forEach(r => {
    console.log(\\\`  t=\\\${r.ts}ms: device \\\${r.id} = \\\${r.value}\\\`);
  });
  
  // Show example of simultaneous movement
  console.log('\\\\nExample simultaneous movement (around 5000ms):');
  records.filter(r => r.ts >= 4800 && r.ts <= 5200).forEach(r => {
    console.log(\\\`  t=\\\${r.ts}ms: device \\\${r.id} = \\\${r.value}\\\`);
  });
}

generateLog();

\`,
  "http-server-bundled.js": \`// Simple HTTP server for serving static files from bundled resources
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

// 環境情報のログ出力
console.log('==== HTTP Server Environment ====');
console.log('OS Platform:', process.platform);
console.log('Node Version:', process.version);
console.log('Working Directory:', process.cwd());
console.log('Script Directory:', __dirname);
console.log('Base Directory:', baseDir);
console.log('================================');

// バンドルリソース情報
if (resources) {
  console.log(\\\`バンドルリソース利用可能: \\\${resources.listResources().length}ファイル\\\`);
} else {
  // ファイルシステムのアクセス確認
  try {
    fs.accessSync(baseDir, fs.constants.R_OK);
    console.log(\\\`ベースディレクトリにアクセス可能: \\\${baseDir}\\\`);
    // ディレクトリの内容をログ出力
    const files = fs.readdirSync(baseDir);
    console.log(\\\`ベースディレクトリ内のファイル数: \\\${files.length}\\\`);
    if (files.includes('index.html')) {
      console.log('index.html が見つかりました');
    } else {
      console.warn('警告: index.html が見つかりません');
    }
  } catch (err) {
    console.error(\\\`ベースディレクトリへのアクセスエラー: \\\${err.message}\\\`);
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
      console.error(\\\`リソースが見つかりません: \\\${pathname}\\\`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    console.log(\\\`バンドルから配信: \\\${pathname}, MIME: \\\${mimeType}, サイズ: \\\${resource.length} バイト\\\`);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(resource);
  } catch (error) {
    console.error(\\\`バンドルリソース取得エラー: \\\${pathname}\\\`, error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
}

// ファイルシステムから配信
function serveFile(filePath, res) {
  const mimeType = getMimeType(filePath);
  console.log(\\\`ファイルから配信: \\\${filePath}, MIME: \\\${mimeType}\\\`);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(\\\`ファイル読み込みエラー (\\\${filePath}):\\\`, err.message);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    console.log(\\\`ファイル読み込み成功: \\\${filePath}, サイズ: \\\${data.length} バイト\\\`);
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

  console.log(\\\`リクエスト: \\\${pathname}\\\`);

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
  console.log(\\\`HTTP server listening on http://\\\${HOST}:\\\${PORT}\\\`);
  if (resources) {
    console.log(\\\`バンドルリソースから配信中 (ファイルシステムアクセスなし)\\\`);
  } else {
    console.log(\\\`Serving files from: \\\${baseDir}\\\`);
  }
});

// サーバーのエラーハンドリングを強化
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\\\`ポート \\\${PORT} は既に使用されています。\\\`);
    console.error(\\\`別のポートを試します...\\\`);

    // 別のポートを試す
    server.close();
    const newPort = PORT + 1;
    server.listen(newPort, HOST, () => {
      console.log(\\\`代替ポート \\\${newPort} で起動しました: http://\\\${HOST}:\\\${newPort}\\\`);
      console.log(\\\`環境変数 HTTP_PORT=\\\${newPort} を設定することで、このポートを永続的に使用できます\\\`);
    });
  } else {
    console.error('サーバーエラー詳細:', err);
    // 終了せずにエラーをログ
    console.error('サーバー起動に失敗しましたが、処理を継続します');
  }
});\`,
  "http-server.js": \`// Simple HTTP server for serving static files
// Used by positionVisualizer to serve HTML/CSS/JS files

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.HTTP_PORT || 8000);
const HOST = process.env.HTTP_HOST || '127.0.0.1';

// コンパイル後のバイナリでは、ファイルは同じディレクトリにある必要がある
const toolsDir = __dirname;
const baseDir = __dirname;
console.log('Base directory for static files:', baseDir);

// 環境情報のログ出力
console.log('==== HTTP Server Environment ====');
console.log('OS Platform:', process.platform);
console.log('Node Version:', process.version);
console.log('Working Directory:', process.cwd());
console.log('Script Directory:', toolsDir);
console.log('Base Directory:', baseDir);
console.log('================================');

// ファイルシステムのアクセス確認
try {
  fs.accessSync(baseDir, fs.constants.R_OK);
  console.log(\\\`ベースディレクトリにアクセス可能: \\\${baseDir}\\\`);
  // ディレクトリの内容をログ出力
  const files = fs.readdirSync(baseDir);
  console.log(\\\`ベースディレクトリ内のファイル数: \\\${files.length}\\\`);
  if (files.includes('index.html')) {
    console.log('index.html が見つかりました');
  } else {
    console.warn('警告: index.html が見つかりません');
  }
} catch (err) {
  console.error(\\\`ベースディレクトリへのアクセスエラー: \\\${err.message}\\\`);
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

function serveFile(filePath, res) {
  const mimeType = getMimeType(filePath);
  console.log(\\\`配信ファイル: \\\${filePath}, MIME: \\\${mimeType}\\\`);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(\\\`ファイル読み込みエラー (\\\${filePath}):\\\`, err.message);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    console.log(\\\`ファイル読み込み成功: \\\${filePath}, サイズ: \\\${data.length} バイト\\\`);
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
  console.log(\\\`HTTP server listening on http://\\\${HOST}:\\\${PORT}\\\`);
  console.log(\\\`Serving files from: \\\${baseDir}\\\`);
});

// サーバーのエラーハンドリングを強化
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\\\`ポート \\\${PORT} は既に使用されています。\\\`);
    console.error(\\\`別のポートを試します...\\\`);

    // 別のポートを試す
    server.close();
    const newPort = PORT + 1;
    server.listen(newPort, HOST, () => {
      console.log(\\\`代替ポート \\\${newPort} で起動しました: http://\\\${HOST}:\\\${newPort}\\\`);
      console.log(\\\`環境変数 HTTP_PORT=\\\${newPort} を設定することで、このポートを永続的に使用できます\\\`);
    });
  } else {
    console.error('サーバーエラー詳細:', err);
    // 終了せずにエラーをログ
    console.error('サーバー起動に失敗しましたが、処理を継続します');
  }
});

\`,
  "index.html": \`<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>positionVisualizer</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="preload" href="assets/icon.svg" as="image" type="image/svg+xml">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <script>
      (function(d) {
        var config = { kitId: 'kaz6zgt', scriptTimeout: 3000, async: true },
        h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\\\bwf-loading\\\\b/g,"")+" wf-inactive";},config.scriptTimeout),
        tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";
        tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;
        tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};
        s.parentNode.insertBefore(tk,s)
      })(document);
    </script>
    <style>
      /* Fallback styles */
      .container{
        display:flex;
        flex-wrap:wrap;
        gap:20px;
        align-items:flex-start;
        justify-content:center;
        padding:10px;
        max-width:100%;
        min-height:calc(100vh - 40px);
        margin:0 auto;
        box-sizing: border-box;
      }
      .controls{flex:0 1 calc(50% - 10px);min-width:300px;max-width:500px;height:480px;border:1px solid #334155;padding:20px;border-radius:16px}
      .visualizer{flex:1 1 calc(50% - 10px);min-width:300px;max-width:740px;height:480px;border:1px solid #334155;padding:20px;border-radius:16px;min-height:400px;display:flex;flex-direction:column}
      .range-settings-section{flex:0 1 calc(50% - 10px);min-width:300px;max-width:500px;border:1px solid #334155;padding:16px;border-radius:16px}
      .log-sections{flex:1 1 calc(50% - 10px);min-width:300px;max-width:740px;border:1px solid #334155;padding:16px;border-radius:16px}
      .meter-container{position:relative;width:100%;max-width:980px;margin:0 auto;aspect-ratio:16/9;flex:1}
      #icons-container{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
      button{cursor:pointer}

      /* オーバーレイボタン用スタイル */
      .visualizer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        width: 100%;
        flex-wrap: wrap;
        gap: 10px;
      }
      .visualizer-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        flex: 1;
        min-width: 120px;
      }
      .overlay-button {
        background-color: #334155;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 14px;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        white-space: nowrap;
        line-height: 1.2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 140px;
      }
      .overlay-button:hover {
        background-color: #1e293b;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      }

      /* レスポンシブ対応 */
      @media (max-width: 768px) {
        .container {
          padding: 8px;
          gap: 12px;
        }
      }

      @media (max-width: 500px) {
        .visualizer-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .visualizer-title {
          margin-bottom: 8px;
        }
        .overlay-button {
          width: 100%;
        }
        .visualizer, .controls, .range-settings-section, .log-sections {
          padding: 15px;
        }
      }
    </style>
    <script>
      // キャッシュクリア用のビルドクエリ
      window.__buildTs = Date.now();
    </script>
</head>
<body>
    <div class="container">
        <div class="controls">
            <h2>デバイス設定</h2>
            <div class="device-inputs">
                <div class="device-group">
                    <label>デバイス1</label>
                    <label class="icon-file-button" for="device1-icon">
                        <input type="file" id="device1-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス2</label>
                    <label class="icon-file-button" for="device2-icon">
                        <input type="file" id="device2-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス3</label>
                    <label class="icon-file-button" for="device3-icon">
                        <input type="file" id="device3-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス4</label>
                    <label class="icon-file-button" for="device4-icon">
                        <input type="file" id="device4-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス5</label>
                    <label class="icon-file-button" for="device5-icon">
                        <input type="file" id="device5-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス6</label>
                    <label class="icon-file-button" for="device6-icon">
                        <input type="file" id="device6-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
            </div>
        </div>

        <div class="visualizer">
            <div class="visualizer-header">
                <h2 class="visualizer-title">プレビュー</h2>
                <button id="open-overlay" class="overlay-button" title="オーバーレイウィンドウを開く">
                    オーバーレイを開く
                </button>
            </div>
            <div class="meter-container" id="meter-container">
                <div id="icons-container"></div>
            </div>
        </div>
        <div class="range-settings-section">
            <h3>値の範囲設定</h3>
            <div class="range-grid">
                <div class="device-group">
                    <label>最小値</label>
                    <input type="number" id="min-value" value="0" step="0.1">
                </div>
                <div class="device-group">
                    <label>最大値</label>
                    <input type="number" id="max-value" value="100" step="0.1">
                </div>
                <div class="device-group">
                    <label>単位</label>
                    <input type="text" id="value-unit" value="%" placeholder="例: %, °, kg">
                </div>
            </div>
        </div>
        
        <div class="log-sections">
            <div class="log-replay-section">
                <label>ログ再生</label>
                <input type="file" id="log-file" accept="application/json,.json">
                <div class="log-replay-buttons">
                    <button id="play-log">再生</button>
                    <button id="stop-log">停止</button>
                </div>
            </div>
            <div class="log-record-section">
                <label>ログ記録</label>
                <div class="log-record-status" id="log-record-status">停止中</div>
                <div class="log-record-buttons">
                    <button id="start-record">記録開始</button>
                    <button id="stop-record">記録終了</button>
                </div>
            </div>
        </div>
    </div>

    <script>window.USE_MVVM = true;</script>
    <script src="src/app/main.js"></script>
    <script>
        // オーバーレイを開くボタンの機能を追加
        document.addEventListener('DOMContentLoaded', function() {
            const openOverlayButton = document.getElementById('open-overlay');
            if (openOverlayButton) {
                openOverlayButton.addEventListener('click', function() {
                    // 別ウィンドウでオーバーレイを開く
                    window.open('overlay.html', 'overlay_window', 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no');
                });
            }
        });
    </script>
</body>
</html>


\`,
  "integrated-server.js": \`// integrated-server.js
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
  const match = String(deviceId).match(/(\\\\d+)$/);
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

        const filename = data.filename || \\\`meter-log-\\\${Date.now()}.json\\\`;
        const filepath = path.join(jsonDir, filename);
        const jsonContent = JSON.stringify(data.records, null, 2);

        fs.writeFile(filepath, jsonContent, 'utf8', (err) => {
          if (err) {
            console.error('Failed to save log:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save log file' }));
            return;
          }
          console.log(\\\`Log saved: \\\${filepath}\\\`);
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
        console.log(\\\`[bridge] device_update: device_id=\\\${device_id}, index=\\\${index}, value=\\\${valueData.value}\\\`);

        if (index >= 0 && index < 6 && typeof valueData.value === 'number') {
          latest.values[index] = valueData.value;
          latest.ts = Date.now();
          console.log(\\\`[bridge] Broadcasting update: index=\\\${index}, value=\\\${valueData.value}\\\`);
          broadcast({ type: 'state', payload: latest });
        } else {
          console.log(\\\`[bridge] device_update: invalid index or value (index=\\\${index}, value=\\\${valueData.value})\\\`);
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
  console.log(\\\`HTTPサーバーが起動しました http://\\\${HTTP_HOST}:\\\${HTTP_PORT}\\\`);
  console.log(\\\`WebSocketエンドポイント: ws://\\\${HTTP_HOST}:\\\${WS_PORT}\\\`);
  console.log(\\\`静的ファイル配信元: \\\${appDir}\\\`);

  // LeverAPIに接続
  connectToLeverAPI();

  // ブラウザを開く
  openBrowser();

  // コンソール表示
  console.log('\\\\n----------------------------------------');
  console.log('サーバーが起動しました');
  console.log('終了するには Q または q キーを押すか、Ctrl+C を押してください');
  console.log('----------------------------------------\\\\n');

  // キー入力待機
  waitForKeyPress();
});

// エラーハンドリング
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\\\`ポート \\\${HTTP_PORT} は既に使用されています。\\\`);
    console.error(\\\`ポート \\\${HTTP_PORT} を使用しているアプリケーションを終了するか、HTTP_PORT環境変数を設定して別のポートを使用してください。\\\`);
  } else {
    console.error('サーバーエラー:', err);
  }
  process.exit(1);
});

// ブラウザを開く関数
function openBrowser() {
  const url = \\\`http://\\\${HTTP_HOST}:\\\${HTTP_PORT}/\\\`;
  const overlayUrl = \\\`http://\\\${HTTP_HOST}:\\\${HTTP_PORT}/overlay.html\\\`;

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
    exec(\\\`\\\${command} "\\\${url}"\\\`);

    // 少し待ってからオーバーレイを開く（必ず別ウィンドウで）
    setTimeout(() => {
      if (process.platform === 'win32') {
        // Windowsでは新しいウィンドウを強制するオプションを指定
        exec(\\\`\\\${overlayCommand} "" "\\\${overlayUrl}"\\\`);
      } else if (process.platform === 'darwin') {
        // macOSでは -n オプションで必ず新しいウィンドウを開く
        exec(\\\`\\\${overlayCommand} "\\\${overlayUrl}"\\\`);
      } else {
        // Linuxなど
        exec(\\\`\\\${overlayCommand} "\\\${overlayUrl}"\\\`);
      }
    }, 1000);

    console.log(\\\`ブラウザが開きました: \\\${url}\\\`);
    console.log(\\\`オーバーレイ(別ウィンドウ): \\\${overlayUrl}\\\`);
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
});\`,
  "js/core/event.js": \`(function(){
  function Emitter(){ this.listeners = {}; }
  Emitter.prototype.on = function(event, fn){
    (this.listeners[event] ||= new Set()).add(fn); return () => this.off(event, fn);
  };
  Emitter.prototype.off = function(event, fn){
    const set = this.listeners[event]; if (!set) return; set.delete(fn);
  };
  Emitter.prototype.emit = function(event, payload){
    const set = this.listeners[event]; if (!set) return; set.forEach(fn => { try{ fn(payload); }catch(_){} });
  };
  window.MVVM = window.MVVM || {}; window.MVVM.Emitter = Emitter;
})();

\`,
  "js/core/model.js": \`(function(){
  function MeterState(values, names, icon, icons){
    // Initialize values array with null support (null means device not connected)
    if (Array.isArray(values)) {
      const arr = values.slice(0,6);
      while (arr.length < 6) arr.push(null);
      this.values = arr;
    } else {
      this.values = [null, null, null, null, null, null];
    }
    this.names = Array.isArray(names) ? names.slice(0,6) : ['','','','','',''];
    this.icon = icon || 'assets/icon.svg';
    // Per-index icons (optional). Falls back to single icon if not provided
    if (Array.isArray(icons)) {
      const arr = icons.slice(0,6);
      while (arr.length < 6) arr.push(null);
      this.icons = arr;
    } else {
      this.icons = [null, null, null, null, null, null];
    }
  }
  MeterState.prototype.clone = function(){ return new MeterState(this.values.slice(0,6), this.names.slice(0,6), this.icon, this.icons.slice(0,6)); };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterState = MeterState;
})();

\`,
  "js/core/viewModel.js": \`(function(){
  const Emitter = (window.MVVM && window.MVVM.Emitter);
  const MeterState = (window.MVVM && window.MVVM.MeterState);

  function MeterViewModel(initial){
    this.emitter = new Emitter();
    this.state = initial instanceof MeterState ? initial : new MeterState();
    this.running = false;
    this.pollIntervalMs = 100; // Fixed at 100ms
    this._timer = null;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Interpolation state for smooth animation
    this._interpolationDuration = 200; // ms
    this._interpolations = []; // Array of { index, startValue, targetValue, startTime, endTime }
    this._animationFrameId = null;
  }

  MeterViewModel.prototype.onChange = function(fn){ return this.emitter.on('change', fn); };
  MeterViewModel.prototype._notify = function(){ this.emitter.emit('change', this.state.clone()); };
  MeterViewModel.prototype.setPollInterval = function(ms){ this.pollIntervalMs = 100; }; // Fixed at 100ms, cannot be changed
  MeterViewModel.prototype.setMinValue = function(v){ 
    let min = Number(v);
    if (!isNaN(min)) {
      // Allow any numeric value, but ensure min < max
      if (min >= this.maxValue) {
        this.maxValue = min + 1;
      }
      this.minValue = min;
      this._notify();
    }
  };
  MeterViewModel.prototype.setMaxValue = function(v){ 
    let max = Number(v);
    if (!isNaN(max)) {
      // Allow any numeric value, but ensure max > min
      if (max <= this.minValue) {
        this.minValue = max - 1;
      }
      this.maxValue = max;
      this._notify();
    }
  };
  MeterViewModel.prototype.setUnit = function(v){ 
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };
  
  // Convert actual value to percentage (0-100) for meter position calculation
  MeterViewModel.prototype.normalizeValue = function(actualValue){
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };
  
  // Convert percentage (0-100) back to actual value
  MeterViewModel.prototype.denormalizeValue = function(percentage){
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };
  MeterViewModel.prototype.setName = function(index, name){
    if (index < 0 || index > 5) return; this.state.names[index] = String(name || '').trim() || this.state.names[index]; this._notify();
  };
  MeterViewModel.prototype.setValue = function(index, value, smooth, isNormalized){
    if (index < 0 || index > 5) return; 
    // Allow null to be set (indicates device not connected)
    if (value === null || value === undefined) {
      // Cancel any interpolation for this index
      this._interpolations = this._interpolations.filter(interp => interp.index !== index);
      this.state.values[index] = null;
      this._notify();
      return;
    }
    
    let normalized;
    if (isNormalized === true) {
      // Value is already normalized (0-100), use it directly
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      // Store actual value, but normalize to 0-100 for internal state
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }
    
    // Check if smooth interpolation is enabled (default: true)
    const useSmooth = smooth !== false;
    
    // Get current normalized value (may be null/undefined)
    const currentNormalized = this.state.values[index];
    
    if (useSmooth && currentNormalized !== null && currentNormalized !== undefined && !isNaN(currentNormalized)) {
      // Start interpolation from current value to target value
      const targetNormalized = normalized;
      
      // Only interpolate if there's a meaningful difference (reduced threshold for smoother animation)
      const diff = Math.abs(currentNormalized - targetNormalized);
      if (diff > 0.01) {
        // Remove any existing interpolation for this index
        this._interpolations = this._interpolations.filter(interp => interp.index !== index);
        
        // Add new interpolation
        const now = performance.now();
        this._interpolations.push({
          index: index,
          startValue: currentNormalized,
          targetValue: targetNormalized,
          startTime: now,
          endTime: now + this._interpolationDuration
        });
        
        // Start animation loop if not already running
        this._startInterpolation();
        return;
      }
    }
    
    // Set value immediately (no interpolation or difference too small)
    this.state.values[index] = normalized;
    this._notify();
  };
  
  // Start interpolation animation loop
  MeterViewModel.prototype._startInterpolation = function(){
    if (this._animationFrameId !== null) return; // Already running
    
    const self = this;
    const animate = function(){
      const now = performance.now();
      let needsUpdate = false;
      
      // Update all active interpolations
      self._interpolations.forEach(interp => {
        if (now >= interp.endTime) {
          // Interpolation complete - set to target value
          if (self.state.values[interp.index] !== interp.targetValue) {
            self.state.values[interp.index] = interp.targetValue;
            needsUpdate = true;
          }
        } else {
          // Interpolate between start and target
          const progress = (now - interp.startTime) / (interp.endTime - interp.startTime);
          const clampedProgress = Math.max(0, Math.min(1, progress)); // Ensure 0-1 range
          const currentValue = interp.startValue + (interp.targetValue - interp.startValue) * clampedProgress;
          self.state.values[interp.index] = currentValue;
          needsUpdate = true;
        }
      });
      
      // Remove completed interpolations
      const beforeCount = self._interpolations.length;
      self._interpolations = self._interpolations.filter(interp => now < interp.endTime);
      
      // Notify listeners if there was an update
      if (needsUpdate) {
        self._notify();
      }
      
      // Continue animation if there are active interpolations
      if (self._interpolations.length > 0) {
        self._animationFrameId = requestAnimationFrame(animate);
      } else {
        self._animationFrameId = null;
      }
    };
    
    this._animationFrameId = requestAnimationFrame(animate);
  };
  
  // Set interpolation duration
  MeterViewModel.prototype.setInterpolationDuration = function(ms){
    this._interpolationDuration = Math.max(0, Math.min(1000, Number(ms) || 200));
  };
  
  // Get actual value (not normalized) for display
  MeterViewModel.prototype.getActualValue = function(index){
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };
  
  // Get all actual values
  MeterViewModel.prototype.getActualValues = function(){
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };
  
  // Get connected device indices (indices where value is not null)
  MeterViewModel.prototype.getConnectedDeviceIndices = function(){
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };
  MeterViewModel.prototype.setIcon = function(path){ if (path) { this.state.icon = path; this._notify(); } };
  MeterViewModel.prototype.setIconAt = function(index, path){
    if (index < 0 || index > 3) return;
    this.state.icons[index] = String(path || '');
    this._notify();
  };

  MeterViewModel.prototype.setState = function(next){
    if (!next) return;
    if (!(next instanceof MeterState)) next = new MeterState(next.values, next.names, next.icon, next.icons);
    this.state = next;
    this._notify();
  };

  MeterViewModel.prototype.toJSON = function(){
    return { values: this.state.values.slice(0,6), names: this.state.names.slice(0,6), icon: this.state.icon, icons: this.state.icons.slice(0,6) };
  };

  MeterViewModel.prototype.start = function(){
    if (this.running) return; this.running = true;
    // Start polling for device data (handled by MonitorBinding)
    this._notify();
  };

  MeterViewModel.prototype.stop = function(){
    if (!this.running) return; this.running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    // Stop interpolation animation
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    // Complete all interpolations immediately
    this._interpolations.forEach(interp => {
      this.state.values[interp.index] = interp.targetValue;
    });
    this._interpolations = [];
    this._notify();
  };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterViewModel = MeterViewModel;
})();

\`,
  "js/views/iconRenderer.js": \`// Simple placeholder for potential separate icon rendering logic
// Currently handled inside meterRenderer. Expose a tiny API for compatibility.
(function () {
  function getIpForIndex(index) {
    const input = document.getElementById(\\\`device\\\${index + 1}-ip\\\`);
    return (input && input.value && input.value.trim()) || '';
  }

  // Get min/max/unit from DOM
  function getRangeSettings() {
    const minEl = document.getElementById('min-value');
    const maxEl = document.getElementById('max-value');
    const unitEl = document.getElementById('value-unit');
    const minValue = minEl ? Number(minEl.value) : 0;
    const maxValue = maxEl ? Number(maxEl.value) : 100;
    const unit = unitEl ? (unitEl.value || '%') : '%';
    return { minValue, maxValue, unit };
  }

  // Convert normalized percentage (0-100) to actual value based on min/max settings
  function denormalizeValue(percentage, minValue, maxValue) {
    const range = maxValue - minValue;
    if (range === 0) return minValue;
    return minValue + (percentage / 100) * range;
  }

  // Update value display for an icon
  function updateIconValue(g, index) {
    try {
      if (!g) return;
      
      // Get percentage from data attribute (0-100)
      const percentageAttr = g.getAttribute('data-percentage');
      if (!percentageAttr) return; // No percentage data yet
      
      const percentage = parseFloat(percentageAttr);
      if (isNaN(percentage)) return;
      
      // Get range settings
      const { minValue, maxValue, unit } = getRangeSettings();
      
      // Convert to actual value
      const actualValue = denormalizeValue(percentage, minValue, maxValue);
      const roundedValue = Math.round(actualValue);
      
      // Find or create text element
      let textEl = g.querySelector('text.icon-value');
      if (!textEl) {
        // Check if g is in an SVG context
        if (!g.ownerSVGElement && !g.closest('svg')) return;
        
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('class', 'icon-value');
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '15');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('font-weight', '700');
        textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        textEl.setAttribute('fill', '#ffffff');
        textEl.setAttribute('paint-order', 'stroke');
        textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        textEl.setAttribute('stroke-width', '3');
        g.appendChild(textEl);
      }
      
      // Update text content
      textEl.textContent = \\\`\\\${roundedValue}\\\${unit}\\\`;
      textEl.setAttribute('data-actual', String(roundedValue));
      textEl.setAttribute('data-unit', unit);
    } catch (error) {
      console.error('Error updating icon value:', error);
    }
  }

  // Cache range settings to avoid repeated DOM queries
  let cachedRangeSettings = null;
  let rangeSettingsCacheTime = 0;
  const RANGE_SETTINGS_CACHE_MS = 100; // Cache for 100ms

  function getCachedRangeSettings() {
    const now = Date.now();
    if (!cachedRangeSettings || (now - rangeSettingsCacheTime) > RANGE_SETTINGS_CACHE_MS) {
      cachedRangeSettings = getRangeSettings();
      rangeSettingsCacheTime = now;
    }
    return cachedRangeSettings;
  }

  // Update all icon values
  function updateAllIconValues() {
    try {
      const svg = document.querySelector('#meter-container svg[data-meter]');
      if (!svg) return;
      
      // Get range settings once for all icons
      const { minValue, maxValue, unit } = getCachedRangeSettings();
      
      for (let i = 0; i < 6; i++) {
        const g = svg.querySelector(\\\`g[data-perf="\\\${i}"]\\\`);
        if (g && g.style.display !== 'none') {
          updateIconValueFast(g, i, minValue, maxValue, unit);
        }
      }
    } catch (error) {
      console.error('Error updating all icon values:', error);
    }
  }

  // Fast version that accepts pre-fetched range settings
  function updateIconValueFast(g, index, minValue, maxValue, unit) {
    try {
      if (!g) return;
      
      const percentageAttr = g.getAttribute('data-percentage');
      if (!percentageAttr) return;
      
      const percentage = parseFloat(percentageAttr);
      if (isNaN(percentage)) return;
      
      const actualValue = denormalizeValue(percentage, minValue, maxValue);
      const roundedValue = Math.round(actualValue);
      
      let textEl = g.querySelector('text.icon-value');
      if (!textEl) {
        if (!g.ownerSVGElement && !g.closest('svg')) return;
        
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('class', 'icon-value');
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '15');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('font-weight', '700');
        textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        textEl.setAttribute('fill', '#ffffff');
        textEl.setAttribute('paint-order', 'stroke');
        textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        textEl.setAttribute('stroke-width', '3');
        g.appendChild(textEl);
      }
      
      const newText = \\\`\\\${roundedValue}\\\${unit}\\\`;
      if (textEl.textContent !== newText) {
        textEl.textContent = newText;
        textEl.setAttribute('data-actual', String(roundedValue));
        textEl.setAttribute('data-unit', unit);
      }
    } catch (error) {
      console.error('Error updating icon value:', error);
    }
  }

  function applyVisibility() {
    try {
      const svg = document.querySelector('#meter-container svg[data-meter]');
      if (!svg) return;
      for (let i = 0; i < 4; i++) {
        const g = svg.querySelector(\\\`g[data-perf="\\\${i}"]\\\`);
        if (!g) continue;
        const hasIp = !!getIpForIndex(i);
        g.style.display = hasIp ? '' : 'none';
      }
      // Update values immediately using requestAnimationFrame for smooth updates
      requestAnimationFrame(() => updateAllIconValues());
    } catch (error) {
      console.error('Error applying visibility:', error);
    }
  }

  function setupListeners() {
    ['device1-ip','device2-ip','device3-ip','device4-ip'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', applyVisibility);
      el.addEventListener('change', applyVisibility);
    });

    // Listen to range settings changes
    ['min-value', 'max-value', 'value-unit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateAllIconValues);
        el.addEventListener('change', updateAllIconValues);
      }
    });

    // Re-apply when meter SVG updates (animations preserved)
    const container = document.getElementById('meter-container');
    if (container && window.MutationObserver) {
      // Track last known values to detect changes
      const lastValues = new Map();
      
      const mo = new MutationObserver((mutations) => {
        try {
          const { minValue, maxValue, unit } = getCachedRangeSettings();
          let hasChildListChange = false;
          
          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'data-percentage' || 
                 mutation.attributeName === 'data-actual')) {
              // Update the specific icon that changed immediately (synchronously)
              const target = mutation.target;
              if (target && target.tagName === 'g' && target.hasAttribute('data-perf')) {
                const index = parseInt(target.getAttribute('data-perf') || '0', 10);
                if (!isNaN(index)) {
                  const percentageAttr = target.getAttribute('data-percentage');
                  if (percentageAttr) {
                    const percentage = parseFloat(percentageAttr);
                    const lastValue = lastValues.get(index);
                    // Only update if value actually changed
                    if (lastValue !== percentage) {
                      lastValues.set(index, percentage);
                      updateIconValueFast(target, index, minValue, maxValue, unit);
                    }
                  }
                }
              }
            } else if (mutation.type === 'childList') {
              hasChildListChange = true;
            }
          });
          
          // If new icons were added, update all
          if (hasChildListChange) {
            requestAnimationFrame(() => updateAllIconValues());
          }
        } catch (error) {
          console.error('Error in MutationObserver:', error);
        }
      });
      mo.observe(container, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['data-percentage', 'data-actual', 'style']
      });
      
      // Also poll for changes as a fallback to ensure real-time updates
      // This catches any changes that MutationObserver might miss
      let lastPollTime = Date.now();
      const pollInterval = 16; // ~60fps
      
      const pollForChanges = () => {
        const now = Date.now();
        if (now - lastPollTime < pollInterval) {
          requestAnimationFrame(pollForChanges);
          return;
        }
        lastPollTime = now;
        
        try {
          const svg = document.querySelector('#meter-container svg[data-meter]');
          if (!svg) {
            requestAnimationFrame(pollForChanges);
            return;
          }
          
          const { minValue, maxValue, unit } = getCachedRangeSettings();
          
          for (let i = 0; i < 6; i++) {
            const g = svg.querySelector(\\\`g[data-perf="\\\${i}"]\\\`);
            if (!g || g.style.display === 'none') continue;
            
            const percentageAttr = g.getAttribute('data-percentage');
            if (!percentageAttr) continue;
            
            const percentage = parseFloat(percentageAttr);
            if (isNaN(percentage)) continue;
            
            const lastValue = lastValues.get(i);
            if (lastValue !== percentage) {
              lastValues.set(i, percentage);
              updateIconValueFast(g, i, minValue, maxValue, unit);
            }
          }
        } catch (error) {
          console.error('Error in polling:', error);
        }
        
        requestAnimationFrame(pollForChanges);
      };
      
      // Start polling
      requestAnimationFrame(pollForChanges);
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupListeners();
        // Use requestAnimationFrame for faster initial render
        requestAnimationFrame(() => {
          applyVisibility();
          updateAllIconValues();
        });
      });
    } else {
      setupListeners();
      requestAnimationFrame(() => {
        applyVisibility();
        updateAllIconValues();
      });
    }
  }

  function placeIcons() {}

  init();
  window.IconRenderer = { placeIcons, applyVisibility, updateAllIconValues };
})();

\`,
  "js/views/meterRenderer.js": \`// Gradient meter + ticks + icons rendering
// Public API:
//   initMeter(containerEl)
//   updateMeter(values: number[], options?: { names?: string[], icon?: string })

(function () {
  const baseCx = 251.74;
  const baseCy = 168.17;
  const baseRadius = Math.sqrt((503.48 / 2) ** 2 + (168.17 * 0.52) ** 2);
  const strokeWidth = 100;
  const startAngle = -140;
  const endAngle = -40;
  const LANE_OFFSETS = [-40, -20, 0, 20, 40, 60]; // Fallback for max 6 devices
  const MAX_LANE_OFFSET = 30; // Maximum offset from base radius (within meter bounds)
  const MIN_LANE_OFFSET = -30; // Minimum offset from base radius (within meter bounds)

  // Calculate lane offsets dynamically based on device count
  function calculateLaneOffsets(deviceCount) {
    if (deviceCount <= 0) return [];
    if (deviceCount === 1) return [0]; // Center for single device
    // Distribute evenly between MIN_LANE_OFFSET and MAX_LANE_OFFSET
    const offsets = [];
    for (let i = 0; i < deviceCount; i++) {
      const t = deviceCount === 1 ? 0.5 : i / (deviceCount - 1); // 0 to 1
      const offset = MIN_LANE_OFFSET + (MAX_LANE_OFFSET - MIN_LANE_OFFSET) * t;
      offsets.push(offset);
    }
    return offsets;
  }

  const toRadians = (angle) => (angle * Math.PI) / 180;

  function calculateViewBox() { // 外側の円の大きさを計算（アイコンの位置も考慮）
    const outerRadius = baseRadius + strokeWidth / 2;
    const innerRadius = baseRadius - strokeWidth / 2;
    const angles = [startAngle, endAngle];
    for (let angle = Math.ceil(startAngle); angle <= Math.floor(endAngle); angle++) {
      if (angle % 90 === 0) angles.push(angle);
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    angles.forEach(angle => {
      const rad = (angle * Math.PI) / 180;
      const x_outer = baseCx + outerRadius * Math.cos(rad);
      const y_outer = baseCy + outerRadius * Math.sin(rad);
      const x_inner = baseCx + innerRadius * Math.cos(rad);
      const y_inner = baseCy + innerRadius * Math.sin(rad);
      minX = Math.min(minX, x_outer, x_inner);
      maxX = Math.max(maxX, x_outer, x_inner);
      minY = Math.min(minY, y_outer, y_inner);
      maxY = Math.max(maxY, y_outer, y_inner);
    });

    // Consider icon positions (icons are 50x50, with offsets up to 60)
    const maxIconOffset = Math.max(...LANE_OFFSETS.map(Math.abs));
    const iconRadius = 25; // Half of icon size (50/2)
    const maxRadius = baseRadius + maxIconOffset + iconRadius;

    // Check icon positions at start and end angles
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const iconPositions = [
      { x: baseCx + maxRadius * Math.cos(startRad), y: baseCy + maxRadius * Math.sin(startRad) },
      { x: baseCx + maxRadius * Math.cos(endRad), y: baseCy + maxRadius * Math.sin(endRad) }
    ];

    // Also check middle positions for icons
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const angle = startAngle + (endAngle - startAngle) * t;
      const angleRad = toRadians(angle);
      const radius = baseRadius + maxIconOffset;
      const x = baseCx + radius * Math.cos(angleRad);
      const y = baseCy + radius * Math.sin(angleRad);
      minX = Math.min(minX, x - iconRadius);
      maxX = Math.max(maxX, x + iconRadius);
      minY = Math.min(minY, y - iconRadius);
      maxY = Math.max(maxY, y + iconRadius);
    }

    // Add extra padding to ensure icons are never clipped
    const padding = 30; // Increased padding for overlay
    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      offsetX: -minX + padding,
      offsetY: -minY + padding
    };
  }

  const viewBox = calculateViewBox();
  const cx = baseCx + viewBox.offsetX;
  const cy = baseCy + viewBox.offsetY;

  function describeArc() {
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const innerRadius = baseRadius - strokeWidth / 2;
    const outerRadius = baseRadius + strokeWidth / 2;
    const x1 = cx + innerRadius * Math.cos(startRad);
    const y1 = cy + innerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(startRad);
    const y2 = cy + outerRadius * Math.sin(startRad);
    const x3 = cx + outerRadius * Math.cos(endRad);
    const y3 = cy + outerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(endRad);
    const y4 = cy + innerRadius * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return \\\`M \\\${x1} \\\${y1} L \\\${x2} \\\${y2} A \\\${outerRadius} \\\${outerRadius} 0 \\\${largeArc} 1 \\\${x3} \\\${y3} L \\\${x4} \\\${y4} A \\\${innerRadius} \\\${innerRadius} 0 \\\${largeArc} 0 \\\${x1} \\\${y1}\\\`;
  }

  function calculateIconPosition(percentage, laneIndex, deviceCount) {
    const clamped = Math.max(0, Math.min(100, percentage));
    const t = clamped / 100;
    const angle = startAngle + (endAngle - startAngle) * t;
    const angleRad = toRadians(angle);

    // Use dynamic lane offsets if deviceCount is provided, otherwise fallback to fixed offsets
    let laneOffsets;
    if (deviceCount && deviceCount > 0) {
      laneOffsets = calculateLaneOffsets(deviceCount);
    } else {
      laneOffsets = LANE_OFFSETS;
    }

    // Clamp laneIndex to valid range
    const safeLaneIndex = Math.max(0, Math.min(laneOffsets.length - 1, laneIndex));
    const offset = laneOffsets[safeLaneIndex] || 0;
    const radius = baseRadius + offset;
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    return { x, y };
  }

  function updateTickLabels(svg, minValue, maxValue, unit) {
    if (!svg) return;

    // Remove existing label group
    const existingGroup = svg.querySelector('g.tick-labels-group');
    if (existingGroup) {
      existingGroup.remove();
    }

  }

  function ensureSvg(containerEl) {
    let svg = containerEl.querySelector('svg[data-meter]');
    if (svg) return svg;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-meter', '');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', \\\`0 0 \\\${viewBox.width} \\\${viewBox.height}\\\`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.display = 'block';
    svg.style.verticalAlign = 'middle';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'meterGradient');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', String(viewBox.height / 2));
    gradient.setAttribute('x2', String(viewBox.width));
    gradient.setAttribute('y2', String(viewBox.height / 2));
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s1.setAttribute('offset', '0'); s1.setAttribute('stop-color', '#71cce2');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s2.setAttribute('offset', '1'); s2.setAttribute('stop-color', '#6e40a9');
    gradient.append(s1, s2);

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'iconShadow');
    const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    fe.setAttribute('dx', '0'); fe.setAttribute('dy', '2'); fe.setAttribute('stdDeviation', '3'); fe.setAttribute('flood-opacity', '0.3');
    filter.appendChild(fe);
    // Circle mask for icons (objectBoundingBox units to keep it centered)
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', 'maskIconCircle');
    mask.setAttribute('maskContentUnits', 'objectBoundingBox');
    mask.setAttribute('maskUnits', 'objectBoundingBox');
    const maskCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    maskCircle.setAttribute('cx', '0.5');
    maskCircle.setAttribute('cy', '0.5');
    maskCircle.setAttribute('r', '0.5');
    maskCircle.setAttribute('fill', '#fff');
    mask.appendChild(maskCircle);
    defs.append(gradient, filter, mask);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('data-arc', '');
    path.setAttribute('d', describeArc());
    path.setAttribute('fill', 'url(#meterGradient)');

    svg.append(defs, path);

    // ticks
    const tickCount = 11;
    const totalAngle = endAngle - startAngle;
    for (let i = 1; i < tickCount; i++) {
      const angle = startAngle + (totalAngle / tickCount) * i;
      const angleRad = toRadians(angle);
      const innerR = baseRadius - strokeWidth / 2;
      const outerR = baseRadius - strokeWidth / 2 + 10;
      const x1 = cx + innerR * Math.cos(angleRad);
      const y1 = cy + innerR * Math.sin(angleRad);
      const x2 = cx + outerR * Math.cos(angleRad);
      const y2 = cy + outerR * Math.sin(angleRad);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', '#fff'); line.setAttribute('stroke-width', '3');
      svg.appendChild(line);
    }

    containerEl.innerHTML = '';
    containerEl.appendChild(svg);
    return svg;
  }

  function updateMeter(values, options) {
    const icon = (options && options.icon !== undefined) ? options.icon : null; // Default to null instead of 'assets/icon.svg'
    const icons = (options && options.icons) || null; // per-index icons
    const connectedDeviceIndices = (options && options.connectedDeviceIndices) || null; // null means calculate from values (non-null indices)
    const actualValues = (options && options.actualValues) || null; // Actual values for display (not normalized)
    const unit = (options && options.unit) || '%'; // Unit for display
    const minValue = (options && typeof options.minValue === 'number') ? options.minValue : 0;
    const maxValue = (options && typeof options.maxValue === 'number') ? options.maxValue : 100;

    // Calculate device count from connected device indices
    let deviceCount = 0;
    if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
      deviceCount = connectedDeviceIndices.length;
    } else {
      // If null, count non-null values (including 0)
      deviceCount = values.filter(v => v !== null && v !== undefined && !isNaN(v)).length;
    }
    // If no devices connected, don't render anything (early return)
    if (deviceCount === 0) {
      // Remove all existing icons
      const containerEl = document.getElementById('meter-container');
      const svg = containerEl ? containerEl.querySelector('svg[data-meter]') : null;
      if (svg) {
        svg.querySelectorAll('g[data-perf]').forEach(g => g.remove());
      }
      return;
    }

    // Helper function to convert normalized value (0-100%) to actual value based on min/max settings
    function denormalizeValue(percentage) {
      const range = maxValue - minValue;
      if (range === 0) return minValue; // Avoid division by zero
      return minValue + (percentage / 100) * range;
    }

    const containerEl = document.getElementById('meter-container');
    const svg = ensureSvg(containerEl);

    const existing = new Map();
    svg.querySelectorAll('g[data-perf]').forEach(g => {
      existing.set(g.getAttribute('data-perf'), g);
    });

    values.slice(0, 6).forEach((val, index) => {
      // Skip if value is null (device not connected)
      if (val === null || val === undefined) {
        // Remove icon if it exists
        const existingG = svg.querySelector(\\\`g[data-perf="\\\${index}"]\\\`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      // Skip if this index should be hidden (when connectedDeviceIndices is specified)
      if (connectedDeviceIndices !== null && !connectedDeviceIndices.includes(index)) {
        // Remove icon if it exists
        const existingG = svg.querySelector(\\\`g[data-perf="\\\${index}"]\\\`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      // Map index to lane index based on connected device indices
      let laneIndex = 0;
      if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
        const positionInConnected = connectedDeviceIndices.indexOf(index);
        laneIndex = positionInConnected >= 0 ? positionInConnected : 0;
      } else {
        // If no connected device indices specified, use index directly (but limit to deviceCount)
        laneIndex = index % deviceCount;
      }

      const numericVal = Number(val);
      const safeVal = Number.isFinite(numericVal) ? numericVal : 0;
      const pos = calculateIconPosition(safeVal, laneIndex, deviceCount);

      let g = svg.querySelector(\\\`g[data-perf="\\\${index}"]\\\`);
      if (!g) {
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-perf', String(index));
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.style.willChange = 'transform';

        // Background user image (if provided), masked as circle
        const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        const bgHref = (icons && icons[index]) ? icons[index] : '';
        if (bgHref) {
          bgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', bgHref);
          bgImage.setAttribute('href', bgHref);
          bgImage.style.display = 'block';
        } else {
          bgImage.style.display = 'none';
        }
        bgImage.setAttribute('x', String(-25));
        bgImage.setAttribute('y', String(-25));
        bgImage.setAttribute('width', '50');
        bgImage.setAttribute('height', '50');
        bgImage.setAttribute('mask', 'url(#maskIconCircle)');

        // Foreground SVG icon (only if icon is provided)
        let fgImage = null;
        if (icon) {
          fgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          fgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
          fgImage.setAttribute('href', icon);
          fgImage.setAttribute('x', String(-25));
          fgImage.setAttribute('y', String(-25));
          fgImage.setAttribute('width', '50');
          fgImage.setAttribute('height', '50');
          fgImage.setAttribute('filter', 'url(#iconShadow)');
        }

        // Machine-readable attributes for UI parsing
        const displayValue = actualValues && actualValues[index] !== undefined
          ? actualValues[index]
          : denormalizeValue(safeVal);
        const roundedDisplay = Math.round(displayValue);
        g.setAttribute('data-percentage', String(Math.max(0, Math.min(100, safeVal))));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);

        // Append in order: background, foreground (if exists)
        if (fgImage) {
          g.append(bgImage, fgImage);
        } else {
          g.append(bgImage);
        }
        // Set initial transform (no animation on first paint)
        g.setAttribute('transform', \\\`translate(\\\${pos.x}, \\\${pos.y})\\\`);
        svg.appendChild(g);
      } else {
        // Remove any existing text element(legacy)
        const t = g.querySelector('text');
        if (t) {
          t.remove();
        }
        // Update machine-readable attributes
        const displayValue = actualValues && actualValues[index] !== undefined
          ? actualValues[index]
          : denormalizeValue(safeVal);
        const roundedDisplay = Math.round(displayValue);
        const clampedPercent = Math.max(0, Math.min(100, safeVal));
        g.setAttribute('data-percentage', String(clampedPercent));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);
        // Update background user icon and foreground SVG icon
        const imgs = g.querySelectorAll('image');
        // imgs[0] -> bg, imgs[1] -> fg (if exists)
        const bg = imgs[0];
        const fg = imgs.length >= 2 ? imgs[1] : null;

        if (bg) {
          const desiredBg = (icons && icons[index]) ? icons[index] : '';
          if (desiredBg) {
            if (bg.getAttribute('href') !== desiredBg) {
              bg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', desiredBg);
              bg.setAttribute('href', desiredBg);
            }
            bg.style.display = 'block';
          } else {
            // If no bg icon, clear href AND hide
            if (bg.getAttribute('href')) {
              bg.removeAttribute('href');
              bg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
            }
            bg.style.display = 'none';
          }
        }

        // Handle foreground icon
        if (icon) {
          // Icon should be shown
          if (fg) {
            // Update existing foreground icon
            if (fg.getAttribute('href') !== icon) {
              fg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
              fg.setAttribute('href', icon);
            }
          } else {
            // Create new foreground icon
            const newFg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            newFg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
            newFg.setAttribute('href', icon);
            newFg.setAttribute('x', String(-25));
            newFg.setAttribute('y', String(-25));
            newFg.setAttribute('width', '50');
            newFg.setAttribute('height', '50');
            newFg.setAttribute('filter', 'url(#iconShadow)');
            g.appendChild(newFg);
          }
        } else {
          // Icon should be hidden - remove foreground icon if it exists
          if (fg) {
            fg.remove();
          }
        }
        // Trigger transition by changing transform only
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.setAttribute('transform', \\\`translate(\\\${pos.x}, \\\${pos.y})\\\`);
      }
      existing.delete(String(index));
    });

    // Remove any extra stale groups
    existing.forEach((g) => g.remove());

    // Update tick labels with min/max values (after all other updates)
    updateTickLabels(svg, minValue, maxValue, unit);
  }

  function initMeter(containerEl) {
    ensureSvg(containerEl);
  }

  window.MeterRenderer = { initMeter, updateMeter };
})();

\`,
  "jsconfig.json": \`{
  "compilerOptions": {
    // Environment setup & latest features
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,

    // Bundler mode
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,

    // Best practices
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Some stricter flags (disabled by default)
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  }
}
\`,
  "overlay.html": \`<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LeverScope - Overlay</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <script>
      (function(d) {
        var config = { kitId: 'kaz6zgt', scriptTimeout: 3000, async: true },
        h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\\\bwf-loading\\\\b/g,"")+" wf-inactive";},config.scriptTimeout),
        tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";
        tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;
        tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};
        s.parentNode.insertBefore(tk,s)
      })(document);
    </script>
    <style>
      html,body{margin:0;padding:0;background:#00ff00;overflow:hidden} /* Green for chroma key */
      .overlay-root{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:#00ff00} /* Green for chroma key */
      .meter-only{width:100%;max-width:1920px;padding:120px;margin:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center} /* Increased padding to prevent icon clipping */
      #meter-container{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
      #meter-container svg{display:block;margin:0 auto}
      /* Optional safe padding for cropping */
      .pad{padding:0}
    </style>
</head>
<body>
  <div class="overlay-root">
    <div id="meter-container" class="meter-only"></div>
  </div>

  <script>window.USE_MVVM = true;</script>
  <script src="src/app/overlayApp.js"></script>
</body>
</html>


\`,
  "package-lock.json": \`{
  "name": "lever-scope",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "lever-scope",
      "version": "1.0.0",
      "license": "ISC",
      "dependencies": {
        "socket.io-client": "^4.7.5",
        "ws": "^8.18.3"
      },
      "bin": {
        "lever-scope": "start-app.js"
      },
      "devDependencies": {
        "pkg": "^5.8.1"
      }
    },
    "node_modules/@babel/generator": {
      "version": "7.18.2",
      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.18.2.tgz",
      "integrity": "sha512-W1lG5vUwFvfMd8HVXqdfbuG7RuaSrTCCD8cl8fP8wOivdbtbIg2Db3IWUcgvfxKbbn6ZBGYRW/Zk1MIwK49mgw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.18.2",
        "@jridgewell/gen-mapping": "^0.3.0",
        "jsesc": "^2.5.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-string-parser": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz",
      "integrity": "sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-identifier": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.28.5.tgz",
      "integrity": "sha512-qSs4ifwzKJSV39ucNjsvc6WVHs6b7S03sOh2OcHF9UHfVPqWWALUsNUVzhSBiItjRZoLHx7nIarVjqKVusUZ1Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/parser": {
      "version": "7.18.4",
      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.18.4.tgz",
      "integrity": "sha512-FDge0dFazETFcxGw/EXzOkN8uJp0PC7Qbm+Pe9T+av2zlBpOgunFHkQPPn+eRuClU73JF+98D531UgayY89tow==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "parser": "bin/babel-parser.js"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/types": {
      "version": "7.19.0",
      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.19.0.tgz",
      "integrity": "sha512-YuGopBq3ke25BVSiS6fgF49Ul9gH1x70Bcr6bqRLjWCkcX8Hre1/5+z+IiWOIerRMSSEfGZVB9z9kyq7wVs9YA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-string-parser": "^7.18.10",
        "@babel/helper-validator-identifier": "^7.18.6",
        "to-fast-properties": "^2.0.0"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.5.tgz",
      "integrity": "sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@socket.io/component-emitter": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@socket.io/component-emitter/-/component-emitter-3.1.2.tgz",
      "integrity": "sha512-9BCxFwvbGg/RsZK9tjXd8s4UcwR0MWeFQ1XEKIQVVvAGJyINdrqKMcTRyLoK8Rse1GjzLV9cwjWV1olXRWEXVA==",
      "license": "MIT"
    },
    "node_modules/agent-base": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/agent-base/-/agent-base-6.0.2.tgz",
      "integrity": "sha512-RZNwNclF7+MS/8bDg70amg32dyeZGZxiDuQmZxKLAlQjr3jGyLx+4Kkk58UO7D2QdgFIQCovuSuZESne6RG6XQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "debug": "4"
      },
      "engines": {
        "node": ">= 6.0.0"
      }
    },
    "node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
      "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/array-union": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/array-union/-/array-union-2.1.0.tgz",
      "integrity": "sha512-HGyxoOTYUyCM6stUe6EJgnd4EoewAI7zMdfqO+kGjnlZmBDz/cR5pf8r/cR4Wq60sL/p0IkcjUEEPwS3GFrIyw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/at-least-node": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/at-least-node/-/at-least-node-1.0.0.tgz",
      "integrity": "sha512-+q/t7Ekv1EDY2l6Gda6LLiX14rU9TV20Wa3ofeQmwPFZbOMo9DXrLbOjFaaclkXKWidIaopwAObQDqwWtGUjqg==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">= 4.0.0"
      }
    },
    "node_modules/base64-js": {
      "version": "1.5.1",
      "resolved": "https://registry.npmjs.org/base64-js/-/base64-js-1.5.1.tgz",
      "integrity": "sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/bl": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/bl/-/bl-4.1.0.tgz",
      "integrity": "sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "buffer": "^5.5.0",
        "inherits": "^2.0.4",
        "readable-stream": "^3.4.0"
      }
    },
    "node_modules/bl/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/buffer": {
      "version": "5.7.1",
      "resolved": "https://registry.npmjs.org/buffer/-/buffer-5.7.1.tgz",
      "integrity": "sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "base64-js": "^1.3.1",
        "ieee754": "^1.1.13"
      }
    },
    "node_modules/chalk": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.1.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/chalk?sponsor=1"
      }
    },
    "node_modules/chownr": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/chownr/-/chownr-1.1.4.tgz",
      "integrity": "sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/cliui": {
      "version": "7.0.4",
      "resolved": "https://registry.npmjs.org/cliui/-/cliui-7.0.4.tgz",
      "integrity": "sha512-OcRE68cOsVMXp1Yvonl/fzkQOyjLSu/8bhPDfQt0e0/Eb283TKP20Fs2MqoPsr9SwA595rRCA+QMzYc9nBP+JQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "string-width": "^4.2.0",
        "strip-ansi": "^6.0.0",
        "wrap-ansi": "^7.0.0"
      }
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
      "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
      "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/core-util-is": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/core-util-is/-/core-util-is-1.0.3.tgz",
      "integrity": "sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/debug": {
      "version": "4.3.7",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.3.7.tgz",
      "integrity": "sha512-Er2nc/H7RrMXZBFCEim6TCmMk02Z8vLC2Rbi1KEBggpo0fS6l0S1nnapwmIi3yW/+GOJap1Krg4w0Hg80oCqgQ==",
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/decompress-response": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/decompress-response/-/decompress-response-6.0.0.tgz",
      "integrity": "sha512-aW35yZM6Bb/4oJlZncMH2LCoZtJXTRxES17vE3hoRiowU2kWHaJKFkSBDnDR+cm9J+9QhXmREyIfv0pji9ejCQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "mimic-response": "^3.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/deep-extend": {
      "version": "0.6.0",
      "resolved": "https://registry.npmjs.org/deep-extend/-/deep-extend-0.6.0.tgz",
      "integrity": "sha512-LOHxIOaPYdHlJRtCQfDIVZtfw/ufM8+rVj649RIHzcm/vGwQRXFt6OPqIFWsm2XEMrNIEtWR64sY1LEKD2vAOA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4.0.0"
      }
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/dir-glob": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/dir-glob/-/dir-glob-3.0.1.tgz",
      "integrity": "sha512-WkrWp9GR4KXfKGYzOLmTuGVi1UWFfws377n9cc55/tb6DuqyF6pcQ5AbiHEshaDpY9v6oaSr2XCDidGmMwdzIA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-type": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/end-of-stream": {
      "version": "1.4.5",
      "resolved": "https://registry.npmjs.org/end-of-stream/-/end-of-stream-1.4.5.tgz",
      "integrity": "sha512-ooEGc6HP26xXq/N+GCGOT0JKCLDGrq2bQUZrQ7gyrJiZANJ/8YDTxTpQBXGMn+WbIQXNVpyWymm7KYVICQnyOg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "once": "^1.4.0"
      }
    },
    "node_modules/engine.io-client": {
      "version": "6.6.3",
      "resolved": "https://registry.npmjs.org/engine.io-client/-/engine.io-client-6.6.3.tgz",
      "integrity": "sha512-T0iLjnyNWahNyv/lcjS2y4oE358tVS/SYQNxYXGAJ9/GLgH4VCvOQ/mhTjqU88mLZCQgiG8RIegFHYCdVC+j5w==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.1",
        "engine.io-parser": "~5.2.1",
        "ws": "~8.17.1",
        "xmlhttprequest-ssl": "~2.1.1"
      }
    },
    "node_modules/engine.io-client/node_modules/ws": {
      "version": "8.17.1",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.17.1.tgz",
      "integrity": "sha512-6XQFvXTkbfUOZOKKILFG1PDK2NDQs4azKQl26T0YS5CxqWLgXajbPZ+h4gZekJyRqFU8pvnbAbbs/3TgRPy+GQ==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    },
    "node_modules/engine.io-parser": {
      "version": "5.2.3",
      "resolved": "https://registry.npmjs.org/engine.io-parser/-/engine.io-parser-5.2.3.tgz",
      "integrity": "sha512-HqD3yTBfnBxIrbnM1DoD6Pcq8NECnh8d4As1Qgh0z5Gg3jRRIqijury0CL3ghu/edArpUYiYqQiDUQBIs4np3Q==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/expand-template": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/expand-template/-/expand-template-2.0.3.tgz",
      "integrity": "sha512-XYfuKMvj4O35f/pOXLObndIRvyQ+/+6AhODh+OKWj9S9498pHHn/IMszH+gt0fBCRWMNfk1ZSp5x3AifmnI2vg==",
      "dev": true,
      "license": "(MIT OR WTFPL)",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fast-glob": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.3.tgz",
      "integrity": "sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fastq": {
      "version": "1.19.1",
      "resolved": "https://registry.npmjs.org/fastq/-/fastq-1.19.1.tgz",
      "integrity": "sha512-GwLTyxkCXjXbxqIhTsMI2Nui8huMPtnxg7krajPJAjnEG/iiOS7i+zCtWGZR9G0NBKbXKh6X9m9UIsYX/N6vvQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/from2": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/from2/-/from2-2.3.0.tgz",
      "integrity": "sha512-OMcX/4IC/uqEPVgGeyfN22LJk6AZrMkRZHxcHBMBvHScDGgwTm2GT2Wkgtocyd3JfZffjj2kYUDXXII0Fk9W0g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.1",
        "readable-stream": "^2.0.0"
      }
    },
    "node_modules/fs-constants": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/fs-constants/-/fs-constants-1.0.0.tgz",
      "integrity": "sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fs-extra": {
      "version": "9.1.0",
      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-9.1.0.tgz",
      "integrity": "sha512-hcg3ZmepS30/7BSFqRvoo3DOMQu7IjqxO5nCDt+zM9XWjb33Wg7ziNT+Qvqbuc3+gWpzO02JubVyk2G4Zvo1OQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "at-least-node": "^1.0.0",
        "graceful-fs": "^4.2.0",
        "jsonfile": "^6.0.1",
        "universalify": "^2.0.0"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
      "integrity": "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-caller-file": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/get-caller-file/-/get-caller-file-2.0.5.tgz",
      "integrity": "sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": "6.* || 8.* || >= 10.*"
      }
    },
    "node_modules/github-from-package": {
      "version": "0.0.0",
      "resolved": "https://registry.npmjs.org/github-from-package/-/github-from-package-0.0.0.tgz",
      "integrity": "sha512-SyHy3T1v2NUXn29OsWdxmK6RwHD+vkj3v8en8AOBZ1wBQ/hCAQ5bAQTD02kW4W9tUp/3Qh6J8r9EvntiyCmOOw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/globby": {
      "version": "11.1.0",
      "resolved": "https://registry.npmjs.org/globby/-/globby-11.1.0.tgz",
      "integrity": "sha512-jhIXaOzy1sb8IyocaruWSn1TjmnBVs8Ayhcy83rmxNJ8q2uWKCAj3CnJY+KpGSXCueAPc0i05kVvVKtP1t9S3g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-union": "^2.1.0",
        "dir-glob": "^3.0.1",
        "fast-glob": "^3.2.9",
        "ignore": "^5.2.0",
        "merge2": "^1.4.1",
        "slash": "^3.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
      "integrity": "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/has": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/has/-/has-1.0.4.tgz",
      "integrity": "sha512-qdSAmqLF6209RFj4VVItywPMbm3vWylknmB3nvNiUIs72xAimcM8nVYxYr7ncvZq5qzk9MKIZR8ijqD/1QuYjQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4.0"
      }
    },
    "node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.2.tgz",
      "integrity": "sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/https-proxy-agent": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/https-proxy-agent/-/https-proxy-agent-5.0.1.tgz",
      "integrity": "sha512-dFcAjpTQFgoLMzC2VwU+C/CbS7uRL0lWmxDITmqm7C+7F0Odmj6s9l6alZc6AELXhrnggM2CeWSXHGOdX2YtwA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "agent-base": "6",
        "debug": "4"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/ieee754": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/ieee754/-/ieee754-1.2.1.tgz",
      "integrity": "sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz",
      "integrity": "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/inherits": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
      "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/ini": {
      "version": "1.3.8",
      "resolved": "https://registry.npmjs.org/ini/-/ini-1.3.8.tgz",
      "integrity": "sha512-JV/yugV2uzW5iMRSiZAyDtQd+nxtUnjeLt0acNdw98kKLrvuRVyB80tsREOE7yvGVgalhZ6RNXCmEHkUKBKxew==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/into-stream": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/into-stream/-/into-stream-6.0.0.tgz",
      "integrity": "sha512-XHbaOAvP+uFKUFsOgoNPRjLkwB+I22JFPFe5OjTkQ0nwgj6+pSjb4NmB6VMxaPshLiOf+zcpOCBQuLwC1KHhZA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "from2": "^2.3.0",
        "p-is-promise": "^3.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.9.0",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.9.0.tgz",
      "integrity": "sha512-+5FPy5PnwmO3lvfMb0AsoPaBG+5KHUI0wYFXOtYPnVVVspTFUuMZNfNaNVRt3FZadstu2c8x23vykRW/NBoU6A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has": "^1.0.3"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-fullwidth-code-point": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz",
      "integrity": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/isarray": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/isarray/-/isarray-1.0.0.tgz",
      "integrity": "sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/jsesc": {
      "version": "2.5.2",
      "resolved": "https://registry.npmjs.org/jsesc/-/jsesc-2.5.2.tgz",
      "integrity": "sha512-OYu7XEzjkCQ3C5Ps3QIZsQfNpqoJyZZA99wd9aWd05NCtC5pWOkShK2mkL6HXQR6/Cy2lbNdPlZBpuQHXE63gA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jsesc": "bin/jsesc"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/jsonfile": {
      "version": "6.2.0",
      "resolved": "https://registry.npmjs.org/jsonfile/-/jsonfile-6.2.0.tgz",
      "integrity": "sha512-FGuPw30AdOIUTRMC2OMRtQV+jkVj2cfPqSeWXv1NEAJ1qZ5zb1X6z1mFhbfOB/iy3ssJCD+3KuZ8r8C3uVFlAg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "universalify": "^2.0.0"
      },
      "optionalDependencies": {
        "graceful-fs": "^4.1.6"
      }
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "resolved": "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz",
      "integrity": "sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/mimic-response": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/mimic-response/-/mimic-response-3.1.0.tgz",
      "integrity": "sha512-z0yWI+4FDrrweS8Zmt4Ej5HdJmky15+L2e6Wgn3+iK5fWzb6T3fhNFq2+MeTRb064c6Wr4N/wv0DzQTjNzHNGQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/minimist/-/minimist-1.2.8.tgz",
      "integrity": "sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/mkdirp-classic": {
      "version": "0.5.3",
      "resolved": "https://registry.npmjs.org/mkdirp-classic/-/mkdirp-classic-0.5.3.tgz",
      "integrity": "sha512-gKLcREMhtuZRwRAfqP3RFW+TK4JqApVBtOIftVgjuABpAtpxhPGaDcfvbhNvD0B8iD1oUr/txX35NjcaY6Ns/A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "license": "MIT"
    },
    "node_modules/multistream": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/multistream/-/multistream-4.1.0.tgz",
      "integrity": "sha512-J1XDiAmmNpRCBfIWJv+n0ymC4ABcf/Pl+5YvC5B/D2f/2+8PtHvCNxMPKiQcZyi922Hq69J2YOpb1pTywfifyw==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "once": "^1.4.0",
        "readable-stream": "^3.6.0"
      }
    },
    "node_modules/multistream/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/napi-build-utils": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/napi-build-utils/-/napi-build-utils-1.0.2.tgz",
      "integrity": "sha512-ONmRUqK7zj7DWX0D9ADe03wbwOBZxNAfF20PlGfCWQcD3+/MakShIHrMqx9YwPTfxDdF1zLeL+RGZiR9kGMLdg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/node-abi": {
      "version": "3.85.0",
      "resolved": "https://registry.npmjs.org/node-abi/-/node-abi-3.85.0.tgz",
      "integrity": "sha512-zsFhmbkAzwhTft6nd3VxcG0cvJsT70rL+BIGHWVq5fi6MwGrHwzqKaxXE+Hl2GmnGItnDKPPkO5/LQqjVkIdFg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "semver": "^7.3.5"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/node-fetch": {
      "version": "2.7.0",
      "resolved": "https://registry.npmjs.org/node-fetch/-/node-fetch-2.7.0.tgz",
      "integrity": "sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "whatwg-url": "^5.0.0"
      },
      "engines": {
        "node": "4.x || >=6.0.0"
      },
      "peerDependencies": {
        "encoding": "^0.1.0"
      },
      "peerDependenciesMeta": {
        "encoding": {
          "optional": true
        }
      }
    },
    "node_modules/once": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
      "integrity": "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "wrappy": "1"
      }
    },
    "node_modules/p-is-promise": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/p-is-promise/-/p-is-promise-3.0.0.tgz",
      "integrity": "sha512-Wo8VsW4IRQSKVXsJCn7TomUaVtyfjVDn3nUP7kE967BQk0CwFpdbZs0X0uk5sW9mkBa9eNM7hCMaG93WUAwxYQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/path-parse/-/path-parse-1.0.7.tgz",
      "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/path-type": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-type/-/path-type-4.0.0.tgz",
      "integrity": "sha512-gDKb8aZMDeD/tZWs9P6+q0J9Mwkdl6xMV8TjnGP3qJVJ06bdMgkbBlLU8IdfOsIsFz2BW1rNVT3XuNEl8zPAvw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/picomatch": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.1.tgz",
      "integrity": "sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pkg": {
      "version": "5.8.1",
      "resolved": "https://registry.npmjs.org/pkg/-/pkg-5.8.1.tgz",
      "integrity": "sha512-CjBWtFStCfIiT4Bde9QpJy0KeH19jCfwZRJqHFDFXfhUklCx8JoFmMj3wgnEYIwGmZVNkhsStPHEOnrtrQhEXA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/generator": "7.18.2",
        "@babel/parser": "7.18.4",
        "@babel/types": "7.19.0",
        "chalk": "^4.1.2",
        "fs-extra": "^9.1.0",
        "globby": "^11.1.0",
        "into-stream": "^6.0.0",
        "is-core-module": "2.9.0",
        "minimist": "^1.2.6",
        "multistream": "^4.1.0",
        "pkg-fetch": "3.4.2",
        "prebuild-install": "7.1.1",
        "resolve": "^1.22.0",
        "stream-meter": "^1.0.4"
      },
      "bin": {
        "pkg": "lib-es5/bin.js"
      },
      "peerDependencies": {
        "node-notifier": ">=9.0.1"
      },
      "peerDependenciesMeta": {
        "node-notifier": {
          "optional": true
        }
      }
    },
    "node_modules/pkg-fetch": {
      "version": "3.4.2",
      "resolved": "https://registry.npmjs.org/pkg-fetch/-/pkg-fetch-3.4.2.tgz",
      "integrity": "sha512-0+uijmzYcnhC0hStDjm/cl2VYdrmVVBpe7Q8k9YBojxmR5tG8mvR9/nooQq3QSXiQqORDVOTY3XqMEqJVIzkHA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chalk": "^4.1.2",
        "fs-extra": "^9.1.0",
        "https-proxy-agent": "^5.0.0",
        "node-fetch": "^2.6.6",
        "progress": "^2.0.3",
        "semver": "^7.3.5",
        "tar-fs": "^2.1.1",
        "yargs": "^16.2.0"
      },
      "bin": {
        "pkg-fetch": "lib-es5/bin.js"
      }
    },
    "node_modules/prebuild-install": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/prebuild-install/-/prebuild-install-7.1.1.tgz",
      "integrity": "sha512-jAXscXWMcCK8GgCoHOfIr0ODh5ai8mj63L2nWrjuAgXE6tDyYGnx4/8o/rCgU+B4JSyZBKbeZqzhtwtC3ovxjw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "detect-libc": "^2.0.0",
        "expand-template": "^2.0.3",
        "github-from-package": "0.0.0",
        "minimist": "^1.2.3",
        "mkdirp-classic": "^0.5.3",
        "napi-build-utils": "^1.0.1",
        "node-abi": "^3.3.0",
        "pump": "^3.0.0",
        "rc": "^1.2.7",
        "simple-get": "^4.0.0",
        "tar-fs": "^2.0.0",
        "tunnel-agent": "^0.6.0"
      },
      "bin": {
        "prebuild-install": "bin.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/process-nextick-args": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/process-nextick-args/-/process-nextick-args-2.0.1.tgz",
      "integrity": "sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/progress": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/progress/-/progress-2.0.3.tgz",
      "integrity": "sha512-7PiHtLll5LdnKIMw100I+8xJXR5gW2QwWYkT6iJva0bXitZKa/XMrSbdmg3r2Xnaidz9Qumd0VPaMrZlF9V9sA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/pump": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/pump/-/pump-3.0.3.tgz",
      "integrity": "sha512-todwxLMY7/heScKmntwQG8CXVkWUOdYxIvY2s0VWAAMh/nd8SoYiRaKjlr7+iCs984f2P8zvrfWcDDYVb73NfA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "end-of-stream": "^1.1.0",
        "once": "^1.3.1"
      }
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/rc": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/rc/-/rc-1.2.8.tgz",
      "integrity": "sha512-y3bGgqKj3QBdxLbLkomlohkvsA8gdAiUQlSBJnBhfn+BPxg4bc62d8TcBW15wavDfgexCgccckhcZvywyQYPOw==",
      "dev": true,
      "license": "(BSD-2-Clause OR MIT OR Apache-2.0)",
      "dependencies": {
        "deep-extend": "^0.6.0",
        "ini": "~1.3.0",
        "minimist": "^1.2.0",
        "strip-json-comments": "~2.0.1"
      },
      "bin": {
        "rc": "cli.js"
      }
    },
    "node_modules/readable-stream": {
      "version": "2.3.8",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-2.3.8.tgz",
      "integrity": "sha512-8p0AUk4XODgIewSi0l8Epjs+EVnWiK7NoDIEGU0HhE7+ZyY8D1IMY7odu5lRrFXGg71L15KG8QrPmum45RTtdA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "core-util-is": "~1.0.0",
        "inherits": "~2.0.3",
        "isarray": "~1.0.0",
        "process-nextick-args": "~2.0.0",
        "safe-buffer": "~5.1.1",
        "string_decoder": "~1.1.1",
        "util-deprecate": "~1.0.1"
      }
    },
    "node_modules/require-directory": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz",
      "integrity": "sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.11",
      "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.22.11.tgz",
      "integrity": "sha512-RfqAvLnMl313r7c9oclB1HhUEAezcpLjz95wFH4LVuhk9JF/r22qmVP9AMmOU4vMX7Q8pN8jwNg/CSpdFnMjTQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve/node_modules/is-core-module": {
      "version": "2.16.1",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.16.1.tgz",
      "integrity": "sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/reusify/-/reusify-1.1.0.tgz",
      "integrity": "sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/run-parallel/-/run-parallel-1.2.0.tgz",
      "integrity": "sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/safe-buffer": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.1.2.tgz",
      "integrity": "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "7.7.3",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.7.3.tgz",
      "integrity": "sha512-SdsKMrI9TdgjdweUSR9MweHA4EJ8YxHn8DFaDisvhVlUOe4BF1tLD7GAj0lIqWVl+dPb/rExr0Btby5loQm20Q==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/simple-concat": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/simple-concat/-/simple-concat-1.0.1.tgz",
      "integrity": "sha512-cSFtAPtRhljv69IK0hTVZQ+OfE9nePi/rtJmw5UjHeVyVroEqJXP1sFztKUy1qU+xvz3u/sfYJLa947b7nAN2Q==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/simple-get": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/simple-get/-/simple-get-4.0.1.tgz",
      "integrity": "sha512-brv7p5WgH0jmQJr1ZDDfKDOSeWWg+OVypG99A/5vYGPqJ6pxiaHLy8nxtFjBA7oMa01ebA9gfh1uMCFqOuXxvA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "decompress-response": "^6.0.0",
        "once": "^1.3.1",
        "simple-concat": "^1.0.0"
      }
    },
    "node_modules/slash": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/slash/-/slash-3.0.0.tgz",
      "integrity": "sha512-g9Q1haeby36OSStwb4ntCGGGaKsaVSjQ68fBxoQcutl5fS1vuY18H3wSt3jFyFtrkx+Kz0V1G85A4MyAdDMi2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/socket.io-client": {
      "version": "4.8.1",
      "resolved": "https://registry.npmjs.org/socket.io-client/-/socket.io-client-4.8.1.tgz",
      "integrity": "sha512-hJVXfu3E28NmzGk8o1sHhN3om52tRvwYeidbj7xKy2eIIse5IoKX3USlS6Tqt3BHAtflLIkCQBkzVrEEfWUyYQ==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.2",
        "engine.io-client": "~6.6.1",
        "socket.io-parser": "~4.2.4"
      },
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/socket.io-parser": {
      "version": "4.2.4",
      "resolved": "https://registry.npmjs.org/socket.io-parser/-/socket.io-parser-4.2.4.tgz",
      "integrity": "sha512-/GbIKmo8ioc+NIWIhwdecY0ge+qVBSMdgxGygevmdHj24bsfgtCmcUUcQ5ZzcylGFHsN3k4HB4Cgkl96KVnuew==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.1"
      },
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/stream-meter": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/stream-meter/-/stream-meter-1.0.4.tgz",
      "integrity": "sha512-4sOEtrbgFotXwnEuzzsQBYEV1elAeFSO8rSGeTwabuX1RRn/kEq9JVH7I0MRBhKVRR0sJkr0M0QCH7yOLf9fhQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "readable-stream": "^2.1.4"
      }
    },
    "node_modules/string_decoder": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/string_decoder/-/string_decoder-1.1.1.tgz",
      "integrity": "sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "safe-buffer": "~5.1.0"
      }
    },
    "node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-json-comments": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-2.0.1.tgz",
      "integrity": "sha512-4gB8na07fecVVkOI6Rs4e7T6NOTki5EmL7TUduTs6bu3EdnSycntVJ4re8kgZA+wx9IueI2Y11bfbgwtzuE0KQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/supports-color": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
      "integrity": "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/supports-preserve-symlinks-flag/-/supports-preserve-symlinks-flag-1.0.0.tgz",
      "integrity": "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tar-fs": {
      "version": "2.1.4",
      "resolved": "https://registry.npmjs.org/tar-fs/-/tar-fs-2.1.4.tgz",
      "integrity": "sha512-mDAjwmZdh7LTT6pNleZ05Yt65HC3E+NiQzl672vQG38jIrehtJk/J3mNwIg+vShQPcLF/LV7CMnDW6vjj6sfYQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chownr": "^1.1.1",
        "mkdirp-classic": "^0.5.2",
        "pump": "^3.0.0",
        "tar-stream": "^2.1.4"
      }
    },
    "node_modules/tar-stream": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/tar-stream/-/tar-stream-2.2.0.tgz",
      "integrity": "sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "bl": "^4.0.3",
        "end-of-stream": "^1.4.1",
        "fs-constants": "^1.0.0",
        "inherits": "^2.0.3",
        "readable-stream": "^3.1.1"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/tar-stream/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/to-fast-properties": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/to-fast-properties/-/to-fast-properties-2.0.0.tgz",
      "integrity": "sha512-/OaKK0xYrs3DmxRYqL/yDc+FxFUVYhDlXMhRmv3z915w2HF1tnN1omB354j8VUGO/hbRzyD6Y3sA7v7GS/ceog==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/tr46": {
      "version": "0.0.3",
      "resolved": "https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz",
      "integrity": "sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/tunnel-agent": {
      "version": "0.6.0",
      "resolved": "https://registry.npmjs.org/tunnel-agent/-/tunnel-agent-0.6.0.tgz",
      "integrity": "sha512-McnNiV1l8RYeY8tBgEpuodCC1mLUdbSN+CYBL7kJsJNInOP8UjDDEwdk6Mw60vdLLrr5NHKZhMAOSrR2NZuQ+w==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "safe-buffer": "^5.0.1"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/universalify": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/universalify/-/universalify-2.0.1.tgz",
      "integrity": "sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlRUtConJRlvaw6DuX0wO5Jeko9sWrMBhh+PsYAZ7oXAiOnf/UKogyiw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 10.0.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
      "integrity": "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/webidl-conversions": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-3.0.1.tgz",
      "integrity": "sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==",
      "dev": true,
      "license": "BSD-2-Clause"
    },
    "node_modules/whatwg-url": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/whatwg-url/-/whatwg-url-5.0.0.tgz",
      "integrity": "sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "tr46": "~0.0.3",
        "webidl-conversions": "^3.0.0"
      }
    },
    "node_modules/wrap-ansi": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-7.0.0.tgz",
      "integrity": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.0.0",
        "string-width": "^4.1.0",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/wrap-ansi?sponsor=1"
      }
    },
    "node_modules/wrappy": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz",
      "integrity": "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/ws": {
      "version": "8.18.3",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.18.3.tgz",
      "integrity": "sha512-PEIGCY5tSlUt50cqyMXfCzX+oOPqN0vuGqWzbcJ2xvnkzkq46oOpz7dQaTDBdfICb4N14+GARUDw2XV2N4tvzg==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    },
    "node_modules/xmlhttprequest-ssl": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/xmlhttprequest-ssl/-/xmlhttprequest-ssl-2.1.2.tgz",
      "integrity": "sha512-TEU+nJVUUnA4CYJFLvK5X9AOeH4KvDvhIfm0vV1GaQRtchnG0hgK5p8hw/xjv8cunWYCsiPCSDzObPyhEwq3KQ==",
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/y18n": {
      "version": "5.0.8",
      "resolved": "https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz",
      "integrity": "sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yargs": {
      "version": "16.2.0",
      "resolved": "https://registry.npmjs.org/yargs/-/yargs-16.2.0.tgz",
      "integrity": "sha512-D1mvvtDG0L5ft/jGWkLpG1+m0eQxOfaBvTNELraWj22wSVUMWxZUvYgJYcKh6jGGIkJFhH4IZPQhR4TKpc8mBw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cliui": "^7.0.2",
        "escalade": "^3.1.1",
        "get-caller-file": "^2.0.5",
        "require-directory": "^2.1.1",
        "string-width": "^4.2.0",
        "y18n": "^5.0.5",
        "yargs-parser": "^20.2.2"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yargs-parser": {
      "version": "20.2.9",
      "resolved": "https://registry.npmjs.org/yargs-parser/-/yargs-parser-20.2.9.tgz",
      "integrity": "sha512-y11nGElTIV+CT3Zv9t7VKl+Q3hTQoT9a1Qzezhhl6Rp21gJ/IVTW7Z3y9EWXhuUBC2Shnf+DX0antecpAwSP8w==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    }
  }
}
\`,
  "package.json": \`{
  "name": "lever-scope",
  "version": "1.0.0",
  "description": "レバー位置可視化アプリケーション",
  "main": "integrated-server.js",
  "bin": "integrated-server.js",
  "scripts": {
    "test": "echo \\\\"Error: no test specified\\\\" && exit 1",
    "start": "node integrated-server.js",
    "build": "npm run build:win && npm run build:mac",
    "build:win": "bun build ./integrated-server.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverVisualizer.exe",
    "build:mac": "bun build ./integrated-server.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverVisualizer",

    "build:servers": "npm run build:http && npm run build:bridge",
    "bundle-static": "node ./bundle-static.js",

    "build:http": "npm run bundle-static && npm run build:http:win && npm run build:http:mac",
    "build:http:win": "bun build ./http-server-bundled.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverHTTP.exe",
    "build:http:mac": "bun build ./http-server-bundled.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverHTTP",

    "build:http:nobundle": "npm run build:http:nobundle:win && npm run build:http:nobundle:mac",
    "build:http:nobundle:win": "bun build ./http-server.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverHTTP.exe",
    "build:http:nobundle:mac": "bun build ./http-server.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverHTTP",

    "build:bridge": "npm run build:bridge:win && npm run build:bridge:mac",
    "build:bridge:win": "bun build ./bridge-server.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverBridge.exe",
    "build:bridge:mac": "bun build ./bridge-server.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverBridge",

    "build:api": "npm run build:api:win && npm run build:api:mac",
    "build:api:win": "cd ../LeverAPI && python -m PyInstaller --onefile --collect-submodules=dns --collect-submodules=eventlet --hidden-import=engineio.async_drivers.eventlet --hidden-import=api.discovery --hidden-import=api.device_manager --hidden-import=api.transformers --hidden-import=api.cache --name LeverAPI app.py && copy /Y dist\\\\\\\\LeverAPI.exe ..\\\\\\\\app\\\\\\\\Windows\\\\\\\\",
    "build:api:mac": "cd ../LeverAPI && python3 -m PyInstaller --onefile --collect-submodules=dns --collect-submodules=eventlet --hidden-import=engineio.async_drivers.eventlet --hidden-import=api.discovery --hidden-import=api.device_manager --hidden-import=api.transformers --hidden-import=api.cache --name LeverAPI app.py && cp dist/LeverAPI ../app/macOS/",
    "build:all": "npm run build && npm run build:servers && npm run build:api",
    "build:all:win": "npm run build:win && npm run build:http:win && npm run build:bridge:win && npm run build:api:win",
    "build:all:mac": "npm run build:mac && npm run build:http:mac && npm run build:bridge:mac && npm run build:api:mac"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/notMelonBread/positionVisualizer.git"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "bugs": {
    "url": "https://github.com/notMelonBread/positionVisualizer/issues"
  },
  "homepage": "https://github.com/notMelonBread/positionVisualizer#readme",
  "dependencies": {
    "ws": "^8.18.3",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "private": true,
  "peerDependencies": {
    "typescript": "^5"
  }
}
\`,
  "src/app/main.js": \`/**
 * main.js - Application Entry Point
 * メインページのエントリーポイント
 */
(function() {
  'use strict';

  /**
   * スクリプトを動的に読み込む
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (src.includes('meterRenderer.js') && window.MeterRenderer) {
        resolve();
        return;
      }
      if (src.includes('iconRenderer.js') && window.IconRenderer) {
        resolve();
        return;
      }
      if (src.includes('event.js') && window.MVVM && window.MVVM.Emitter) {
        resolve();
        return;
      }
      if (src.includes('model.js') && window.MVVM && window.MVVM.MeterState) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      const cacheBuster = '?v=' + Date.now();
      script.src = src + cacheBuster;
      script.onload = resolve;
      script.onerror = () => {
        console.error('Failed to load script:', src);
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Domain Layerを読み込む
   */
  async function loadDomainLayer() {
    const domainScripts = [
      'src/domain/ValueRange.js',
      'src/domain/DeviceConfig.js',
      'src/domain/DeviceState.js',
      'src/domain/SessionLog.js',
      'src/domain/LogEntry.js'
    ];

    for (const src of domainScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Infra Layerを読み込む
   */
  async function loadInfraLayer() {
    const infraScripts = [
      'src/infra/repositories/DeviceStateRepository.js',
      'src/infra/repositories/ValueRangeRepository.js',
      'src/infra/repositories/DeviceConfigRepository.js',
      'src/infra/repositories/SessionLogRepository.js',
      'src/infra/bridge/WebSocketBridgeClient.js',
      'src/infra/bridge/HttpPollingClient.js',
      'src/infra/storage/LogFileStorage.js',
      'src/infra/storage/SettingsStorage.js',
      'src/infra/sync/OverlayChannel.js'
    ];

    for (const src of infraScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * UseCase Layerを読み込む
   */
  async function loadUseCaseLayer() {
    const useCaseScripts = [
      'src/usecases/LiveMonitorService.js',
      'src/usecases/RecordingService.js',
      'src/usecases/ReplayService.js',
      'src/usecases/SettingsService.js',
      'src/usecases/IconService.js'
    ];

    for (const src of useCaseScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Presentation Layerを読み込む
   */
  async function loadPresentationLayer() {
    // Legacy MVVM modules (for compatibility)
    const legacyScripts = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/views/meterRenderer.js',
      'js/views/iconRenderer.js'
    ];

    for (const src of legacyScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // New Presentation Layer
    const presentationScripts = [
      'src/presentation/viewmodels/MainPageViewModel.js',
      'src/presentation/bindings/MainPageBindings.js'
    ];

    for (const src of presentationScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * アプリケーションを初期化
   */
  async function initApp() {
    try {
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
      }

      // Load all layers in order
      await loadDomainLayer();
      await loadInfraLayer();
      await loadUseCaseLayer();
      await loadPresentationLayer();

      // Verify required modules
      if (!window.ValueRange || !window.DeviceConfig || !window.DeviceState || 
          !window.SessionLog || !window.LogEntry) {
        throw new Error('Domain Layer modules failed to load');
      }

      if (!window.DeviceStateRepository || !window.ValueRangeRepository || 
          !window.DeviceConfigRepository || !window.SessionLogRepository) {
        throw new Error('Infra Layer repositories failed to load');
      }

      if (!window.LogFileStorage || !window.SettingsStorage) {
        throw new Error('Infra Layer storage failed to load');
      }

      if (!window.LiveMonitorService || !window.RecordingService || 
          !window.ReplayService || !window.SettingsService || !window.IconService) {
        throw new Error('UseCase Layer services failed to load');
      }

      if (!window.MainPageViewModel || !window.MainPageBindings) {
        throw new Error('Presentation Layer modules failed to load');
      }

      // Initialize repositories (Infra Layer)
      const deviceStateRepository = new window.DeviceStateRepository();
      const valueRangeRepository = new window.ValueRangeRepository(0, 100, '%');
      const deviceConfigRepository = new window.DeviceConfigRepository();
      const sessionLogRepository = new window.SessionLogRepository();

      // Initialize storage (Infra Layer)
      const logFileStorage = new window.LogFileStorage();
      const settingsStorage = new window.SettingsStorage();

      // Initialize clients (Infra Layer)
      const webSocketClient = new window.WebSocketBridgeClient();
      const overlayChannel = new window.OverlayChannel();

      // Initialize UseCase services
      const liveMonitorService = new window.LiveMonitorService(deviceStateRepository, valueRangeRepository);
      const recordingService = new window.RecordingService(sessionLogRepository, logFileStorage);
      const replayService = new window.ReplayService(logFileStorage, deviceStateRepository);
      const settingsService = new window.SettingsService(valueRangeRepository);
      const iconService = new window.IconService(deviceConfigRepository);

      // Initialize initial state from DOM
      const initialNames = [];
      for (let i = 1; i <= 6; i++) {
        const el = document.getElementById(\\\`device\\\${i}-name\\\`);
        initialNames.push(el ? (el.value || '') : '');
      }

      // Create initial MeterState (legacy compatibility)
      const MeterState = window.MVVM && window.MVVM.MeterState;
      const initial = new MeterState(
        [],
        initialNames,
        null
      );

      // Initialize ViewModel (Presentation Layer)
      const viewModel = new window.MainPageViewModel(
        initial,
        liveMonitorService,
        recordingService,
        replayService,
        settingsService,
        iconService
      );

      // Initialize bindings (Presentation Layer)
      const mainPageBindings = new window.MainPageBindings(
        viewModel,
        liveMonitorService,
        recordingService,
        replayService,
        settingsService,
        iconService,
        webSocketClient,
        overlayChannel
      );
      mainPageBindings.attach();

      // Initialize UI bindings (legacy compatibility)
      if (window.MVVM && window.MVVM.Bindings) {
        const uiBinding = new window.MVVM.Bindings.UIBinding(viewModel);
        uiBinding.monitorBinding = mainPageBindings; // For recording compatibility
        uiBinding.attach();
      }

      // Start monitoring
      viewModel.start();

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      // Show error message to user
      const container = document.querySelector('.container');
      if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'padding: 20px; background: #ffebee; color: #c62828; border-radius: 8px; margin: 20px;';
        errorDiv.innerHTML = '<h3>初期化エラー</h3><p>アプリケーションの初期化に失敗しました。コンソールを確認してください。</p>';
        container.insertBefore(errorDiv, container.firstChild);
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

\`,
  "src/app/overlayApp.js": \`/**
 * overlayApp.js - Application Entry Point
 * オーバーレイウィンドウのエントリーポイント
 */
(function() {
  'use strict';

  /**
   * スクリプトを動的に読み込む
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (src.includes('meterRenderer.js') && window.MeterRenderer) {
        resolve();
        return;
      }
      if (src.includes('iconRenderer.js') && window.IconRenderer) {
        resolve();
        return;
      }
      if (src.includes('event.js') && window.MVVM && window.MVVM.Emitter) {
        resolve();
        return;
      }
      if (src.includes('model.js') && window.MVVM && window.MVVM.MeterState) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      const cacheBuster = '?v=' + Date.now();
      script.src = src + cacheBuster;
      script.onload = resolve;
      script.onerror = () => {
        console.error('Failed to load script:', src);
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Domain Layerを読み込む
   */
  async function loadDomainLayer() {
    const domainScripts = [
      'src/domain/ValueRange.js',
      'src/domain/DeviceConfig.js',
      'src/domain/DeviceState.js',
      'src/domain/SessionLog.js',
      'src/domain/LogEntry.js'
    ];

    for (const src of domainScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Infra Layerを読み込む
   */
  async function loadInfraLayer() {
    const infraScripts = [
      'src/infra/repositories/DeviceStateRepository.js',
      'src/infra/repositories/ValueRangeRepository.js',
      'src/infra/bridge/WebSocketBridgeClient.js',
      'src/infra/bridge/HttpPollingClient.js',
      'src/infra/storage/LogFileStorage.js',
      'src/infra/sync/OverlayChannel.js'
    ];

    for (const src of infraScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * UseCase Layerを読み込む
   */
  async function loadUseCaseLayer() {
    const useCaseScripts = [
      'src/usecases/ReplayService.js',
      'src/usecases/SettingsService.js'
    ];

    for (const src of useCaseScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Presentation Layerを読み込む
   */
  async function loadPresentationLayer() {
    // Legacy MVVM modules (for compatibility)
    const legacyScripts = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/views/meterRenderer.js',
      'js/views/iconRenderer.js'
    ];

    for (const src of legacyScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // New Presentation Layer
    const presentationScripts = [
      'src/presentation/viewmodels/OverlayViewModel.js',
      'src/presentation/bindings/OverlayBindings.js'
    ];

    for (const src of presentationScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * アプリケーションを初期化
   */
  async function initOverlayApp() {
    try {
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
      }

      // Load all layers in order
      await loadDomainLayer();
      await loadInfraLayer();
      await loadUseCaseLayer();
      await loadPresentationLayer();

      // Verify required modules
      if (!window.ValueRange || !window.DeviceState) {
        throw new Error('Domain Layer modules failed to load');
      }

      if (!window.DeviceStateRepository || !window.ValueRangeRepository) {
        throw new Error('Infra Layer repositories failed to load');
      }

      if (!window.LogFileStorage) {
        throw new Error('Infra Layer storage failed to load');
      }

      if (!window.ReplayService || !window.SettingsService) {
        throw new Error('UseCase Layer services failed to load');
      }

      if (!window.OverlayViewModel || !window.OverlayBindings) {
        throw new Error('Presentation Layer modules failed to load');
      }

      // Initialize repositories (Infra Layer)
      const valueRangeRepository = new window.ValueRangeRepository(0, 100, '%');
      const deviceStateRepository = new window.DeviceStateRepository();

      // Initialize storage (Infra Layer)
      const logFileStorage = new window.LogFileStorage();

      // Initialize clients (Infra Layer)
      const webSocketClient = new window.WebSocketBridgeClient();
      const httpPollingClient = new window.HttpPollingClient();
      const overlayChannel = new window.OverlayChannel();

      // Initialize UseCase services
      const replayService = new window.ReplayService(logFileStorage, deviceStateRepository);
      const settingsService = new window.SettingsService(valueRangeRepository);

      // Create initial MeterState (legacy compatibility)
      const MeterState = window.MVVM && window.MVVM.MeterState;
      const initial = new MeterState([], ['','','','','',''], null);

      // Initialize ViewModel (Presentation Layer)
      const viewModel = new window.OverlayViewModel(
        initial,
        replayService,
        settingsService
      );

      // Initialize bindings (Presentation Layer)
      const overlayBindings = new window.OverlayBindings(
        viewModel,
        webSocketClient,
        httpPollingClient,
        overlayChannel
      );
      overlayBindings.attach();

      console.log('Overlay application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize overlay application:', error);
      // Show error message
      const container = document.getElementById('meter-container');
      if (container) {
        container.innerHTML = '<div style="padding: 20px; color: #c62828;">初期化エラー: コンソールを確認してください</div>';
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initOverlayApp);
  } else {
    initOverlayApp();
  }
})();

\`,
  "src/domain/DeviceConfig.js": \`/**
 * DeviceConfig - Domain Model
 * デバイスの設定情報（IP、アイコンURLなど）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function DeviceConfig(id, ip, iconUrl, name) {
    this.id = id || null;
    this.ip = String(ip || '').trim();
    this.iconUrl = String(iconUrl || '').trim();
    this.name = String(name || '').trim();
  }

  /**
   * デバイスが設定されているかどうか
   */
  DeviceConfig.prototype.isConfigured = function() {
    return this.ip.length > 0 || this.name.length > 0;
  };

  /**
   * クローンを作成
   */
  DeviceConfig.prototype.clone = function() {
    return new DeviceConfig(this.id, this.ip, this.iconUrl, this.name);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceConfig;
  } else {
    window.DeviceConfig = DeviceConfig;
  }
})();

\`,
  "src/domain/DeviceState.js": \`/**
 * DeviceState - Domain Model
 * デバイスの状態（正規化値、実際の値、接続状態）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function DeviceState(index, normalizedValue, actualValue, connected) {
    this.index = Number(index) || 0;
    this.normalizedValue = normalizedValue !== null && normalizedValue !== undefined ? Number(normalizedValue) : null;
    this.actualValue = actualValue !== null && actualValue !== undefined ? Number(actualValue) : null;
    this.connected = Boolean(connected);
  }

  /**
   * デバイスが接続されているかどうか
   */
  DeviceState.prototype.isConnected = function() {
    return this.connected && this.normalizedValue !== null;
  };

  /**
   * 値が更新されたかどうか
   */
  DeviceState.prototype.hasChanged = function(other) {
    if (!other || !(other instanceof DeviceState)) return true;
    return this.normalizedValue !== other.normalizedValue ||
           this.actualValue !== other.actualValue ||
           this.connected !== other.connected;
  };

  /**
   * クローンを作成
   */
  DeviceState.prototype.clone = function() {
    return new DeviceState(this.index, this.normalizedValue, this.actualValue, this.connected);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceState;
  } else {
    window.DeviceState = DeviceState;
  }
})();

\`,
  "src/domain/LogEntry.js": \`/**
 * LogEntry - Domain Model
 * ログエントリ（タイムスタンプ、正規化値、id）を表す純粋なデータクラス
 */
(function () {
  'use strict';

  function LogEntry(timestamp, id, value) {
    this.timestamp = timestamp ? new Date(timestamp) : new Date();
    this.id = id;
    this.value = value;
  }

  /**
   * クローンを作成
   */
  LogEntry.prototype.clone = function () {
    return new LogEntry(this.timestamp, this.id, this.value);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogEntry;
  } else {
    window.LogEntry = LogEntry;
  }
})();

\`,
  "src/domain/SessionLog.js": \`/**
 * SessionLog - Domain Model
 * セッションログ（開始時刻、終了時刻、ログエントリのリスト）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function SessionLog(startedAt, endedAt, entries) {
    this.startedAt = startedAt ? new Date(startedAt) : new Date();
    this.endedAt = endedAt ? new Date(endedAt) : null;
    this.entries = Array.isArray(entries) ? entries.slice() : [];
  }

  /**
   * ログエントリを追加
   */
  SessionLog.prototype.addEntry = function(entry) {
    if (entry && typeof entry.timestamp !== 'undefined') {
      this.entries.push(entry);
    }
  };

  /**
   * セッションが終了しているかどうか
   */
  SessionLog.prototype.isEnded = function() {
    return this.endedAt !== null;
  };

  /**
   * セッションを終了
   */
  SessionLog.prototype.end = function() {
    if (!this.isEnded()) {
      this.endedAt = new Date();
    }
  };

  /**
   * エントリ数を取得
   */
  SessionLog.prototype.getEntryCount = function() {
    return this.entries.length;
  };

  /**
   * クローンを作成
   */
  SessionLog.prototype.clone = function() {
    return new SessionLog(this.startedAt, this.endedAt, this.entries.slice());
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionLog;
  } else {
    window.SessionLog = SessionLog;
  }
})();

\`,
  "src/domain/ValueRange.js": \`/**
 * ValueRange - Domain Model
 * 値の範囲（最小値、最大値、単位）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function ValueRange(min, max, unit) {
    this.min = Number(min) || 0;
    this.max = Number(max) || 100;
    this.unit = String(unit || '%').trim() || '%';
    
    // Validation: ensure min < max
    if (this.min >= this.max) {
      this.max = this.min + 1;
    }
  }

  /**
   * 実際の値を0-100の正規化値に変換
   */
  ValueRange.prototype.normalize = function(actualValue) {
    const range = this.max - this.min;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.min) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値（0-100）を実際の値に変換
   */
  ValueRange.prototype.denormalize = function(normalizedValue) {
    const range = this.max - this.min;
    return this.min + (normalizedValue / 100) * range;
  };

  /**
   * 値が範囲内かどうかをチェック
   */
  ValueRange.prototype.isInRange = function(value) {
    return value >= this.min && value <= this.max;
  };

  /**
   * クローンを作成
   */
  ValueRange.prototype.clone = function() {
    return new ValueRange(this.min, this.max, this.unit);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueRange;
  } else {
    window.ValueRange = ValueRange;
  }
})();

\`,
  "src/infra/bridge/HttpPollingClient.js": \`/**
 * HttpPollingClient - Infra Layer
 * HTTPポーリングでブリッジサーバーから状態を取得するクライアント
 */
(function() {
  'use strict';

  function HttpPollingClient(url, interval) {
    this.url = url || 'http://127.0.0.1:8123/state';
    this.interval = interval || 1500; // Default 1.5 seconds
    this.pollTimer = null;
    this.subscribers = [];
    this.isPolling = false;
  }

  /**
   * ポーリングを開始
   */
  HttpPollingClient.prototype.start = function() {
    if (this.isPolling) return;
    this.isPolling = true;
    this._poll();
  };

  /**
   * ポーリングを停止
   */
  HttpPollingClient.prototype.stop = function() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  };

  /**
   * ポーリング実行
   */
  HttpPollingClient.prototype._poll = function() {
    if (!this.isPolling) return;

    fetch(this.url, { cache: 'no-store' })
      .then(response => {
        if (!response || !response.ok) {
          throw new Error(\\\`HTTP \\\${response.status}\\\`);
        }
        return response.json();
      })
      .then(data => {
        this._notifySubscribers({ type: 'data', data });
      })
      .catch(error => {
        this._notifySubscribers({ type: 'error', error });
      })
      .finally(() => {
        if (this.isPolling) {
          this.pollTimer = setTimeout(() => {
            this.pollTimer = null;
            this._poll();
          }, this.interval);
        }
      });
  };

  /**
   * イベントを購読
   */
  HttpPollingClient.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  HttpPollingClient.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  HttpPollingClient.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HttpPollingClient;
  } else {
    window.HttpPollingClient = HttpPollingClient;
  }
})();

\`,
  "src/infra/bridge/WebSocketBridgeClient.js": \`/**
 * WebSocketBridgeClient - Infra Layer
 * WebSocket経由でブリッジサーバーと通信するクライアント
 */
(function() {
  'use strict';

  function WebSocketBridgeClient(url) {
    this.url = url || 'ws://127.0.0.1:8123';
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 1500;
    this.subscribers = [];
    this.isConnected = false;
  }

  /**
   * 接続を確立
   */
  WebSocketBridgeClient.prototype.connect = function() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          try {
            this.ws.close();
          } catch (e) {}
          this.ws = null;
        }

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
          this.isConnected = true;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this._notifySubscribers({ type: 'connected' });
          resolve();
        };

        ws.onclose = () => {
          this.isConnected = false;
          this._notifySubscribers({ type: 'disconnected' });
          // Auto-reconnect
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect().catch(() => {}); // Ignore errors during reconnect
            }, this.reconnectDelay);
          }
        };

        ws.onerror = (error) => {
          this._notifySubscribers({ type: 'error', error });
          try {
            ws.close();
          } catch (e) {}
          reject(error);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this._notifySubscribers({ type: 'message', data });
          } catch (e) {
            // Not JSON or invalid format, ignore
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * メッセージを送信
   */
  WebSocketBridgeClient.prototype.send = function(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(message);
        return true;
      } catch (e) {
        console.error('Failed to send message:', e);
        return false;
      }
    }
    return false;
  };

  /**
   * 接続を切断
   */
  WebSocketBridgeClient.prototype.disconnect = function() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  };

  /**
   * イベントを購読
   */
  WebSocketBridgeClient.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  WebSocketBridgeClient.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  WebSocketBridgeClient.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketBridgeClient;
  } else {
    window.WebSocketBridgeClient = WebSocketBridgeClient;
  }
})();

\`,
  "src/infra/repositories/DeviceConfigRepository.js": \`/**
 * DeviceConfigRepository - Infra Layer
 * DeviceConfigの永続化を管理するRepository
 */
(function() {
  'use strict';

  const DeviceConfig = window.DeviceConfig || (typeof module !== 'undefined' && module.exports ? require('../../domain/DeviceConfig') : null);

  function DeviceConfigRepository() {
    this.configs = new Array(6).fill(null).map((_, i) => {
      return new DeviceConfig(i, '', '', '');
    });
  }

  /**
   * インデックスで取得
   */
  DeviceConfigRepository.prototype.getByIndex = function(index) {
    if (index < 0 || index >= 6) return null;
    return this.configs[index];
  };

  /**
   * デバイスIDで取得
   */
  DeviceConfigRepository.prototype.getByDeviceId = function(deviceId) {
    const index = this._deviceIdToIndex(deviceId);
    if (index >= 0 && index < 6) {
      return this.configs[index];
    }
    return null;
  };

  /**
   * すべての設定を取得
   */
  DeviceConfigRepository.prototype.getAll = function() {
    return this.configs.slice();
  };

  /**
   * 設定を保存
   */
  DeviceConfigRepository.prototype.save = function(config) {
    if (!config || !(config instanceof DeviceConfig)) return;
    if (config.id >= 0 && config.id < 6) {
      this.configs[config.id] = config;
    }
  };

  /**
   * デバイスIDをインデックスに変換
   */
  DeviceConfigRepository.prototype._deviceIdToIndex = function(deviceId) {
    if (!deviceId) return -1;
    const match = String(deviceId).match(/(\\\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceConfigRepository;
  } else {
    window.DeviceConfigRepository = DeviceConfigRepository;
  }
})();

\`,
  "src/infra/repositories/DeviceStateRepository.js": \`/**
 * DeviceStateRepository - Infra Layer
 * DeviceStateの永続化を管理するRepository
 */
(function() {
  'use strict';

  const DeviceState = window.DeviceState || (typeof module !== 'undefined' && module.exports ? require('../../domain/DeviceState') : null);

  function DeviceStateRepository() {
    this.states = new Map(); // Map<deviceId, DeviceState>
    this.statesByIndex = new Array(6).fill(null); // Array<DeviceState>
  }

  /**
   * デバイスIDで取得
   */
  DeviceStateRepository.prototype.getByDeviceId = function(deviceId) {
    if (!this.states.has(deviceId)) {
      // インデックスを推測
      const index = this._deviceIdToIndex(deviceId);
      const state = new DeviceState(index, null, null, false);
      this.states.set(deviceId, state);
      if (index >= 0 && index < 6) {
        this.statesByIndex[index] = state;
      }
    }
    return this.states.get(deviceId);
  };

  /**
   * インデックスで取得
   */
  DeviceStateRepository.prototype.getByIndex = function(index) {
    if (index < 0 || index >= 6) return null;
    
    if (!this.statesByIndex[index]) {
      const deviceId = \\\`lever\\\${index + 1}\\\`;
      const state = new DeviceState(index, null, null, false);
      this.states.set(deviceId, state);
      this.statesByIndex[index] = state;
    }
    return this.statesByIndex[index];
  };

  /**
   * すべての状態を取得
   */
  DeviceStateRepository.prototype.getAll = function() {
    return Array.from(this.states.values());
  };

  /**
   * 状態を保存
   */
  DeviceStateRepository.prototype.save = function(deviceState) {
    if (!deviceState || !(deviceState instanceof DeviceState)) return;
    
    this.states.set(\\\`lever\\\${deviceState.index + 1}\\\`, deviceState);
    if (deviceState.index >= 0 && deviceState.index < 6) {
      this.statesByIndex[deviceState.index] = deviceState;
    }
  };

  /**
   * デバイスIDをインデックスに変換
   */
  DeviceStateRepository.prototype._deviceIdToIndex = function(deviceId) {
    if (!deviceId) return -1;
    const match = String(deviceId).match(/(\\\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceStateRepository;
  } else {
    window.DeviceStateRepository = DeviceStateRepository;
  }
})();

\`,
  "src/infra/repositories/SessionLogRepository.js": \`/**
 * SessionLogRepository - Infra Layer
 * SessionLogの永続化を管理するRepository
 */
(function() {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../../domain/SessionLog') : null);

  function SessionLogRepository() {
    this.sessions = [];
    this.currentSession = null;
  }

  /**
   * セッションを保存
   */
  SessionLogRepository.prototype.save = function(sessionLog) {
    if (!sessionLog || !(sessionLog instanceof SessionLog)) return;
    
    // 既存のセッションを更新
    const startedAtTime = sessionLog.startedAt instanceof Date ? sessionLog.startedAt.getTime() : sessionLog.startedAt;
    const index = this.sessions.findIndex(s => {
      const sTime = s.startedAt instanceof Date ? s.startedAt.getTime() : s.startedAt;
      return sTime === startedAtTime;
    });
    if (index >= 0) {
      this.sessions[index] = sessionLog;
    } else {
      this.sessions.push(sessionLog);
    }
    
    this.currentSession = sessionLog;
  };

  /**
   * 現在のセッションを取得
   */
  SessionLogRepository.prototype.getCurrent = function() {
    return this.currentSession;
  };

  /**
   * すべてのセッションを取得
   */
  SessionLogRepository.prototype.getAll = function() {
    return this.sessions.slice();
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionLogRepository;
  } else {
    window.SessionLogRepository = SessionLogRepository;
  }
})();

\`,
  "src/infra/repositories/ValueRangeRepository.js": \`/**
 * ValueRangeRepository - Infra Layer
 * ValueRangeの永続化を管理するRepository
 */
(function() {
  'use strict';

  const ValueRange = window.ValueRange || (typeof module !== 'undefined' && module.exports ? require('../../domain/ValueRange') : null);

  function ValueRangeRepository(defaultMin, defaultMax, defaultUnit) {
    this.valueRange = new ValueRange(defaultMin || 0, defaultMax || 100, defaultUnit || '%');
  }

  /**
   * ValueRangeを取得
   */
  ValueRangeRepository.prototype.get = function() {
    return this.valueRange;
  };

  /**
   * ValueRangeを保存
   */
  ValueRangeRepository.prototype.save = function(valueRange) {
    if (valueRange && valueRange instanceof ValueRange) {
      this.valueRange = valueRange;
    }
  };

  /**
   * ValueRangeを更新
   */
  ValueRangeRepository.prototype.update = function(min, max, unit) {
    this.valueRange = new ValueRange(min, max, unit);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueRangeRepository;
  } else {
    window.ValueRangeRepository = ValueRangeRepository;
  }
})();

\`,
  "src/infra/storage/LogFileStorage.js": \`/**
 * LogFileStorage - Infra Layer
 * ログファイルの保存・読み込みを管理するストレージ
 */
(function() {
  'use strict';

  function LogFileStorage(serverUrl) {
    this.serverUrl = serverUrl || 'http://127.0.0.1:8123';
  }

  /**
   * ログデータを保存
   */
  LogFileStorage.prototype.save = function(data) {
    return new Promise((resolve, reject) => {
      if (!data || data.length === 0) {
        reject(new Error('記録されたデータがありません'));
        return;
      }

      // Create JSON content
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = \\\`meter-log-\\\${timestamp}.json\\\`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also save to server (backup)
      this._saveToServer(data, filename)
        .then(() => resolve({ filename, data }))
        .catch(err => {
          console.warn('Failed to save to server:', err);
          // Download already succeeded, so resolve anyway
          resolve({ filename, data });
        });
    });
  };

  /**
   * サーバーに保存
   */
  LogFileStorage.prototype._saveToServer = function(data, filename) {
    return fetch(\\\`\\\${this.serverUrl}/save-log\\\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: data, filename: filename }),
      cache: 'no-store'
    }).then(response => {
      if (!response.ok) {
        throw new Error(\\\`Server returned \\\${response.status}\\\`);
      }
    });
  };

  /**
   * ログファイルを読み込む
   */
  LogFileStorage.prototype.load = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogFileStorage;
  } else {
    window.LogFileStorage = LogFileStorage;
  }
})();

\`,
  "src/infra/storage/SettingsStorage.js": \`/**
 * SettingsStorage - Infra Layer
 * 設定（値の範囲、デバイス設定など）の保存・読み込みを管理するストレージ
 */
(function() {
  'use strict';

  function SettingsStorage() {
    this.storageKey = 'positionVisualizer-settings';
  }

  /**
   * 設定を保存
   */
  SettingsStorage.prototype.save = function(settings) {
    try {
      const data = JSON.stringify(settings);
      localStorage.setItem(this.storageKey, data);
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  };

  /**
   * 設定を読み込む
   */
  SettingsStorage.prototype.load = function() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
      return null;
    }
  };

  /**
   * 設定を削除
   */
  SettingsStorage.prototype.clear = function() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (e) {
      console.error('Failed to clear settings:', e);
      return false;
    }
  };

  /**
   * 値の範囲を保存
   */
  SettingsStorage.prototype.saveValueRange = function(valueRange) {
    const settings = this.load() || {};
    settings.valueRange = {
      min: valueRange.min,
      max: valueRange.max,
      unit: valueRange.unit
    };
    return this.save(settings);
  };

  /**
   * 値の範囲を読み込む
   */
  SettingsStorage.prototype.loadValueRange = function() {
    const settings = this.load();
    if (settings && settings.valueRange) {
      return settings.valueRange;
    }
    return null;
  };

  /**
   * デバイス設定を保存
   */
  SettingsStorage.prototype.saveDeviceConfigs = function(configs) {
    const settings = this.load() || {};
    settings.deviceConfigs = configs.map(config => ({
      id: config.id,
      ip: config.ip,
      iconUrl: config.iconUrl,
      name: config.name
    }));
    return this.save(settings);
  };

  /**
   * デバイス設定を読み込む
   */
  SettingsStorage.prototype.loadDeviceConfigs = function() {
    const settings = this.load();
    if (settings && settings.deviceConfigs) {
      return settings.deviceConfigs;
    }
    return null;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsStorage;
  } else {
    window.SettingsStorage = SettingsStorage;
  }
})();

\`,
  "src/infra/sync/OverlayChannel.js": \`/**
 * OverlayChannel - Infra Layer
 * BroadcastChannelを使用してオーバーレイウィンドウと同期するチャネル
 */
(function() {
  'use strict';

  function OverlayChannel(channelName) {
    this.channelName = channelName || 'meter-overlay';
    this.bc = null;
    this.subscribers = [];
    
    try {
      this.bc = new BroadcastChannel(this.channelName);
      this.bc.onmessage = (event) => {
        this._notifySubscribers({ type: 'message', data: event.data });
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  /**
   * メッセージを送信
   */
  OverlayChannel.prototype.postMessage = function(data) {
    if (this.bc) {
      try {
        this.bc.postMessage(data);
        return true;
      } catch (e) {
        console.error('Failed to post message:', e);
        return false;
      }
    }
    return false;
  };

  /**
   * イベントを購読
   */
  OverlayChannel.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  OverlayChannel.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  OverlayChannel.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * チャネルを閉じる
   */
  OverlayChannel.prototype.close = function() {
    if (this.bc) {
      try {
        this.bc.close();
      } catch (e) {}
      this.bc = null;
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayChannel;
  } else {
    window.OverlayChannel = OverlayChannel;
  }
})();

\`,
  "src/presentation/bindings/MainPageBindings.js": \`/**
 * MainPageBindings - Presentation Layer
 * メインページのDOMバインディング
 */
(function () {
  'use strict';

  const MeterRenderer = window.MeterRenderer;
  const IconRenderer = window.IconRenderer;

  function MainPageBindings(viewModel, liveMonitorService, recordingService, replayService, settingsService, iconService, webSocketClient, overlayChannel) {
    this.viewModel = viewModel;
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;
    this.webSocketClient = webSocketClient;
    this.overlayChannel = overlayChannel;

    this.deviceIdMap = new Map();
  }

  /**
   * デバイスIDをインデックスにマッピング
   */
  MainPageBindings.prototype._getDeviceIndex = function (deviceId) {
    if (!deviceId) return -1;

    if (this.deviceIdMap.has(deviceId)) {
      return this.deviceIdMap.get(deviceId);
    }

    const match = deviceId.match(/(\\\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        const index = num - 1;
        this.deviceIdMap.set(deviceId, index);
        return index;
      }
    }

    // Try to find by IP address or name
    for (let i = 0; i < 6; i++) {
      const ipEl = document.getElementById(\\\`device\\\${i + 1}-ip\\\`);
      const nameEl = document.getElementById(\\\`device\\\${i + 1}-name\\\`);
      const ip = ipEl ? ipEl.value.trim() : '';
      const name = nameEl ? nameEl.value.trim() : '';
      if (name && name.toLowerCase().includes(deviceId.toLowerCase())) {
        this.deviceIdMap.set(deviceId, i);
        return i;
      }
    }

    return -1;
  };

  /**
   * WebSocketメッセージを処理
   */
  MainPageBindings.prototype._handleWebSocketMessage = function (event) {
    if (event.type !== 'message') return;

    const data = event.data;

    // Handle state messages
    if (data.type === 'state' && data.payload) {
      const payload = data.payload;
      if (payload.values && Array.isArray(payload.values)) {
        for (let i = 0; i < 6; i++) {
          const value = payload.values[i];
          const prevValue = this.viewModel.state.values[i];

          if (value !== null && value !== undefined) {
            this.viewModel.setValue(i, value, true, true);

            // Record data if recording is active
            if (this.recordingService && prevValue !== value) {
              const deviceId = \\\`lever\\\${i + 1}\\\`;
              this.recordingService.recordDeviceData(deviceId, value);
            }
          } else {
            this.viewModel.setValue(i, null, false);
          }
        }
      }
      return;
    }

    // Handle device data JSON (legacy format)
    if (data.device_id && data.data) {
      this._processDeviceData(data);
    } else if (data.type === 'device' && data.payload) {
      this._processDeviceData(data.payload);
    } else if (Array.isArray(data)) {
      data.forEach(item => this._processDeviceData(item));
    }
  };

  /**
   * デバイスデータを処理
   */
  MainPageBindings.prototype._processDeviceData = function (jsonData) {
    try {
      if (!jsonData || typeof jsonData !== 'object') return;

      const deviceId = jsonData.device_id;
      if (!deviceId) return;

      const index = this._getDeviceIndex(deviceId);
      if (index < 0 || index > 5) return;

      const data = jsonData.data;
      if (!data) return;

      let value = null;
      if (typeof data.value === 'number') {
        value = data.value;
      } else if (typeof data.smoothed === 'number') {
        value = data.smoothed;
      } else if (typeof data.raw === 'number') {
        value = data.raw;
      }

      if (value !== null && !isNaN(value)) {
        this.viewModel.setValue(index, value);

        // Record data if recording is active
        if (this.recordingService) {
          const normalizedValue = this.viewModel.state.values[index];
          this.recordingService.recordDeviceData(deviceId, normalizedValue);
        }
      }
    } catch (error) {
      console.error('Error processing device data:', error);
    }
  };

  /**
   * 状態をブロードキャスト
   */
  MainPageBindings.prototype.broadcast = function () {
    const state = this.viewModel.toJSON();
    const isPlaying = this.replayService && this.replayService.isPlaying;

    // SVG string - expensive to serialize!
    // Skip serialization during playback to improve performance
    let svgMarkup = '';
    if (!isPlaying) {
      const svgEl = document.querySelector('#meter-container svg[data-meter]');
      svgMarkup = svgEl ? svgEl.outerHTML : '';
    }

    // BroadcastChannel
    if (this.overlayChannel) {
      // During playback, we send only data (no SVG) to keep 60fps
      // Add isReplaying flag so Overlay knows to ignore Live Data
      this.overlayChannel.postMessage({ ...state, svg: svgMarkup, isReplaying: !!isPlaying });
    }

    // localStorage
    // Skip high-frequency writes during playback
    if (!isPlaying) {
      try {
        localStorage.setItem('meter-state', JSON.stringify({ ...state, ts: Date.now(), isReplaying: false }));
        if (svgMarkup) localStorage.setItem('meter-svg', svgMarkup);
      } catch (e) { }
    } else {
      // Optionally update state sparingly or just rely on Channel? 
      // If we don't update localStorage, Overlay won't see it if it only looks there? 
      // Overlay looks at Channel too.
      // But if we want to support "Ghost Replay" prevention, we might want to write isReplaying: true once?
      // Let's safe-guard by writing ONE minimal state if it changed? No, 60fps write is bad.
      // Overlay listens to Channel so it's fine.
    }

    // WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.send({ type: 'state', payload: { ...state, svg: svgMarkup, isReplaying: !!isPlaying } });
    }
  };

  /**
   * バインディングをアタッチ
   */
  MainPageBindings.prototype.attach = function () {
    const vm = this.viewModel;
    const self = this;

    // Initialize meter renderer
    MeterRenderer.initMeter(document.getElementById('meter-container'));

    // Connect WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.subscribe((event) => {
        self._handleWebSocketMessage(event);
      });
      this.webSocketClient.connect();
    }

    // Subscribe to ViewModel changes
    vm.onChange((state) => {
      const connectedDeviceIndices = vm.getConnectedDeviceIndices();
      const actualValues = vm.getActualValues();

      MeterRenderer.updateMeter(state.values, {
        names: state.names,
        icon: state.icon,
        numbersOnly: true,
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: vm.unit,
        minValue: vm.minValue,
        maxValue: vm.maxValue,
        icons: state.icons
      });

      self.broadcast();
    });

    // Initial paint
    const initialConnectedDeviceIndices = vm.getConnectedDeviceIndices();
    const initialActualValues = vm.getActualValues();
    MeterRenderer.updateMeter(vm.state.values, {
      names: vm.state.names,
      icon: vm.state.icon,
      numbersOnly: true,
      textYOffset: 15,
      connectedDeviceIndices: initialConnectedDeviceIndices,
      actualValues: initialActualValues,
      unit: vm.unit,
      minValue: vm.minValue,
      maxValue: vm.maxValue,
      icons: vm.state.icons
    });
    this.broadcast();

    // Bind UI controls
    this._bindUIControls();
  };

  /**
   * UIコントロールをバインディング
   */
  MainPageBindings.prototype._bindUIControls = function () {
    const vm = this.viewModel;
    const self = this;

    // Bind device name inputs
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(\\\`device\\\${i}-name\\\`);
      if (el) {
        const handler = () => vm.setName(i - 1, el.value);
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    }

    // Bind range settings
    const minValueInput = document.getElementById('min-value');
    const maxValueInput = document.getElementById('max-value');
    const unitInput = document.getElementById('value-unit');

    if (minValueInput) {
      minValueInput.addEventListener('change', () => vm.setMinValue(minValueInput.value));
      minValueInput.addEventListener('input', () => vm.setMinValue(minValueInput.value));
    }

    if (maxValueInput) {
      maxValueInput.addEventListener('change', () => vm.setMaxValue(maxValueInput.value));
      maxValueInput.addEventListener('input', () => vm.setMaxValue(maxValueInput.value));
    }

    if (unitInput) {
      unitInput.addEventListener('change', () => vm.setUnit(unitInput.value));
      unitInput.addEventListener('input', () => vm.setUnit(unitInput.value));
    }

    // Bind icon uploads
    for (let i = 1; i <= 6; i++) {
      const input = document.getElementById(\\\`device\\\${i}-icon\\\`);
      if (input) {
        const button = input.closest('.icon-file-button');
        const buttonText = button ? button.querySelector('.icon-button-text') : null;

        const updateIconState = () => {
          const hasIcon = vm.state.icons && vm.state.icons[i - 1];
          if (button) {
            if (hasIcon) {
              button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            } else {
              button.classList.remove('has-icon');
              if (buttonText) buttonText.textContent = '画像を選択';
            }
          }
        };

        updateIconState();

        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) {
            if (button) button.classList.remove('has-icon');
            if (buttonText) buttonText.textContent = '画像を選択';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (dataUrl) {
              vm.setIconAt(i - 1, dataUrl);
              if (button) button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            }
          };
          reader.readAsDataURL(file);
        });

        vm.onChange(() => {
          updateIconState();
        });
      }
    }

    // Bind recording controls
    const startRecordBtn = document.getElementById('start-record');
    const stopRecordBtn = document.getElementById('stop-record');
    const recordStatusEl = document.getElementById('log-record-status');

    const updateRecordStatus = () => {
      if (!recordStatusEl || !this.recordingService) return;
      const status = this.recordingService.getRecordingStatus();
      if (status.isRecording) {
        recordStatusEl.textContent = \\\`記録中... (\\\${status.recordCount}件)\\\`;
        recordStatusEl.style.color = '#d32f2f';
      } else {
        recordStatusEl.textContent = '停止中';
        recordStatusEl.style.color = '#666';
      }
    };

    if (startRecordBtn && this.recordingService) {
      startRecordBtn.addEventListener('click', () => {
        // Pass current values to capture initial state
        this.recordingService.startRecording(this.viewModel.state.values);
        updateRecordStatus();
      });
    }

    if (stopRecordBtn && this.recordingService) {
      stopRecordBtn.addEventListener('click', () => {
        const entries = this.recordingService.stopRecording();
        if (entries && entries.length > 0) {
          try {
            // Use RecordingService to save data (it handles formatting and download)
            this.recordingService.saveRecordedData(entries);
          } catch (e) {
            console.error('Failed to save log:', e);
            alert('ログの保存に失敗しました: ' + e.message);
          }
        }
        updateRecordStatus();
      });
    }

    // Subscribe to recording status changes
    if (this.recordingService) {
      this.recordingService.subscribe(() => {
        updateRecordStatus();
      });
    }

    updateRecordStatus();

    // Bind replay controls
    const logFile = document.getElementById('log-file');
    const playBtn = document.getElementById('play-log');
    const stopBtn = document.getElementById('stop-log');

    if (playBtn && logFile && this.replayService) {
      playBtn.addEventListener('click', () => {
        const f = logFile.files && logFile.files[0];
        if (!f) {
          alert('ログファイル（JSON）を選択してください');
          return;
        }
        this.replayService.loadFile(f).then(() => {
          this.replayService.play();
        }).catch((err) => {
          alert('読み込み失敗: ' + err.message);
        });
      });
    }

    if (stopBtn && this.replayService) {
      stopBtn.addEventListener('click', () => {
        this.replayService.stop();
      });
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainPageBindings;
  } else {
    window.MainPageBindings = MainPageBindings;
  }
})();

\`,
  "src/presentation/bindings/OverlayBindings.js": \`/**
 * OverlayBindings - Presentation Layer
 * オーバーレイウィンドウのDOMバインディング
 */
(function () {
  'use strict';

  const MeterRenderer = window.MeterRenderer;

  function OverlayBindings(viewModel, webSocketClient, httpPollingClient, overlayChannel) {
    this.viewModel = viewModel;
    this.webSocketClient = webSocketClient;
    this.httpPollingClient = httpPollingClient;
    this.overlayChannel = overlayChannel;
    this.initialized = false;
    this.isMainPageReplaying = false;
  }

  /**
   * SVGを完全にレンダリング
   */
  OverlayBindings.prototype._renderSvgFull = function (svgMarkup) {
    if (!svgMarkup) return;
    const container = document.getElementById('meter-container');
    if (!container) return;

    container.innerHTML = svgMarkup;
    this.initialized = true;

    if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
      setTimeout(() => {
        window.IconRenderer.updateAllIconValues();
      }, 50);
    }
  };

  /**
   * SVGをパッチ（差分更新）
   */
  OverlayBindings.prototype._patchSvg = function (svgMarkup) {
    if (!svgMarkup) return;
    const container = document.getElementById('meter-container');
    if (!container) return;

    const existingSvg = container.querySelector('svg[data-meter]');
    if (!existingSvg) {
      this._renderSvgFull(svgMarkup);
      return;
    }

    const temp = document.createElement('div');
    temp.innerHTML = svgMarkup;
    const nextSvg = temp.querySelector('svg[data-meter]');
    if (!nextSvg) return;

    // Update viewBox if changed
    const nextViewBox = nextSvg.getAttribute('viewBox');
    if (nextViewBox && existingSvg.getAttribute('viewBox') !== nextViewBox) {
      existingSvg.setAttribute('viewBox', nextViewBox);
    }

    // Update perf groups
    const nextGroups = nextSvg.querySelectorAll('g[data-perf]');
    nextGroups.forEach((ng) => {
      const key = ng.getAttribute('data-perf');
      let g = existingSvg.querySelector(\\\`g[data-perf="\\\${key}"]\\\`);
      if (!g) {
        g = ng.cloneNode(true);
        existingSvg.appendChild(g);
        return;
      }

      // Update transform
      const tr = ng.getAttribute('transform');
      if (tr) g.setAttribute('transform', tr);

      // Update data attributes
      const dataPercentage = ng.getAttribute('data-percentage');
      const dataActual = ng.getAttribute('data-actual');
      const dataUnit = ng.getAttribute('data-unit');
      if (dataPercentage !== null) g.setAttribute('data-percentage', dataPercentage);
      if (dataActual !== null) g.setAttribute('data-actual', dataActual);
      if (dataUnit !== null) g.setAttribute('data-unit', dataUnit);

      // Update text
      const nt = ng.querySelector('text');
      const ct = g.querySelector('text');
      if (nt && ct) {
        if (ct.textContent !== nt.textContent) ct.textContent = nt.textContent;
        ct.setAttribute('y', nt.getAttribute('y') || ct.getAttribute('y') || '15');
      }

      // Update icon-value text
      const nIconText = ng.querySelector('text.icon-value');
      const cIconText = g.querySelector('text.icon-value');
      if (nIconText) {
        if (!cIconText) {
          g.appendChild(nIconText.cloneNode(true));
        } else {
          cIconText.textContent = nIconText.textContent;
          cIconText.setAttribute('data-actual', nIconText.getAttribute('data-actual') || '');
          cIconText.setAttribute('data-unit', nIconText.getAttribute('data-unit') || '');
        }
      }

      // Update images
      const nimgs = ng.querySelectorAll('image');
      const cimgs = g.querySelectorAll('image');
      if (nimgs && nimgs.length) {
        for (let i = 0; i < nimgs.length; i++) {
          if (!cimgs[i]) {
            g.insertBefore(nimgs[i].cloneNode(true), ct || null);
          }
        }
        const updatedCImgs = g.querySelectorAll('image');
        for (let i = 0; i < nimgs.length; i++) {
          const nimg = nimgs[i];
          const cimg = updatedCImgs[i];
          if (cimg) {
            const href = nimg.getAttribute('href') || nimg.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (href) {
              cimg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
              cimg.setAttribute('href', href);
            } else {
              cimg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
              cimg.removeAttribute('href');
            }

            // Copy style (display: none, etc)
            const style = nimg.getAttribute('style');
            if (style) {
              cimg.setAttribute('style', style);
            } else {
              cimg.removeAttribute('style');
            }
          }
        }
      }
    });

    if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
      setTimeout(() => {
        window.IconRenderer.updateAllIconValues();
      }, 50);
    }
  };

  /**
   * 状態を処理
   */
  OverlayBindings.prototype._handleState = function (payload) {
    if (payload && payload.isReplaying !== undefined) {
      this.isMainPageReplaying = !!payload.isReplaying;
    }
    if (payload && typeof payload.svg === 'string' && payload.svg) {
      if (!this.initialized) {
        this._renderSvgFull(payload.svg);
      } else {
        this._patchSvg(payload.svg);
      }
      return;
    }

    if (payload && Array.isArray(payload.values)) {
      const values = payload.values;

      // Update icons if present in payload (fixes missing images during replay)
      if (payload.icons && Array.isArray(payload.icons)) {
        this.viewModel.state.icons = payload.icons.slice(0, 6);
      }

      for (let i = 0; i < 6; i++) {
        const value = values[i];
        if (value !== null && value !== undefined) {
          this.viewModel.setValue(i, value, true, true);
        } else {
          this.viewModel.setValue(i, null, false);
        }
      }

      if (payload.icon !== undefined) {
        this.viewModel.setIcon(payload.icon);
      }
      if (payload.unit !== undefined) {
        this.viewModel.setUnit(payload.unit);
      }
      if (payload.minValue !== undefined) {
        this.viewModel.setMinValue(payload.minValue);
      }
      if (payload.maxValue !== undefined) {
        this.viewModel.setMaxValue(payload.maxValue);
      }

      this.initialized = true;
    }
  };

  /**
   * バインディングをアタッチ
   */
  OverlayBindings.prototype.attach = function () {
    const container = document.getElementById('meter-container');
    const self = this;

    // Initialize meter
    try {
      MeterRenderer.initMeter(container);
      MeterRenderer.updateMeter([], { icon: null });
      this.initialized = !!container.querySelector('svg[data-meter]');

      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 100);
      }
    } catch (e) { }

    // BroadcastChannel receiver
    if (this.overlayChannel) {
      this.overlayChannel.subscribe((event) => {
        if (event.type === 'message') {
          const d = event.data || {};
          if (typeof d.svg === 'string' && d.svg) {
            if (!self.initialized) {
              self._renderSvgFull(d.svg);
            } else {
              self._patchSvg(d.svg);
            }
            return;
          }
          if (Array.isArray(d.values)) {
            self._handleState(d);
            try {
              const svg = localStorage.getItem('meter-svg');
              if (svg) {
                if (!self.initialized) {
                  self._renderSvgFull(svg);
                } else {
                  self._patchSvg(svg);
                }
              }
            } catch (e) { }
          }
        }
      });
    }

    // localStorage storage event
    window.addEventListener('storage', (e) => {
      if (e.key === 'meter-svg' && typeof e.newValue === 'string') {
        if (!self.initialized) {
          self._renderSvgFull(e.newValue);
        } else {
          self._patchSvg(e.newValue);
        }
      }
    });

    // Initial load from localStorage
    try {
      const svg = localStorage.getItem('meter-svg');
      if (svg) {
        this._renderSvgFull(svg);
      }
    } catch (e) { }

    // WebSocket receiver
    if (this.webSocketClient) {
      this.webSocketClient.subscribe((event) => {
        if (self.isMainPageReplaying) return; // Ignore live data during replay

        if (event.type === 'message') {
          const msg = event.data || {};
          if (msg && msg.type === 'state' && msg.payload) {
            self._handleState(msg.payload);
          }
        }
      });
      this.webSocketClient.connect();
    }

    // HTTP polling fallback
    if (this.httpPollingClient) {
      this.httpPollingClient.subscribe((event) => {
        if (self.isMainPageReplaying) return; // Ignore live data during replay

        if (event.type === 'data') {
          self._handleState(event.data);
        }
      });
      this.httpPollingClient.start();
    }

    // Subscribe to ViewModel changes
    this.viewModel.onChange((state) => {
      const connectedDeviceIndices = this.viewModel.getConnectedDeviceIndices();
      const actualValues = this.viewModel.getActualValues();

      MeterRenderer.updateMeter(state.values, {
        names: state.names,
        icon: state.icon,
        numbersOnly: true,
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: this.viewModel.unit,
        minValue: this.viewModel.minValue,
        maxValue: this.viewModel.maxValue,
        icons: state.icons
      });

      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 50);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayBindings;
  } else {
    window.OverlayBindings = OverlayBindings;
  }
})();

\`,
  "src/presentation/viewmodels/MainPageViewModel.js": \`/**
 * MainPageViewModel - Presentation Layer
 * メインページのUI状態とUseCase呼び出しを管理するViewModel
 */
(function () {
  'use strict';

  const Emitter = window.MVVM && window.MVVM.Emitter;
  const MeterState = window.MVVM && window.MVVM.MeterState;

  function MainPageViewModel(initialState, liveMonitorService, recordingService, replayService, settingsService, iconService) {
    this.emitter = new Emitter();
    this.state = initialState instanceof MeterState ? initialState : new MeterState();

    // UseCase services
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;

    // UI state
    this.running = false;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';

    // Interpolation state
    this._interpolationDuration = 200;
    this._interpolations = [];
    this._animationFrameId = null;

    // Subscribe to UseCase events
    this._setupUseCaseSubscriptions();
  }

  /**
   * UseCaseのイベントを購読
   */
  MainPageViewModel.prototype._setupUseCaseSubscriptions = function () {
    const self = this;

    // LiveMonitorServiceの購読
    if (this.liveMonitorService) {
      this.liveMonitorService.subscribe((deviceState) => {
        const index = deviceState.index;
        if (index >= 0 && index < 6) {
          if (deviceState.isConnected()) {
            self.setValue(index, deviceState.normalizedValue, true, true);
          } else {
            self.setValue(index, null, false);
          }
        }
      });
    }

    // RecordingServiceの購読
    if (this.recordingService) {
      this.recordingService.subscribe((event) => {
        self._notify();
      });
    }

    // ReplayServiceの購読
    if (this.replayService) {
      this.replayService.subscribe((event) => {
        if (event.type === 'frameUpdated') {
          // Update state values from replay
          if (event.values) {
            for (let i = 0; i < 6; i++) {
              const value = event.values[i];
              if (value !== null && value !== undefined) {
                self.setValue(i, value, true, true);
              } else {
                self.setValue(i, null, false);
              }
            }
          }
        } else if (event.type === 'valuesReset') {
          for (let i = 0; i < 6; i++) {
            self.setValue(i, null, false);
          }
        }
      });
    }

    // SettingsServiceの購読
    if (this.settingsService) {
      this.settingsService.subscribe((valueRange) => {
        self.minValue = valueRange.min;
        self.maxValue = valueRange.max;
        self.unit = valueRange.unit;
        self._notify();
      });
    }

    // IconServiceの購読
    if (this.iconService) {
      this.iconService.subscribe((index, config) => {
        if (index >= 0 && index < 6) {
          self.state.icons[index] = config.iconUrl;
          self._notify();
        }
      });
    }
  };

  /**
   * 変更イベントを購読
   */
  MainPageViewModel.prototype.onChange = function (fn) {
    return this.emitter.on('change', fn);
  };

  /**
   * 変更を通知
   */
  MainPageViewModel.prototype._notify = function () {
    this.emitter.emit('change', this.state.clone());
  };

  /**
   * 値の範囲を設定
   */
  MainPageViewModel.prototype.setMinValue = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(v, currentRange.max, currentRange.unit);
    } else {
      let min = Number(v);
      if (!isNaN(min)) {
        if (min >= this.maxValue) {
          this.maxValue = min + 1;
        }
        this.minValue = min;
        this._notify();
      }
    }
  };

  MainPageViewModel.prototype.setMaxValue = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(currentRange.min, v, currentRange.unit);
    } else {
      let max = Number(v);
      if (!isNaN(max)) {
        if (max <= this.minValue) {
          this.minValue = max - 1;
        }
        this.maxValue = max;
        this._notify();
      }
    }
  };

  MainPageViewModel.prototype.setUnit = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(currentRange.min, currentRange.max, v);
    } else {
      this.unit = String(v || '%').trim() || '%';
      this._notify();
    }
  };

  /**
   * 値を正規化
   */
  MainPageViewModel.prototype.normalizeValue = function (actualValue) {
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50;
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値を実際の値に変換
   */
  MainPageViewModel.prototype.denormalizeValue = function (percentage) {
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };

  /**
   * デバイス名を設定
   */
  MainPageViewModel.prototype.setName = function (index, name) {
    if (index < 0 || index > 5) return;
    this.state.names[index] = String(name || '').trim() || this.state.names[index];
    this._notify();
  };

  /**
   * 値を設定
   */
  MainPageViewModel.prototype.setValue = function (index, value, smooth, isNormalized) {
    if (index < 0 || index > 5) return;

    if (value === null || value === undefined) {
      this._interpolations = this._interpolations.filter(interp => interp.index !== index);
      this.state.values[index] = null;
      this._notify();
      return;
    }

    let normalized;
    if (isNormalized === true) {
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }

    const useSmooth = smooth !== false;
    const currentNormalized = this.state.values[index];

    if (useSmooth && currentNormalized !== null && currentNormalized !== undefined && !isNaN(currentNormalized)) {
      const targetNormalized = normalized;
      const diff = Math.abs(currentNormalized - targetNormalized);
      if (diff > 0.01) {
        this._interpolations = this._interpolations.filter(interp => interp.index !== index);
        const now = performance.now();
        this._interpolations.push({
          index: index,
          startValue: currentNormalized,
          targetValue: targetNormalized,
          startTime: now,
          endTime: now + this._interpolationDuration
        });
        this._startInterpolation();
        return;
      }
    }

    this.state.values[index] = normalized;
    this._notify();
  };

  /**
   * 補間アニメーションを開始
   */
  MainPageViewModel.prototype._startInterpolation = function () {
    if (this._animationFrameId !== null) return;

    const self = this;
    const animate = function () {
      const now = performance.now();
      let needsUpdate = false;

      self._interpolations.forEach(interp => {
        if (now >= interp.endTime) {
          if (self.state.values[interp.index] !== interp.targetValue) {
            self.state.values[interp.index] = interp.targetValue;
            needsUpdate = true;
          }
        } else {
          const progress = (now - interp.startTime) / (interp.endTime - interp.startTime);
          const clampedProgress = Math.max(0, Math.min(1, progress));
          const currentValue = interp.startValue + (interp.targetValue - interp.startValue) * clampedProgress;
          self.state.values[interp.index] = currentValue;
          needsUpdate = true;
        }
      });

      self._interpolations = self._interpolations.filter(interp => now < interp.endTime);

      if (needsUpdate) {
        self._notify();
      }

      if (self._interpolations.length > 0) {
        self._animationFrameId = requestAnimationFrame(animate);
      } else {
        self._animationFrameId = null;
      }
    };

    this._animationFrameId = requestAnimationFrame(animate);
  };

  /**
   * 実際の値を取得
   */
  MainPageViewModel.prototype.getActualValue = function (index) {
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };

  MainPageViewModel.prototype.getActualValues = function () {
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };

  /**
   * 接続されているデバイスのインデックスを取得
   */
  MainPageViewModel.prototype.getConnectedDeviceIndices = function () {
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };

  /**
   * アイコンを設定
   */
  MainPageViewModel.prototype.setIcon = function (path) {
    if (path) {
      this.state.icon = path;
      this._notify();
    }
  };

  MainPageViewModel.prototype.setIconAt = function (index, path) {
    if (index < 0 || index > 5) return;
    if (this.iconService) {
      this.iconService.setIcon(index, path);
    } else {
      this.state.icons[index] = String(path || '');
      this._notify();
    }
  };

  /**
   * 状態を設定
   */
  MainPageViewModel.prototype.setState = function (next) {
    if (!next) return;
    if (!(next instanceof MeterState)) {
      next = new MeterState(next.values, next.names, next.icon, next.icons);
    }
    this.state = next;
    this._notify();
  };

  /**
   * JSONに変換
   */
  MainPageViewModel.prototype.toJSON = function () {
    return {
      values: this.state.values.slice(0, 6),
      names: this.state.names.slice(0, 6),
      icon: this.state.icon,
      icons: this.state.icons.slice(0, 6)
    };
  };

  /**
   * 監視を開始
   */
  MainPageViewModel.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    if (this.liveMonitorService) {
      this.liveMonitorService.start();
    }
    this._notify();
  };

  /**
   * 監視を停止
   */
  MainPageViewModel.prototype.stop = function () {
    if (!this.running) return;
    this.running = false;
    if (this.liveMonitorService) {
      this.liveMonitorService.stop();
    }
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this._interpolations.forEach(interp => {
      this.state.values[interp.index] = interp.targetValue;
    });
    this._interpolations = [];
    this._notify();
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainPageViewModel;
  } else {
    window.MainPageViewModel = MainPageViewModel;
  }
})();

\`,
  "src/presentation/viewmodels/OverlayViewModel.js": \`/**
 * OverlayViewModel - Presentation Layer
 * オーバーレイウィンドウのUI状態とUseCase呼び出しを管理するViewModel
 */
(function() {
  'use strict';

  const Emitter = window.MVVM && window.MVVM.Emitter;
  const MeterState = window.MVVM && window.MVVM.MeterState;

  function OverlayViewModel(initialState, replayService, settingsService) {
    this.emitter = new Emitter();
    this.state = initialState instanceof MeterState ? initialState : new MeterState();
    
    // UseCase services
    this.replayService = replayService;
    this.settingsService = settingsService;
    
    // UI state
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Subscribe to UseCase events
    this._setupUseCaseSubscriptions();
  }

  /**
   * UseCaseのイベントを購読
   */
  OverlayViewModel.prototype._setupUseCaseSubscriptions = function() {
    const self = this;
    
    // ReplayServiceの購読
    if (this.replayService) {
      this.replayService.subscribe((event) => {
        if (event.type === 'frameUpdated') {
          // Update state values from replay
          if (event.values) {
            for (let i = 0; i < 6; i++) {
              self.state.values[i] = event.values[i] !== undefined ? event.values[i] : null;
            }
            self._notify();
          }
        } else if (event.type === 'valuesReset') {
          for (let i = 0; i < 6; i++) {
            self.state.values[i] = null;
          }
          self._notify();
        }
      });
    }
    
    // SettingsServiceの購読
    if (this.settingsService) {
      this.settingsService.subscribe((valueRange) => {
        self.minValue = valueRange.min;
        self.maxValue = valueRange.max;
        self.unit = valueRange.unit;
        self._notify();
      });
    }
  };

  /**
   * 変更イベントを購読
   */
  OverlayViewModel.prototype.onChange = function(fn) {
    return this.emitter.on('change', fn);
  };

  /**
   * 変更を通知
   */
  OverlayViewModel.prototype._notify = function() {
    this.emitter.emit('change', this.state.clone());
  };

  /**
   * 値を正規化
   */
  OverlayViewModel.prototype.normalizeValue = function(actualValue) {
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50;
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値を実際の値に変換
   */
  OverlayViewModel.prototype.denormalizeValue = function(percentage) {
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };

  /**
   * 値を設定
   */
  OverlayViewModel.prototype.setValue = function(index, value, smooth, isNormalized) {
    if (index < 0 || index > 5) return;
    
    if (value === null || value === undefined) {
      this.state.values[index] = null;
      this._notify();
      return;
    }
    
    let normalized;
    if (isNormalized === true) {
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }
    
    this.state.values[index] = normalized;
    this._notify();
  };

  /**
   * 実際の値を取得
   */
  OverlayViewModel.prototype.getActualValue = function(index) {
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };

  OverlayViewModel.prototype.getActualValues = function() {
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };

  /**
   * 接続されているデバイスのインデックスを取得
   */
  OverlayViewModel.prototype.getConnectedDeviceIndices = function() {
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };

  /**
   * アイコンを設定
   */
  OverlayViewModel.prototype.setIcon = function(path) {
    if (path) {
      this.state.icon = path;
      this._notify();
    }
  };

  /**
   * 単位を設定
   */
  OverlayViewModel.prototype.setUnit = function(v) {
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };

  /**
   * 最小値を設定
   */
  OverlayViewModel.prototype.setMinValue = function(v) {
    let min = Number(v);
    if (!isNaN(min)) {
      if (min >= this.maxValue) {
        this.maxValue = min + 1;
      }
      this.minValue = min;
      this._notify();
    }
  };

  /**
   * 最大値を設定
   */
  OverlayViewModel.prototype.setMaxValue = function(v) {
    let max = Number(v);
    if (!isNaN(max)) {
      if (max <= this.minValue) {
        this.minValue = max - 1;
      }
      this.maxValue = max;
      this._notify();
    }
  };

  /**
   * 状態を設定
   */
  OverlayViewModel.prototype.setState = function(next) {
    if (!next) return;
    if (!(next instanceof MeterState)) {
      next = new MeterState(next.values, next.names, next.icon, next.icons);
    }
    this.state = next;
    this._notify();
  };

  /**
   * JSONに変換
   */
  OverlayViewModel.prototype.toJSON = function() {
    return {
      values: this.state.values.slice(0, 6),
      names: this.state.names.slice(0, 6),
      icon: this.state.icon,
      icons: this.state.icons.slice(0, 6)
    };
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayViewModel;
  } else {
    window.OverlayViewModel = OverlayViewModel;
  }
})();

\`,
  "src/usecases/IconService.js": \`/**
 * IconService - UseCase Layer
 * アイコン設定を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function IconService(deviceConfigRepository) {
    this.deviceConfigRepository = deviceConfigRepository;
    this.subscribers = [];
  }

  /**
   * デバイスのアイコンを設定
   */
  IconService.prototype.setIcon = function(deviceIndex, iconUrl) {
    const deviceConfig = this.deviceConfigRepository.getByIndex(deviceIndex);
    if (deviceConfig) {
      const oldConfig = deviceConfig.clone();
      deviceConfig.iconUrl = String(iconUrl || '').trim();
      
      // 変更があった場合のみ通知
      if (deviceConfig.iconUrl !== oldConfig.iconUrl) {
        this._notifySubscribers(deviceIndex, deviceConfig);
      }
    }
  };

  /**
   * デバイスのアイコンを取得
   */
  IconService.prototype.getIcon = function(deviceIndex) {
    const deviceConfig = this.deviceConfigRepository.getByIndex(deviceIndex);
    return deviceConfig ? deviceConfig.iconUrl : '';
  };

  /**
   * 変更を購読
   */
  IconService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  IconService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  IconService.prototype._notifySubscribers = function(deviceIndex, deviceConfig) {
    this.subscribers.forEach(callback => {
      try {
        callback(deviceIndex, deviceConfig);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IconService;
  } else {
    window.IconService = IconService;
  }
})();

\`,
  "src/usecases/LiveMonitorService.js": \`/**
 * LiveMonitorService - UseCase Layer
 * 値の購読を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function LiveMonitorService(deviceStateRepository, valueRangeRepository) {
    this.deviceStateRepository = deviceStateRepository;
    this.valueRangeRepository = valueRangeRepository;
    this.subscribers = [];
    this.isMonitoring = false;
  }

  /**
   * 値の変更を購読
   */
  LiveMonitorService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  LiveMonitorService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * デバイス値の更新を処理
   */
  LiveMonitorService.prototype.updateDeviceValue = function(deviceId, actualValue) {
    // Domain LayerのValueRangeを使用して正規化
    const valueRange = this.valueRangeRepository.get();
    const normalizedValue = valueRange.normalize(actualValue);
    
    // Domain LayerのDeviceStateを更新
    const deviceState = this.deviceStateRepository.getByDeviceId(deviceId);
    if (deviceState) {
      const oldState = deviceState.clone();
      deviceState.normalizedValue = normalizedValue;
      deviceState.actualValue = actualValue;
      deviceState.connected = true;
      
      // 変更があった場合のみ通知
      if (deviceState.hasChanged(oldState)) {
        this._notifySubscribers(deviceState);
      }
    }
  };

  /**
   * デバイスの接続状態を更新
   */
  LiveMonitorService.prototype.updateConnectionState = function(deviceId, connected) {
    const deviceState = this.deviceStateRepository.getByDeviceId(deviceId);
    if (deviceState) {
      deviceState.connected = connected;
      if (!connected) {
        deviceState.normalizedValue = null;
        deviceState.actualValue = null;
      }
      this._notifySubscribers(deviceState);
    }
  };

  /**
   * 購読者に通知
   */
  LiveMonitorService.prototype._notifySubscribers = function(deviceState) {
    this.subscribers.forEach(callback => {
      try {
        callback(deviceState);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * 監視を開始
   */
  LiveMonitorService.prototype.start = function() {
    this.isMonitoring = true;
  };

  /**
   * 監視を停止
   */
  LiveMonitorService.prototype.stop = function() {
    this.isMonitoring = false;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveMonitorService;
  } else {
    window.LiveMonitorService = LiveMonitorService;
  }
})();

\`,
  "src/usecases/RecordingService.js": \`/**
 * RecordingService - UseCase Layer
 * ログ生成を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function () {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../domain/SessionLog') : null);
  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function RecordingService(sessionLogRepository, logFileStorage) {
    this.sessionLogRepository = sessionLogRepository;
    this.logFileStorage = logFileStorage;
    this.currentSession = null;
    this.subscribers = [];
    this.recordingStartTimeMs = null; // Track session start for relative timestamps
  }

  /**
   * 記録を開始
   */
  RecordingService.prototype.startRecording = function (initialValues) {
    if (this.currentSession && !this.currentSession.isEnded()) {
      return; // Already recording
    }

    const sessionLog = new SessionLog();
    this.currentSession = sessionLog;
    this.sessionLogRepository.save(sessionLog);
    this.recordingStartTimeMs = sessionLog.startedAt instanceof Date ? sessionLog.startedAt.getTime() : Date.now();

    this._notifySubscribers({ type: 'started', session: sessionLog });

    // Record initial values if provided
    if (Array.isArray(initialValues)) {
      initialValues.forEach((val, index) => {
        if (val !== null && val !== undefined) {
          // Device IDs are 1-based usually, or index based? 
          // LogEntry uses numeric ID. Main use \\\`i+1\\\`?
          // In recordDeviceData: \\\`const match = deviceId.match(/(\\\\d+)$/);\\\`
          // Let's assume ID is index+1.
          this.recordDeviceData(\\\`lever\\\${index + 1}\\\`, val);
        }
      });
    }
  };

  /**
   * 記録を停止
   */
  RecordingService.prototype.stopRecording = function () {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return null;
    }

    this.currentSession.end();
    const entries = this.currentSession.entries.slice();

    this._notifySubscribers({ type: 'stopped', session: this.currentSession });

    const session = this.currentSession;
    this.currentSession = null;

    return entries;
  };

  /**
   * デバイスデータを記録
   */
  RecordingService.prototype.recordDeviceData = function (deviceId, normalizedValue) {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return;
    }

    if (!deviceId || normalizedValue === null || normalizedValue === undefined) {
      return;
    }

    // Convert deviceId to numeric id if possible
    let id = deviceId;
    if (typeof deviceId === 'string') {
      const match = deviceId.match(/(\\\\d+)$/);
      if (match) {
        id = parseInt(match[1], 10);
      } else {
        // Use hash of string as id
        let hash = 0;
        for (let i = 0; i < deviceId.length; i++) {
          hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
          hash = hash & hash;
        }
        id = Math.abs(hash);
      }
    }

    const numValue = Number(normalizedValue);
    if (!Number.isFinite(numValue)) {
      return;
    }

    // Unpack array if necessary (though it should be a single value now)
    const finalValue = Array.isArray(numValue) ? numValue[0] : numValue;

    const logEntry = new LogEntry(Date.now(), id, finalValue);

    this.currentSession.addEntry(logEntry);
    this._notifySubscribers({ type: 'recorded', entry: logEntry });
  };

  /**
   * 記録されたデータを保存
   */
  RecordingService.prototype.saveRecordedData = function (entries) {
    if (!entries || entries.length === 0) {
      throw new Error('記録されたデータがありません');
    }

    // Determine base timestamp (relative start). Prefer recorded start time; fallback to first entry timestamp.
    let baseTs = Number.isFinite(this.recordingStartTimeMs) ? this.recordingStartTimeMs : null;
    if (!Number.isFinite(baseTs)) {
      const firstEntryTs = entries[0] && entries[0].timestamp instanceof Date
        ? entries[0].timestamp.getTime()
        : Number(entries[0] && entries[0].timestamp);
      baseTs = Number.isFinite(firstEntryTs) ? firstEntryTs : Date.now();
    }

    // Convert LogEntry objects to serializable format { id, value, ts }
    const serializableData = entries.map(entry => {
      const entryTs = entry.timestamp instanceof Date ? entry.timestamp.getTime() : Number(entry.timestamp);
      const ts = Number.isFinite(entryTs) ? Math.max(0, Math.round(entryTs - baseTs)) : 0;

      return {
        id: entry.id,
        value: entry.value,
        ts: ts
      };
    }).filter(item => item !== null);

    // Clear stored start time after exporting to avoid reuse across sessions
    this.recordingStartTimeMs = null;

    // Save via storage
    return this.logFileStorage.save(serializableData);
  };

  /**
   * 記録ステータスを取得
   */
  RecordingService.prototype.getRecordingStatus = function () {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return {
        isRecording: false,
        recordCount: 0,
        startTime: null
      };
    }

    return {
      isRecording: true,
      recordCount: this.currentSession.getEntryCount(),
      startTime: this.currentSession.startedAt
    };
  };

  /**
   * 変更を購読
   */
  RecordingService.prototype.subscribe = function (callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  RecordingService.prototype.unsubscribe = function (callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  RecordingService.prototype._notifySubscribers = function (event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordingService;
  } else {
    window.RecordingService = RecordingService;
  }
})();

\`,
  "src/usecases/ReplayService.js": \`/**
 * ReplayService - UseCase Layer
 * ログ再生を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function ReplayService(logFileStorage, deviceStateRepository) {
    this.logFileStorage = logFileStorage;
    this.deviceStateRepository = deviceStateRepository;
    this.frames = [];
    this.isPlaying = false;
    this.playbackStartTime = null;
    this.animationFrameId = null;
    this.subscribers = [];
    this.intervalMs = 200;
  }

  /**
   * ログデータを読み込む（JSONオブジェクトから）
   */
  ReplayService.prototype.loadLog = function(data) {
    try {
      const logArray = Array.isArray(data) ? data : (Array.isArray(data.records) ? data.records : null);
      
      if (!logArray) {
        throw new Error('Invalid log format');
      }

      this._parseLogArray(logArray);
      this._notifySubscribers({ type: 'logLoaded', framesCount: this.frames.length, intervalMs: this.intervalMs });
    } catch (e) {
      throw e;
    }
  };

  /**
   * ログファイルを読み込む
   */
  ReplayService.prototype.loadFile = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const logArray = Array.isArray(data) ? data : (Array.isArray(data.records) ? data.records : null);
          
          if (!logArray) {
            reject(new Error('Invalid log format'));
            return;
          }

          this._parseLogArray(logArray);
          resolve({ framesCount: this.frames.length, intervalMs: this.intervalMs });
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  /**
   * ログ配列をパースしてフレームに変換
   */
  ReplayService.prototype._parseLogArray = function(arr) {
    const byTs = new Map(); // Map<timestamp, Map<deviceId, value>>
    const ids = new Set();

    // First pass: collect all device IDs and group by timestamp
    arr.forEach(r => {
      if (!r) return;
      const id = Number(r.id);
      const v = Number(r.value);
      const ts = Number(r.ts);
      if (!Number.isFinite(id) || !Number.isFinite(v) || !Number.isFinite(ts)) return;
      ids.add(id);
      if (!byTs.has(ts)) byTs.set(ts, new Map());
      byTs.get(ts).set(id, Math.max(0, Math.min(100, v)));
    });

    const sortedTs = Array.from(byTs.keys()).sort((a, b) => a - b);
    this.intervalMs = 200; // Fixed interval

    // Create sorted list of device IDs (up to 6 devices)
    const idList = Array.from(ids).sort((a, b) => a - b).slice(0, 6);

    // Normalize timestamps to start from 0 (relative time)
    const firstTs = sortedTs.length > 0 ? sortedTs[0] : 0;

    // Build frames with carry-forward values
    const lastVals = new Map();
    this.frames = sortedTs.map(ts => {
      const m = byTs.get(ts);
      idList.forEach(id => {
        if (m.has(id)) lastVals.set(id, m.get(id));
      });

      const values = [null, null, null, null, null, null];
      for (let i = 0; i < idList.length; i++) {
        const deviceId = idList[i];
        if (lastVals.has(deviceId)) {
          values[i] = lastVals.get(deviceId);
        }
      }

      return { ts: ts - firstTs, values, idList };
    });
  };

  /**
   * 再生を開始
   */
  ReplayService.prototype.play = function() {
    if (!this.frames.length) return;
    if (this.isPlaying) return;

    this.stop(); // Clear any existing playback
    this.isPlaying = true;
    this.playbackStartTime = Date.now();

    this._notifySubscribers({ type: 'playbackStarted' });

    // Use requestAnimationFrame for smooth playback
    const updateFrame = () => {
      if (!this.isPlaying || this.frames.length === 0) {
        this.animationFrameId = null;
        return;
      }

      const currentTime = Date.now() - this.playbackStartTime;

      // Find the frame that should be playing now
      let prevFrameIndex = -1;
      let nextFrameIndex = -1;

      for (let i = 0; i < this.frames.length; i++) {
        if (this.frames[i].ts <= currentTime) {
          prevFrameIndex = i;
        } else {
          nextFrameIndex = i;
          break;
        }
      }

      // Before first frame
      if (prevFrameIndex < 0) {
        if (this.frames.length > 0) {
          this._applyFrameValues(this.frames[0].values);
        }
        this.animationFrameId = requestAnimationFrame(updateFrame);
        return;
      }

      // Past last frame
      if (currentTime >= this.frames[this.frames.length - 1].ts) {
        this._resetAllValues();
        this.stop();
        return;
      }

      // Interpolate between frames
      const prevFrame = this.frames[prevFrameIndex];
      let interpolatedValues = prevFrame.values.slice();

      if (nextFrameIndex >= 0 && nextFrameIndex < this.frames.length) {
        const nextFrame = this.frames[nextFrameIndex];
        const prevTime = prevFrame.ts;
        const nextTime = nextFrame.ts;

        const t = nextTime > prevTime ? (currentTime - prevTime) / (nextTime - prevTime) : 0;
        const clampedT = Math.max(0, Math.min(1, t));

        for (let i = 0; i < 6; i++) {
          const prevVal = prevFrame.values[i];
          const nextVal = nextFrame.values[i];

          if (prevVal !== null && prevVal !== undefined && nextVal !== null && nextVal !== undefined) {
            interpolatedValues[i] = prevVal + (nextVal - prevVal) * clampedT;
          } else if (prevVal !== null && prevVal !== undefined) {
            interpolatedValues[i] = prevVal;
          } else if (nextVal !== null && nextVal !== undefined) {
            interpolatedValues[i] = nextVal;
          } else {
            interpolatedValues[i] = null;
          }
        }
      }

      this._applyFrameValues(interpolatedValues);
      this.animationFrameId = requestAnimationFrame(updateFrame);
    };

    this.animationFrameId = requestAnimationFrame(updateFrame);
  };

  /**
   * 再生を停止
   */
  ReplayService.prototype.stop = function() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isPlaying = false;
    this.playbackStartTime = null;
    this._resetAllValues();
    this._notifySubscribers({ type: 'playbackStopped' });
  };

  /**
   * フレームの値を適用
   */
  ReplayService.prototype._applyFrameValues = function(values) {
    for (let i = 0; i < 6; i++) {
      const deviceState = this.deviceStateRepository.getByIndex(i);
      if (deviceState) {
        const value = values[i];
        if (value !== null && value !== undefined) {
          deviceState.normalizedValue = value;
          deviceState.connected = true;
        } else {
          deviceState.normalizedValue = null;
          deviceState.connected = false;
        }
      }
    }
    this._notifySubscribers({ type: 'frameUpdated', values });
  };

  /**
   * すべての値をリセット
   */
  ReplayService.prototype._resetAllValues = function() {
    for (let i = 0; i < 6; i++) {
      const deviceState = this.deviceStateRepository.getByIndex(i);
      if (deviceState) {
        deviceState.normalizedValue = null;
        deviceState.actualValue = null;
        deviceState.connected = false;
      }
    }
    this._notifySubscribers({ type: 'valuesReset' });
  };

  /**
   * 変更を購読
   */
  ReplayService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  ReplayService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  ReplayService.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReplayService;
  } else {
    window.ReplayService = ReplayService;
  }
})();

\`,
  "src/usecases/SettingsService.js": \`/**
 * SettingsService - UseCase Layer
 * 範囲・単位更新を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function SettingsService(valueRangeRepository) {
    this.valueRangeRepository = valueRangeRepository;
    this.subscribers = [];
  }

  /**
   * 値の範囲を更新
   */
  SettingsService.prototype.updateRange = function(min, max, unit) {
    const valueRange = this.valueRangeRepository.get();
    const oldRange = valueRange.clone();
    
    valueRange.min = Number(min) || 0;
    valueRange.max = Number(max) || 100;
    valueRange.unit = String(unit || '%').trim() || '%';
    
    // Validation: ensure min < max
    if (valueRange.min >= valueRange.max) {
      valueRange.max = valueRange.min + 1;
    }
    
    // 変更があった場合のみ通知
    if (valueRange.min !== oldRange.min || 
        valueRange.max !== oldRange.max || 
        valueRange.unit !== oldRange.unit) {
      this._notifySubscribers(valueRange);
    }
  };

  /**
   * 値の範囲を取得
   */
  SettingsService.prototype.getRange = function() {
    return this.valueRangeRepository.get().clone();
  };

  /**
   * 変更を購読
   */
  SettingsService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  SettingsService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  SettingsService.prototype._notifySubscribers = function(valueRange) {
    this.subscribers.forEach(callback => {
      try {
        callback(valueRange);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsService;
  } else {
    window.SettingsService = SettingsService;
  }
})();

\`,
  "sw.js": \`// Empty service worker to prevent 404 errors
// This file exists only to satisfy browser requests for service worker registration
// No actual service worker functionality is implemented

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// No fetch handler - all requests pass through normally

\`,
  "testApp/test-bun-detection.js": \`#!/usr/bin/env node
// コンパイル時の検出方法をテスト

console.log('=== Compilation Detection Tests ===');

// 通常のNode.js検出
console.log('1. require.main === module:', require.main === module);

// Bunの検出
console.log('2. typeof Bun !== "undefined":', typeof Bun !== 'undefined');

// process.pkgの検出（PKGによるコンパイル）
console.log('3. process.pkg:', process.pkg);

// import.meta.mainを使った検出（Bunのみ）
if (typeof import.meta !== 'undefined') {
  console.log('4. Bun.main:', Bun.main);
  console.log('5. import.meta.path:', import.meta.path);
}

// __filenameとBun.mainの比較
if (typeof Bun !== 'undefined' && Bun.main) {
  console.log('6. Bun.main === import.meta.path:', Bun.main === import.meta.path);
  console.log('7. Bun.main === __filename:', Bun.main === __filename);
}

// process.execPathがバイナリを指しているか
console.log('8. process.execPath:', process.execPath);
console.log('9. process.execPath includes ".exe" or compiled binary:',
  process.execPath.includes('.exe') ||
  process.execPath.includes('compiled') ||
  !process.execPath.includes('bun')
);

// 実行ファイルかどうかの判定
const isCompiledBinary = (
  typeof Bun !== 'undefined' &&
  Bun.main &&
  Bun.main.startsWith('/$bunfs/')
);

console.log('\\\\n=== Result ===');
console.log('Is Compiled Binary:', isCompiledBinary);
\`,
  "testApp/test-bun-serve.js": \`#!/usr/bin/env node
// Bun.serveを使ったシンプルなサーバーテスト

console.log('=== Bun.serve Test ===');
console.log('process.execPath:', process.execPath);
console.log('__dirname:', __dirname);
console.log('Bun.main:', typeof Bun !== 'undefined' ? Bun.main : 'N/A');

if (typeof Bun !== 'undefined' && Bun.serve) {
  console.log('\\\\nStarting Bun.serve...');

  const server = Bun.serve({
    port: 3000,
    hostname: '127.0.0.1',
    fetch(req) {
      return new Response('Hello from Bun.serve!\\\\n', {
        headers: { 'Content-Type': 'text/plain' }
      });
    },
  });

  console.log(\\\`Server running at http://\\\${server.hostname}:\\\${server.port}\\\`);
  console.log('Press Ctrl+C to stop');
} else {
  console.log('\\\\nBun.serve is not available. This must be run with Bun.');
}
\`,
  "testApp/test-bunfs.js": \`#!/usr/bin/env node
// $bunfsファイルシステムのテスト

const fs = require('fs');
const path = require('path');

console.log('=== Bun FileSystem Test ===\\\\n');

// 基本情報
console.log('1. Basic Information:');
console.log('   process.execPath:', process.execPath);
console.log('   __dirname:', __dirname);
console.log('   __filename:', __filename);

if (typeof Bun !== 'undefined') {
  console.log('   Bun.main:', Bun.main);
  console.log('   import.meta.path:', import.meta.path);
  console.log('   import.meta.dir:', import.meta.dir);
}

// コンパイル検出
const isCompiled = typeof Bun !== 'undefined' && Bun.main && Bun.main.startsWith('/$bunfs/');
console.log('\\\\n2. Compilation Detection:');
console.log('   Is Compiled:', isCompiled);

// 埋め込みファイルのリスト（Bun 1.x以降）
if (typeof Bun !== 'undefined' && Bun.embeddedFiles) {
  console.log('\\\\n3. Embedded Files:');
  console.log('   Bun.embeddedFiles:', Bun.embeddedFiles);
} else {
  console.log('\\\\n3. Embedded Files:');
  console.log('   Bun.embeddedFiles: Not available');
}

// ファイルの存在チェック
console.log('\\\\n4. File Existence Checks:');
console.log('   Current directory files:');
try {
  const files = fs.readdirSync(__dirname);
  files.forEach(file => {
    console.log('   -', file);
  });
} catch (error) {
  console.log('   Error reading directory:', error.message);
}

// process.cwdとの比較
console.log('\\\\n5. Working Directory:');
console.log('   process.cwd():', process.cwd());
console.log('   __dirname === process.cwd():', __dirname === process.cwd());

// パス解決のテスト
console.log('\\\\n6. Path Resolution:');
const testPath = path.join(__dirname, 'test.txt');
console.log('   path.join(__dirname, "test.txt"):', testPath);
console.log('   path.resolve("test.txt"):', path.resolve('test.txt'));

// 実行ファイルのディレクトリ
if (isCompiled) {
  const execDir = path.dirname(process.execPath);
  console.log('\\\\n7. Executable Directory (Compiled):');
  console.log('   path.dirname(process.execPath):', execDir);

  try {
    const files = fs.readdirSync(execDir);
    console.log('   Files in executable directory:');
    files.slice(0, 10).forEach(file => {
      console.log('   -', file);
    });
  } catch (error) {
    console.log('   Error:', error.message);
  }
}
\`,
  "testApp/test-child-process.js": \`#!/usr/bin/env node
// 子プロセスからの起動をテスト

const child_process = require('child_process');
const path = require('path');

console.log('=== Parent Process Information ===');
console.log('process.execPath:', process.execPath);
console.log('__dirname:', __dirname);

console.log('\\\\n=== Spawning Child Process ===');

// 子プロセスを起動
const childScript = path.join(__dirname, 'test-execpath.js');
console.log('Spawning:', childScript);

const child = child_process.spawn(
  process.execPath,
  [childScript],
  {
    stdio: 'inherit'
  }
);

child.on('exit', (code) => {
  console.log('\\\\nChild process exited with code:', code);
});

child.on('error', (error) => {
  console.error('Error spawning child:', error);
});
\`,
  "testApp/test-execpath.js": \`#!/usr/bin/env node
// process.execPath の挙動をテスト

console.log('=== Process Information ===');
console.log('process.execPath:', process.execPath);
console.log('process.argv[0]:', process.argv[0]);
console.log('process.argv[1]:', process.argv[1]);
console.log('__filename:', __filename);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('process.platform:', process.platform);

// Bunの特有のプロパティをチェック
if (typeof Bun !== 'undefined') {
  console.log('\\\\n=== Bun Specific ===');
  console.log('Bun.main:', Bun.main);
  console.log('Bun.argv:', Bun.argv);

  if (typeof import.meta !== 'undefined') {
    console.log('import.meta.path:', import.meta.path);
    console.log('import.meta.dir:', import.meta.dir);
    console.log('import.meta.file:', import.meta.file);
  }
}

// pkgによるコンパイル時のプロパティ
if (process.pkg) {
  console.log('\\\\n=== PKG Specific ===');
  console.log('process.pkg:', process.pkg);
}
\`,
};

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

module.exports = {
  resources,
  getResource,
  getMimeType,
  listResources
};
`,
  "css/style.css": `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: fot-udkakugoc80-pro, sans-serif;
  background: linear-gradient(135deg, #0b0d12 0%, #1a1d29 100%);
  color: #e5e7eb;
  font-weight: 400;
  font-style: normal;
  min-height: 100vh;
  padding: 20px;
}

.container {
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  min-height: calc(100vh - 40px);
  align-items: flex-start;
  align-content: flex-start;
}

/* 上段左: デバイス設定 */
.controls {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
  max-width: 500px;
}

/* 上段右: プレビュー */
.visualizer {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
}

.range-settings-section {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
  max-width: 500px;
}

.log-sections {
  flex: 0 0 calc(50% - 10px);
  min-width: 300px;
}

/* コントロールパネルと履歴パネル */
.controls,
.history-panel {
  width: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.controls:hover,
.history-panel:hover {
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.controls h2,
.history-panel h3,
.visualizer-title {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #f1f5f9;
  font-weight: 700;
  border-bottom: 2px solid #334155;
  padding-bottom: 12px;
}

.controls h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #cbd5e1;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

/* ビジュアライザー */
.visualizer {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 400px;
}

.meter-container {
  position: relative;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  background: #00ff00; /* Green for chroma key */
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #1e293b;
}

#icons-container {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* モードセレクター */
.mode-selector {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
  border: 1px solid #334155;
}

.mode-selector label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 400;
  transition: color 0.2s ease;
}

.mode-selector label:hover {
  color: #f1f5f9;
}

/* カスタムチェックボックス */
.mode-selector input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #475569;
  border-radius: 6px;
  background: #0b1220;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mode-selector input[type="checkbox"]:hover {
  border-color: #64748b;
  background: #1e293b;
}

.mode-selector input[type="checkbox"]:checked {
  background: #5FADCF;
  border-color: #7F57B8;
}

.mode-selector input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 14px;
  font-weight: bold;
}

/* デバイス入力 */
.device-inputs {
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.device-group label {
  font-size: 13px;
  margin-bottom: 4px;
}

.device-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  gap: 8px;
}

.device-group label {
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ip-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}


/* 手動操作セクション */
#manual-controls {
  flex: 1 1 100%;
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  margin-top: 0;
}

.manual-controls-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 12px;
}

/* 値の範囲設定セクション */
.range-settings-section {
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.range-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.range-settings-section h3 {
  grid-column: 1 / -1;
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #cbd5e1;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
}

/* 値の範囲設定セクションの入力欄 */
.range-settings-section .device-group input[type="number"],
.range-settings-section .device-group input[type="text"] {
  margin-top: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 14px;
  font-weight: 400;
  transition: all 0.2s ease;
  font-family: inherit;
  width: 100%;
}

.range-settings-section .device-group input[type="number"]:focus,
.range-settings-section .device-group input[type="text"]:focus {
  outline: none;
  border-color: #5FADCF;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

.range-settings-section .device-group input[type="number"]:hover,
.range-settings-section .device-group input[type="text"]:hover {
  border-color: #475569;
}

.range-settings-section .device-group input[type="text"]::placeholder {
  color: #64748b;
}

/* 数値入力のスピナーボタンのスタイル */
.range-settings-section .device-group input[type="number"]::-webkit-inner-spin-button,
.range-settings-section .device-group input[type="number"]::-webkit-outer-spin-button {
  opacity: 1;
  cursor: pointer;
  height: 20px;
}

.range-settings-section .device-group input[type="number"]::-webkit-inner-spin-button:hover,
.range-settings-section .device-group input[type="number"]::-webkit-outer-spin-button:hover {
  opacity: 0.8;
}

/* ログ再生セクション */
.log-replay-section {
  padding: 0;
  background: transparent;
  border: none;
}

.log-sections {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.log-replay-section label,
.log-record-section label {
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.log-replay-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.log-replay-buttons button {
  flex: 1;
}

/* ログ記録セクション */
.log-record-section {
  padding: 0;
  background: transparent;
  border: none;
}

.log-record-status {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.log-record-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.log-record-buttons button {
  flex: 1;
}

#manual-controls .device-group {
  margin-bottom: 0;
}

#manual-controls label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #cbd5e1;
  margin-bottom: 8px;
}

#manual-controls label span {
  color: #5FADCF;
  font-weight: 700;
  font-size: 16px;
}

/* カスタムスライダー */
input[type="range"] {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #1e293b;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5FADCF;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: #7F57B8;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5FADCF;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

input[type="range"]::-moz-range-thumb:hover {
  background: #7F57B8;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

input[type="range"]::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: #1e293b;
}

/* ボタン */
.control-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

button {
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  border: none;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  box-shadow: 0 2px 4px rgba(95, 173, 207, 0.3);
  flex: 1;
  min-width: 80px;
}

button:hover {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(127, 87, 184, 0.4);
}

button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(95, 173, 207, 0.3);
}

button:disabled {
  background: #334155;
  color: #64748b;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

button:disabled:hover {
  background: #334155;
  transform: none;
}

/* ステータス */
.status {
  margin-top: 16px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status input[type="number"] {
  width: 80px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  transition: all 0.2s ease;
}

.status input[type="number"]:focus {
  outline: none;
  border-color: #5FADCF;
  background: #0f172a;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

/* アイコンファイル入力（ボタンのみ） */
.icon-file-button {
  position: relative;
  display: block;
  width: 100%;
  height: 36px;
  cursor: pointer;
}

.icon-file-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.icon-button-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid #334155;
  background: linear-gradient(135deg, #334155 0%, #475569 100%);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
  font-family: inherit;
  box-sizing: border-box;
}

.icon-file-button:hover .icon-button-text {
  background: linear-gradient(135deg, #475569 0%, #64748b 100%);
  color: #f1f5f9;
  border-color: #475569;
}

.icon-file-input:focus + .icon-button-text {
  outline: none;
  border-color: #5FADCF;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

/* 登録済み状態（アイコンが設定されている場合） */
.icon-file-button.has-icon .icon-button-text {
  border-color: #5FADCF;
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  color: #fff;
}

.icon-file-button.has-icon:hover .icon-button-text {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  border-color: #7F57B8;
}

/* ログ再生のファイル入力 */
.log-replay-section input[type="file"] {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e5e7eb;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.log-replay-section input[type="file"]:hover {
  border-color: #475569;
  background: #0f172a;
}

.log-replay-section input[type="file"]:focus {
  outline: none;
  border-color: #5FADCF;
  box-shadow: 0 0 0 3px rgba(95, 173, 207, 0.1);
}

.log-replay-section input[type="file"]::file-selector-button {
  background: linear-gradient(135deg, #5FADCF 0%, #4a8fb8 100%);
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 12px;
  font-family: inherit;
}

.log-replay-section input[type="file"]::file-selector-button:hover {
  background: linear-gradient(135deg, #7F57B8 0%, #5FADCF 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(127, 87, 184, 0.3);
}

/* 履歴パネル */
#history-content {
  max-height: 600px;
  overflow-y: auto;
  padding-right: 8px;
}

#history-content::-webkit-scrollbar {
  width: 6px;
}

#history-content::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 3px;
}

#history-content::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

#history-content::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

#history-content > div {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  border: 1px solid #334155;
  font-size: 13px;
  font-weight: 400;
  color: #cbd5e1;
  transition: all 0.2s ease;
  line-height: 1.5;
}

#history-content > div:hover {
  background: rgba(15, 23, 42, 0.7);
  border-color: #475569;
}

#history-content > div:first-child {
  background: rgba(95, 173, 207, 0.1);
  border-color: #5FADCF;
}

/* スクロールバーのスタイル */
.controls::-webkit-scrollbar {
  width: 8px;
}

.controls::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 4px;
}

.controls::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

.controls::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

/* レスポンシブデザイン */
@media (max-width: 1200px) {
  .controls,
  .visualizer,
  .range-settings-section,
  .log-sections {
    flex: 1 1 100%;
    max-width: 100%;
  }
  
  .log-sections {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  body {
    padding: 12px;
  }

  .container {
    gap: 16px;
  }

  .controls,
  .visualizer,
  .range-settings-section,
  .log-sections {
    min-width: 100%;
  }

  .history-panel,
  .visualizer {
    padding: 16px;
  }

  button {
    width: 100%;
  }
  
  .range-grid {
    grid-template-columns: 1fr;
  }
}
`,
  "generate-log.js": `// Generate log data with simultaneous independent device movements
// Each device moves independently to different target values at different times
// Devices can increase or decrease simultaneously

const fs = require('fs');
const path = require('path');

function generateLog() {
  const records = [];
  const totalDuration = 30000; // 30 seconds total
  const interval = 200; // 200ms sampling interval
  const tau = 0.5; // Time constant (0.5 seconds) for exponential movement
  
  // Interpolate value from start to target using exponential function
  // f(x) = target - (target - start) * e^(-x/tau)
  function interpolateValue(startValue, targetValue, elapsedTime) {
    const diff = targetValue - startValue;
    const value = targetValue - diff * Math.exp(-elapsedTime / tau);
    return Math.round(Math.max(0, Math.min(100, value)));
  }
  
  // Device state tracking
  class DeviceState {
    constructor(id) {
      this.id = id;
      this.currentValue = Math.floor(Math.random() * 101); // Random initial value 0-100
      this.targetValue = this.currentValue;
      this.startValue = this.currentValue; // Value at start of current movement
      this.movementStartTime = 0;
      this.isMoving = false;
      this.movementDuration = 0;
    }
    
    // Start a new movement to a random target
    startMovement(currentTime) {
      // Update current value to actual value at this moment (if moving, interpolate)
      if (this.isMoving) {
        this.currentValue = this.getValueAtTime(currentTime, false);
      }
      
      // Generate random target (different from current)
      let newTarget;
      do {
        newTarget = Math.floor(Math.random() * 101);
      } while (Math.abs(newTarget - this.currentValue) < 10); // At least 10 points difference
      
      this.startValue = this.currentValue;
      this.targetValue = newTarget;
      this.movementStartTime = currentTime;
      this.isMoving = true;
      // Random movement duration between 2-6 seconds
      this.movementDuration = 2000 + Math.random() * 4000;
    }
    
    // Get value at a given time
    getValueAtTime(currentTime, updateState = true) {
      if (!this.isMoving) {
        return this.currentValue;
      }
      
      const elapsed = (currentTime - this.movementStartTime) / 1000; // Convert to seconds
      
      if (elapsed >= this.movementDuration / 1000) {
        // Movement complete
        const finalValue = this.targetValue;
        if (updateState) {
          this.currentValue = finalValue;
          this.isMoving = false;
        }
        return finalValue;
      }
      
      // Interpolate during movement
      return interpolateValue(this.startValue, this.targetValue, elapsed);
    }
    
    // Check if should start new movement (random chance)
    shouldStartNewMovement(currentTime, minTimeBetweenMovements = 1000) {
      if (this.isMoving) return false;
      const timeSinceLastMovement = currentTime - (this.movementStartTime + this.movementDuration);
      if (timeSinceLastMovement < minTimeBetweenMovements) return false;
      
      // Random chance to start movement (higher chance as time passes)
      const chance = Math.min(0.3, (timeSinceLastMovement - minTimeBetweenMovements) / 5000);
      return Math.random() < chance;
    }
  }
  
  // Initialize 4 devices with random initial states
  const devices = [];
  for (let i = 1; i <= 4; i++) {
    const device = new DeviceState(i);
    // Random initial delay before first movement (0-3 seconds)
    device.movementStartTime = -Math.random() * 3000;
    devices.push(device);
  }
  
  // Generate records for all time points
  for (let t = 0; t <= totalDuration; t += interval) {
    for (const device of devices) {
      // Check if device should start a new movement
      if (device.shouldStartNewMovement(t)) {
        device.startMovement(t);
      }
      
      // Get current value
      const value = device.getValueAtTime(t);
      
      // Record value
      records.push({
        id: device.id,
        value: value,
        ts: t
      });
    }
  }
  
  // Sort by timestamp, then by device ID
  records.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.id - b.id;
  });
  
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, 'positionVisualizer', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Write to file
  const filename = path.join(logsDir, 'meter-log-simulated-30s-simultaneous.json');
  fs.writeFileSync(filename, JSON.stringify(records, null, 2), 'utf8');
  
  console.log(\`Generated \${records.length} records\`);
  console.log(\`Total duration: \${totalDuration / 1000} seconds\`);
  console.log(\`Devices: 4 (independent simultaneous movements)\`);
  console.log(\`Saved to: \${filename}\`);
  
  // Print sample values showing simultaneous movements
  console.log('\\nSample values showing simultaneous movements (first 30 records):');
  records.slice(0, 30).forEach(r => {
    console.log(\`  t=\${r.ts}ms: device \${r.id} = \${r.value}\`);
  });
  
  // Show example of simultaneous movement
  console.log('\\nExample simultaneous movement (around 5000ms):');
  records.filter(r => r.ts >= 4800 && r.ts <= 5200).forEach(r => {
    console.log(\`  t=\${r.ts}ms: device \${r.id} = \${r.value}\`);
  });
}

generateLog();

`,
  "http-server-bundled.js": `// Simple HTTP server for serving static files from bundled resources
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

// 環境情報のログ出力
console.log('==== HTTP Server Environment ====');
console.log('OS Platform:', process.platform);
console.log('Node Version:', process.version);
console.log('Working Directory:', process.cwd());
console.log('Script Directory:', __dirname);
console.log('Base Directory:', baseDir);
console.log('================================');

// バンドルリソース情報
if (resources) {
  console.log(\`バンドルリソース利用可能: \${resources.listResources().length}ファイル\`);
} else {
  // ファイルシステムのアクセス確認
  try {
    fs.accessSync(baseDir, fs.constants.R_OK);
    console.log(\`ベースディレクトリにアクセス可能: \${baseDir}\`);
    // ディレクトリの内容をログ出力
    const files = fs.readdirSync(baseDir);
    console.log(\`ベースディレクトリ内のファイル数: \${files.length}\`);
    if (files.includes('index.html')) {
      console.log('index.html が見つかりました');
    } else {
      console.warn('警告: index.html が見つかりません');
    }
  } catch (err) {
    console.error(\`ベースディレクトリへのアクセスエラー: \${err.message}\`);
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
      console.error(\`リソースが見つかりません: \${pathname}\`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    console.log(\`バンドルから配信: \${pathname}, MIME: \${mimeType}, サイズ: \${resource.length} バイト\`);
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

// ファイルシステムから配信
function serveFile(filePath, res) {
  const mimeType = getMimeType(filePath);
  console.log(\`ファイルから配信: \${filePath}, MIME: \${mimeType}\`);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(\`ファイル読み込みエラー (\${filePath}):\`, err.message);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    console.log(\`ファイル読み込み成功: \${filePath}, サイズ: \${data.length} バイト\`);
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

  console.log(\`リクエスト: \${pathname}\`);

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
  console.log(\`HTTP server listening on http://\${HOST}:\${PORT}\`);
  if (resources) {
    console.log(\`バンドルリソースから配信中 (ファイルシステムアクセスなし)\`);
  } else {
    console.log(\`Serving files from: \${baseDir}\`);
  }
});

// サーバーのエラーハンドリングを強化
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\`ポート \${PORT} は既に使用されています。\`);
    console.error(\`別のポートを試します...\`);

    // 別のポートを試す
    server.close();
    const newPort = PORT + 1;
    server.listen(newPort, HOST, () => {
      console.log(\`代替ポート \${newPort} で起動しました: http://\${HOST}:\${newPort}\`);
      console.log(\`環境変数 HTTP_PORT=\${newPort} を設定することで、このポートを永続的に使用できます\`);
    });
  } else {
    console.error('サーバーエラー詳細:', err);
    // 終了せずにエラーをログ
    console.error('サーバー起動に失敗しましたが、処理を継続します');
  }
});`,
  "http-server.js": `// Simple HTTP server for serving static files
// Used by positionVisualizer to serve HTML/CSS/JS files

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.HTTP_PORT || 8000);
const HOST = process.env.HTTP_HOST || '127.0.0.1';

// コンパイル後のバイナリでは、ファイルは同じディレクトリにある必要がある
const toolsDir = __dirname;
const baseDir = __dirname;
console.log('Base directory for static files:', baseDir);

// 環境情報のログ出力
console.log('==== HTTP Server Environment ====');
console.log('OS Platform:', process.platform);
console.log('Node Version:', process.version);
console.log('Working Directory:', process.cwd());
console.log('Script Directory:', toolsDir);
console.log('Base Directory:', baseDir);
console.log('================================');

// ファイルシステムのアクセス確認
try {
  fs.accessSync(baseDir, fs.constants.R_OK);
  console.log(\`ベースディレクトリにアクセス可能: \${baseDir}\`);
  // ディレクトリの内容をログ出力
  const files = fs.readdirSync(baseDir);
  console.log(\`ベースディレクトリ内のファイル数: \${files.length}\`);
  if (files.includes('index.html')) {
    console.log('index.html が見つかりました');
  } else {
    console.warn('警告: index.html が見つかりません');
  }
} catch (err) {
  console.error(\`ベースディレクトリへのアクセスエラー: \${err.message}\`);
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

function serveFile(filePath, res) {
  const mimeType = getMimeType(filePath);
  console.log(\`配信ファイル: \${filePath}, MIME: \${mimeType}\`);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(\`ファイル読み込みエラー (\${filePath}):\`, err.message);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    console.log(\`ファイル読み込み成功: \${filePath}, サイズ: \${data.length} バイト\`);
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
  console.log(\`HTTP server listening on http://\${HOST}:\${PORT}\`);
  console.log(\`Serving files from: \${baseDir}\`);
});

// サーバーのエラーハンドリングを強化
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\`ポート \${PORT} は既に使用されています。\`);
    console.error(\`別のポートを試します...\`);

    // 別のポートを試す
    server.close();
    const newPort = PORT + 1;
    server.listen(newPort, HOST, () => {
      console.log(\`代替ポート \${newPort} で起動しました: http://\${HOST}:\${newPort}\`);
      console.log(\`環境変数 HTTP_PORT=\${newPort} を設定することで、このポートを永続的に使用できます\`);
    });
  } else {
    console.error('サーバーエラー詳細:', err);
    // 終了せずにエラーをログ
    console.error('サーバー起動に失敗しましたが、処理を継続します');
  }
});

`,
  "index.html": `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>positionVisualizer</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="preload" href="assets/icon.svg" as="image" type="image/svg+xml">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <script>
      (function(d) {
        var config = { kitId: 'kaz6zgt', scriptTimeout: 3000, async: true },
        h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\bwf-loading\\b/g,"")+" wf-inactive";},config.scriptTimeout),
        tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";
        tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;
        tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};
        s.parentNode.insertBefore(tk,s)
      })(document);
    </script>
    <style>
      /* Fallback styles */
      .container{
        display:flex;
        flex-wrap:wrap;
        gap:20px;
        align-items:flex-start;
        justify-content:center;
        padding:10px;
        max-width:100%;
        min-height:calc(100vh - 40px);
        margin:0 auto;
        box-sizing: border-box;
      }
      .controls{flex:0 1 calc(50% - 10px);min-width:300px;max-width:500px;height:480px;border:1px solid #334155;padding:20px;border-radius:16px}
      .visualizer{flex:1 1 calc(50% - 10px);min-width:300px;max-width:740px;height:480px;border:1px solid #334155;padding:20px;border-radius:16px;min-height:400px;display:flex;flex-direction:column}
      .range-settings-section{flex:0 1 calc(50% - 10px);min-width:300px;max-width:500px;border:1px solid #334155;padding:16px;border-radius:16px}
      .log-sections{flex:1 1 calc(50% - 10px);min-width:300px;max-width:740px;border:1px solid #334155;padding:16px;border-radius:16px}
      .meter-container{position:relative;width:100%;max-width:980px;margin:0 auto;aspect-ratio:16/9;flex:1}
      #icons-container{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
      button{cursor:pointer}

      /* オーバーレイボタン用スタイル */
      .visualizer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        width: 100%;
        flex-wrap: wrap;
        gap: 10px;
      }
      .visualizer-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        flex: 1;
        min-width: 120px;
      }
      .overlay-button {
        background-color: #334155;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 14px;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        white-space: nowrap;
        line-height: 1.2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 140px;
      }
      .overlay-button:hover {
        background-color: #1e293b;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      }

      /* レスポンシブ対応 */
      @media (max-width: 768px) {
        .container {
          padding: 8px;
          gap: 12px;
        }
      }

      @media (max-width: 500px) {
        .visualizer-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .visualizer-title {
          margin-bottom: 8px;
        }
        .overlay-button {
          width: 100%;
        }
        .visualizer, .controls, .range-settings-section, .log-sections {
          padding: 15px;
        }
      }
    </style>
    <script>
      // キャッシュクリア用のビルドクエリ
      window.__buildTs = Date.now();
    </script>
</head>
<body>
    <div class="container">
        <div class="controls">
            <h2>デバイス設定</h2>
            <div class="device-inputs">
                <div class="device-group">
                    <label>デバイス1</label>
                    <label class="icon-file-button" for="device1-icon">
                        <input type="file" id="device1-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス2</label>
                    <label class="icon-file-button" for="device2-icon">
                        <input type="file" id="device2-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス3</label>
                    <label class="icon-file-button" for="device3-icon">
                        <input type="file" id="device3-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス4</label>
                    <label class="icon-file-button" for="device4-icon">
                        <input type="file" id="device4-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス5</label>
                    <label class="icon-file-button" for="device5-icon">
                        <input type="file" id="device5-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
                <div class="device-group">
                    <label>デバイス6</label>
                    <label class="icon-file-button" for="device6-icon">
                        <input type="file" id="device6-icon" accept="image/*" class="icon-file-input">
                        <span class="icon-button-text">画像を選択</span>
                    </label>
                </div>
            </div>
        </div>

        <div class="visualizer">
            <div class="visualizer-header">
                <h2 class="visualizer-title">プレビュー</h2>
                <button id="open-overlay" class="overlay-button" title="オーバーレイウィンドウを開く">
                    オーバーレイを開く
                </button>
            </div>
            <div class="meter-container" id="meter-container">
                <div id="icons-container"></div>
            </div>
        </div>
        <div class="range-settings-section">
            <h3>値の範囲設定</h3>
            <div class="range-grid">
                <div class="device-group">
                    <label>最小値</label>
                    <input type="number" id="min-value" value="0" step="0.1">
                </div>
                <div class="device-group">
                    <label>最大値</label>
                    <input type="number" id="max-value" value="100" step="0.1">
                </div>
                <div class="device-group">
                    <label>単位</label>
                    <input type="text" id="value-unit" value="%" placeholder="例: %, °, kg">
                </div>
            </div>
        </div>
        
        <div class="log-sections">
            <div class="log-replay-section">
                <label>ログ再生</label>
                <input type="file" id="log-file" accept="application/json,.json">
                <div class="log-replay-buttons">
                    <button id="play-log">再生</button>
                    <button id="stop-log">停止</button>
                </div>
            </div>
            <div class="log-record-section">
                <label>ログ記録</label>
                <div class="log-record-status" id="log-record-status">停止中</div>
                <div class="log-record-buttons">
                    <button id="start-record">記録開始</button>
                    <button id="stop-record">記録終了</button>
                </div>
            </div>
        </div>
    </div>

    <script>window.USE_MVVM = true;</script>
    <script src="src/app/main.js"></script>
    <script>
        // オーバーレイを開くボタンの機能を追加
        document.addEventListener('DOMContentLoaded', function() {
            const openOverlayButton = document.getElementById('open-overlay');
            if (openOverlayButton) {
                openOverlayButton.addEventListener('click', function() {
                    // 別ウィンドウでオーバーレイを開く
                    window.open('overlay.html', 'overlay_window', 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no');
                });
            }
        });
    </script>
</body>
</html>


`,
  "integrated-server.js": `// integrated-server.js
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
  const match = String(deviceId).match(/(\\d+)$/);
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

        const filename = data.filename || \`meter-log-\${Date.now()}.json\`;
        const filepath = path.join(jsonDir, filename);
        const jsonContent = JSON.stringify(data.records, null, 2);

        fs.writeFile(filepath, jsonContent, 'utf8', (err) => {
          if (err) {
            console.error('Failed to save log:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save log file' }));
            return;
          }
          console.log(\`Log saved: \${filepath}\`);
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
        console.log(\`[bridge] device_update: device_id=\${device_id}, index=\${index}, value=\${valueData.value}\`);

        if (index >= 0 && index < 6 && typeof valueData.value === 'number') {
          latest.values[index] = valueData.value;
          latest.ts = Date.now();
          console.log(\`[bridge] Broadcasting update: index=\${index}, value=\${valueData.value}\`);
          broadcast({ type: 'state', payload: latest });
        } else {
          console.log(\`[bridge] device_update: invalid index or value (index=\${index}, value=\${valueData.value})\`);
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
  console.log(\`HTTPサーバーが起動しました http://\${HTTP_HOST}:\${HTTP_PORT}\`);
  console.log(\`WebSocketエンドポイント: ws://\${HTTP_HOST}:\${WS_PORT}\`);
  console.log(\`静的ファイル配信元: \${appDir}\`);

  // LeverAPIに接続
  connectToLeverAPI();

  // ブラウザを開く
  openBrowser();

  // コンソール表示
  console.log('\\n----------------------------------------');
  console.log('サーバーが起動しました');
  console.log('終了するには Q または q キーを押すか、Ctrl+C を押してください');
  console.log('----------------------------------------\\n');

  // キー入力待機
  waitForKeyPress();
});

// エラーハンドリング
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\`ポート \${HTTP_PORT} は既に使用されています。\`);
    console.error(\`ポート \${HTTP_PORT} を使用しているアプリケーションを終了するか、HTTP_PORT環境変数を設定して別のポートを使用してください。\`);
  } else {
    console.error('サーバーエラー:', err);
  }
  process.exit(1);
});

// ブラウザを開く関数
function openBrowser() {
  const url = \`http://\${HTTP_HOST}:\${HTTP_PORT}/\`;
  const overlayUrl = \`http://\${HTTP_HOST}:\${HTTP_PORT}/overlay.html\`;

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
    exec(\`\${command} "\${url}"\`);

    // 少し待ってからオーバーレイを開く（必ず別ウィンドウで）
    setTimeout(() => {
      if (process.platform === 'win32') {
        // Windowsでは新しいウィンドウを強制するオプションを指定
        exec(\`\${overlayCommand} "" "\${overlayUrl}"\`);
      } else if (process.platform === 'darwin') {
        // macOSでは -n オプションで必ず新しいウィンドウを開く
        exec(\`\${overlayCommand} "\${overlayUrl}"\`);
      } else {
        // Linuxなど
        exec(\`\${overlayCommand} "\${overlayUrl}"\`);
      }
    }, 1000);

    console.log(\`ブラウザが開きました: \${url}\`);
    console.log(\`オーバーレイ(別ウィンドウ): \${overlayUrl}\`);
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
});`,
  "js/core/event.js": `(function(){
  function Emitter(){ this.listeners = {}; }
  Emitter.prototype.on = function(event, fn){
    (this.listeners[event] ||= new Set()).add(fn); return () => this.off(event, fn);
  };
  Emitter.prototype.off = function(event, fn){
    const set = this.listeners[event]; if (!set) return; set.delete(fn);
  };
  Emitter.prototype.emit = function(event, payload){
    const set = this.listeners[event]; if (!set) return; set.forEach(fn => { try{ fn(payload); }catch(_){} });
  };
  window.MVVM = window.MVVM || {}; window.MVVM.Emitter = Emitter;
})();

`,
  "js/core/model.js": `(function(){
  function MeterState(values, names, icon, icons){
    // Initialize values array with null support (null means device not connected)
    if (Array.isArray(values)) {
      const arr = values.slice(0,6);
      while (arr.length < 6) arr.push(null);
      this.values = arr;
    } else {
      this.values = [null, null, null, null, null, null];
    }
    this.names = Array.isArray(names) ? names.slice(0,6) : ['','','','','',''];
    this.icon = icon || 'assets/icon.svg';
    // Per-index icons (optional). Falls back to single icon if not provided
    if (Array.isArray(icons)) {
      const arr = icons.slice(0,6);
      while (arr.length < 6) arr.push(null);
      this.icons = arr;
    } else {
      this.icons = [null, null, null, null, null, null];
    }
  }
  MeterState.prototype.clone = function(){ return new MeterState(this.values.slice(0,6), this.names.slice(0,6), this.icon, this.icons.slice(0,6)); };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterState = MeterState;
})();

`,
  "js/core/viewModel.js": `(function(){
  const Emitter = (window.MVVM && window.MVVM.Emitter);
  const MeterState = (window.MVVM && window.MVVM.MeterState);

  function MeterViewModel(initial){
    this.emitter = new Emitter();
    this.state = initial instanceof MeterState ? initial : new MeterState();
    this.running = false;
    this.pollIntervalMs = 100; // Fixed at 100ms
    this._timer = null;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Interpolation state for smooth animation
    this._interpolationDuration = 200; // ms
    this._interpolations = []; // Array of { index, startValue, targetValue, startTime, endTime }
    this._animationFrameId = null;
  }

  MeterViewModel.prototype.onChange = function(fn){ return this.emitter.on('change', fn); };
  MeterViewModel.prototype._notify = function(){ this.emitter.emit('change', this.state.clone()); };
  MeterViewModel.prototype.setPollInterval = function(ms){ this.pollIntervalMs = 100; }; // Fixed at 100ms, cannot be changed
  MeterViewModel.prototype.setMinValue = function(v){ 
    let min = Number(v);
    if (!isNaN(min)) {
      // Allow any numeric value, but ensure min < max
      if (min >= this.maxValue) {
        this.maxValue = min + 1;
      }
      this.minValue = min;
      this._notify();
    }
  };
  MeterViewModel.prototype.setMaxValue = function(v){ 
    let max = Number(v);
    if (!isNaN(max)) {
      // Allow any numeric value, but ensure max > min
      if (max <= this.minValue) {
        this.minValue = max - 1;
      }
      this.maxValue = max;
      this._notify();
    }
  };
  MeterViewModel.prototype.setUnit = function(v){ 
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };
  
  // Convert actual value to percentage (0-100) for meter position calculation
  MeterViewModel.prototype.normalizeValue = function(actualValue){
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };
  
  // Convert percentage (0-100) back to actual value
  MeterViewModel.prototype.denormalizeValue = function(percentage){
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };
  MeterViewModel.prototype.setName = function(index, name){
    if (index < 0 || index > 5) return; this.state.names[index] = String(name || '').trim() || this.state.names[index]; this._notify();
  };
  MeterViewModel.prototype.setValue = function(index, value, smooth, isNormalized){
    if (index < 0 || index > 5) return; 
    // Allow null to be set (indicates device not connected)
    if (value === null || value === undefined) {
      // Cancel any interpolation for this index
      this._interpolations = this._interpolations.filter(interp => interp.index !== index);
      this.state.values[index] = null;
      this._notify();
      return;
    }
    
    let normalized;
    if (isNormalized === true) {
      // Value is already normalized (0-100), use it directly
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      // Store actual value, but normalize to 0-100 for internal state
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }
    
    // Check if smooth interpolation is enabled (default: true)
    const useSmooth = smooth !== false;
    
    // Get current normalized value (may be null/undefined)
    const currentNormalized = this.state.values[index];
    
    if (useSmooth && currentNormalized !== null && currentNormalized !== undefined && !isNaN(currentNormalized)) {
      // Start interpolation from current value to target value
      const targetNormalized = normalized;
      
      // Only interpolate if there's a meaningful difference (reduced threshold for smoother animation)
      const diff = Math.abs(currentNormalized - targetNormalized);
      if (diff > 0.01) {
        // Remove any existing interpolation for this index
        this._interpolations = this._interpolations.filter(interp => interp.index !== index);
        
        // Add new interpolation
        const now = performance.now();
        this._interpolations.push({
          index: index,
          startValue: currentNormalized,
          targetValue: targetNormalized,
          startTime: now,
          endTime: now + this._interpolationDuration
        });
        
        // Start animation loop if not already running
        this._startInterpolation();
        return;
      }
    }
    
    // Set value immediately (no interpolation or difference too small)
    this.state.values[index] = normalized;
    this._notify();
  };
  
  // Start interpolation animation loop
  MeterViewModel.prototype._startInterpolation = function(){
    if (this._animationFrameId !== null) return; // Already running
    
    const self = this;
    const animate = function(){
      const now = performance.now();
      let needsUpdate = false;
      
      // Update all active interpolations
      self._interpolations.forEach(interp => {
        if (now >= interp.endTime) {
          // Interpolation complete - set to target value
          if (self.state.values[interp.index] !== interp.targetValue) {
            self.state.values[interp.index] = interp.targetValue;
            needsUpdate = true;
          }
        } else {
          // Interpolate between start and target
          const progress = (now - interp.startTime) / (interp.endTime - interp.startTime);
          const clampedProgress = Math.max(0, Math.min(1, progress)); // Ensure 0-1 range
          const currentValue = interp.startValue + (interp.targetValue - interp.startValue) * clampedProgress;
          self.state.values[interp.index] = currentValue;
          needsUpdate = true;
        }
      });
      
      // Remove completed interpolations
      const beforeCount = self._interpolations.length;
      self._interpolations = self._interpolations.filter(interp => now < interp.endTime);
      
      // Notify listeners if there was an update
      if (needsUpdate) {
        self._notify();
      }
      
      // Continue animation if there are active interpolations
      if (self._interpolations.length > 0) {
        self._animationFrameId = requestAnimationFrame(animate);
      } else {
        self._animationFrameId = null;
      }
    };
    
    this._animationFrameId = requestAnimationFrame(animate);
  };
  
  // Set interpolation duration
  MeterViewModel.prototype.setInterpolationDuration = function(ms){
    this._interpolationDuration = Math.max(0, Math.min(1000, Number(ms) || 200));
  };
  
  // Get actual value (not normalized) for display
  MeterViewModel.prototype.getActualValue = function(index){
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };
  
  // Get all actual values
  MeterViewModel.prototype.getActualValues = function(){
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };
  
  // Get connected device indices (indices where value is not null)
  MeterViewModel.prototype.getConnectedDeviceIndices = function(){
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };
  MeterViewModel.prototype.setIcon = function(path){ if (path) { this.state.icon = path; this._notify(); } };
  MeterViewModel.prototype.setIconAt = function(index, path){
    if (index < 0 || index > 3) return;
    this.state.icons[index] = String(path || '');
    this._notify();
  };

  MeterViewModel.prototype.setState = function(next){
    if (!next) return;
    if (!(next instanceof MeterState)) next = new MeterState(next.values, next.names, next.icon, next.icons);
    this.state = next;
    this._notify();
  };

  MeterViewModel.prototype.toJSON = function(){
    return { values: this.state.values.slice(0,6), names: this.state.names.slice(0,6), icon: this.state.icon, icons: this.state.icons.slice(0,6) };
  };

  MeterViewModel.prototype.start = function(){
    if (this.running) return; this.running = true;
    // Start polling for device data (handled by MonitorBinding)
    this._notify();
  };

  MeterViewModel.prototype.stop = function(){
    if (!this.running) return; this.running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    // Stop interpolation animation
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    // Complete all interpolations immediately
    this._interpolations.forEach(interp => {
      this.state.values[interp.index] = interp.targetValue;
    });
    this._interpolations = [];
    this._notify();
  };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterViewModel = MeterViewModel;
})();

`,
  "js/views/iconRenderer.js": `// Simple placeholder for potential separate icon rendering logic
// Currently handled inside meterRenderer. Expose a tiny API for compatibility.
(function () {
  function getIpForIndex(index) {
    const input = document.getElementById(\`device\${index + 1}-ip\`);
    return (input && input.value && input.value.trim()) || '';
  }

  // Get min/max/unit from DOM
  function getRangeSettings() {
    const minEl = document.getElementById('min-value');
    const maxEl = document.getElementById('max-value');
    const unitEl = document.getElementById('value-unit');
    const minValue = minEl ? Number(minEl.value) : 0;
    const maxValue = maxEl ? Number(maxEl.value) : 100;
    const unit = unitEl ? (unitEl.value || '%') : '%';
    return { minValue, maxValue, unit };
  }

  // Convert normalized percentage (0-100) to actual value based on min/max settings
  function denormalizeValue(percentage, minValue, maxValue) {
    const range = maxValue - minValue;
    if (range === 0) return minValue;
    return minValue + (percentage / 100) * range;
  }

  // Update value display for an icon
  function updateIconValue(g, index) {
    try {
      if (!g) return;
      
      // Get percentage from data attribute (0-100)
      const percentageAttr = g.getAttribute('data-percentage');
      if (!percentageAttr) return; // No percentage data yet
      
      const percentage = parseFloat(percentageAttr);
      if (isNaN(percentage)) return;
      
      // Get range settings
      const { minValue, maxValue, unit } = getRangeSettings();
      
      // Convert to actual value
      const actualValue = denormalizeValue(percentage, minValue, maxValue);
      const roundedValue = Math.round(actualValue);
      
      // Find or create text element
      let textEl = g.querySelector('text.icon-value');
      if (!textEl) {
        // Check if g is in an SVG context
        if (!g.ownerSVGElement && !g.closest('svg')) return;
        
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('class', 'icon-value');
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '15');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('font-weight', '700');
        textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        textEl.setAttribute('fill', '#ffffff');
        textEl.setAttribute('paint-order', 'stroke');
        textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        textEl.setAttribute('stroke-width', '3');
        g.appendChild(textEl);
      }
      
      // Update text content
      textEl.textContent = \`\${roundedValue}\${unit}\`;
      textEl.setAttribute('data-actual', String(roundedValue));
      textEl.setAttribute('data-unit', unit);
    } catch (error) {
      console.error('Error updating icon value:', error);
    }
  }

  // Cache range settings to avoid repeated DOM queries
  let cachedRangeSettings = null;
  let rangeSettingsCacheTime = 0;
  const RANGE_SETTINGS_CACHE_MS = 100; // Cache for 100ms

  function getCachedRangeSettings() {
    const now = Date.now();
    if (!cachedRangeSettings || (now - rangeSettingsCacheTime) > RANGE_SETTINGS_CACHE_MS) {
      cachedRangeSettings = getRangeSettings();
      rangeSettingsCacheTime = now;
    }
    return cachedRangeSettings;
  }

  // Update all icon values
  function updateAllIconValues() {
    try {
      const svg = document.querySelector('#meter-container svg[data-meter]');
      if (!svg) return;
      
      // Get range settings once for all icons
      const { minValue, maxValue, unit } = getCachedRangeSettings();
      
      for (let i = 0; i < 6; i++) {
        const g = svg.querySelector(\`g[data-perf="\${i}"]\`);
        if (g && g.style.display !== 'none') {
          updateIconValueFast(g, i, minValue, maxValue, unit);
        }
      }
    } catch (error) {
      console.error('Error updating all icon values:', error);
    }
  }

  // Fast version that accepts pre-fetched range settings
  function updateIconValueFast(g, index, minValue, maxValue, unit) {
    try {
      if (!g) return;
      
      const percentageAttr = g.getAttribute('data-percentage');
      if (!percentageAttr) return;
      
      const percentage = parseFloat(percentageAttr);
      if (isNaN(percentage)) return;
      
      const actualValue = denormalizeValue(percentage, minValue, maxValue);
      const roundedValue = Math.round(actualValue);
      
      let textEl = g.querySelector('text.icon-value');
      if (!textEl) {
        if (!g.ownerSVGElement && !g.closest('svg')) return;
        
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('class', 'icon-value');
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '15');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('font-weight', '700');
        textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        textEl.setAttribute('fill', '#ffffff');
        textEl.setAttribute('paint-order', 'stroke');
        textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        textEl.setAttribute('stroke-width', '3');
        g.appendChild(textEl);
      }
      
      const newText = \`\${roundedValue}\${unit}\`;
      if (textEl.textContent !== newText) {
        textEl.textContent = newText;
        textEl.setAttribute('data-actual', String(roundedValue));
        textEl.setAttribute('data-unit', unit);
      }
    } catch (error) {
      console.error('Error updating icon value:', error);
    }
  }

  function applyVisibility() {
    try {
      const svg = document.querySelector('#meter-container svg[data-meter]');
      if (!svg) return;
      for (let i = 0; i < 4; i++) {
        const g = svg.querySelector(\`g[data-perf="\${i}"]\`);
        if (!g) continue;
        const hasIp = !!getIpForIndex(i);
        g.style.display = hasIp ? '' : 'none';
      }
      // Update values immediately using requestAnimationFrame for smooth updates
      requestAnimationFrame(() => updateAllIconValues());
    } catch (error) {
      console.error('Error applying visibility:', error);
    }
  }

  function setupListeners() {
    ['device1-ip','device2-ip','device3-ip','device4-ip'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', applyVisibility);
      el.addEventListener('change', applyVisibility);
    });

    // Listen to range settings changes
    ['min-value', 'max-value', 'value-unit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateAllIconValues);
        el.addEventListener('change', updateAllIconValues);
      }
    });

    // Re-apply when meter SVG updates (animations preserved)
    const container = document.getElementById('meter-container');
    if (container && window.MutationObserver) {
      // Track last known values to detect changes
      const lastValues = new Map();
      
      const mo = new MutationObserver((mutations) => {
        try {
          const { minValue, maxValue, unit } = getCachedRangeSettings();
          let hasChildListChange = false;
          
          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'data-percentage' || 
                 mutation.attributeName === 'data-actual')) {
              // Update the specific icon that changed immediately (synchronously)
              const target = mutation.target;
              if (target && target.tagName === 'g' && target.hasAttribute('data-perf')) {
                const index = parseInt(target.getAttribute('data-perf') || '0', 10);
                if (!isNaN(index)) {
                  const percentageAttr = target.getAttribute('data-percentage');
                  if (percentageAttr) {
                    const percentage = parseFloat(percentageAttr);
                    const lastValue = lastValues.get(index);
                    // Only update if value actually changed
                    if (lastValue !== percentage) {
                      lastValues.set(index, percentage);
                      updateIconValueFast(target, index, minValue, maxValue, unit);
                    }
                  }
                }
              }
            } else if (mutation.type === 'childList') {
              hasChildListChange = true;
            }
          });
          
          // If new icons were added, update all
          if (hasChildListChange) {
            requestAnimationFrame(() => updateAllIconValues());
          }
        } catch (error) {
          console.error('Error in MutationObserver:', error);
        }
      });
      mo.observe(container, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['data-percentage', 'data-actual', 'style']
      });
      
      // Also poll for changes as a fallback to ensure real-time updates
      // This catches any changes that MutationObserver might miss
      let lastPollTime = Date.now();
      const pollInterval = 16; // ~60fps
      
      const pollForChanges = () => {
        const now = Date.now();
        if (now - lastPollTime < pollInterval) {
          requestAnimationFrame(pollForChanges);
          return;
        }
        lastPollTime = now;
        
        try {
          const svg = document.querySelector('#meter-container svg[data-meter]');
          if (!svg) {
            requestAnimationFrame(pollForChanges);
            return;
          }
          
          const { minValue, maxValue, unit } = getCachedRangeSettings();
          
          for (let i = 0; i < 6; i++) {
            const g = svg.querySelector(\`g[data-perf="\${i}"]\`);
            if (!g || g.style.display === 'none') continue;
            
            const percentageAttr = g.getAttribute('data-percentage');
            if (!percentageAttr) continue;
            
            const percentage = parseFloat(percentageAttr);
            if (isNaN(percentage)) continue;
            
            const lastValue = lastValues.get(i);
            if (lastValue !== percentage) {
              lastValues.set(i, percentage);
              updateIconValueFast(g, i, minValue, maxValue, unit);
            }
          }
        } catch (error) {
          console.error('Error in polling:', error);
        }
        
        requestAnimationFrame(pollForChanges);
      };
      
      // Start polling
      requestAnimationFrame(pollForChanges);
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupListeners();
        // Use requestAnimationFrame for faster initial render
        requestAnimationFrame(() => {
          applyVisibility();
          updateAllIconValues();
        });
      });
    } else {
      setupListeners();
      requestAnimationFrame(() => {
        applyVisibility();
        updateAllIconValues();
      });
    }
  }

  function placeIcons() {}

  init();
  window.IconRenderer = { placeIcons, applyVisibility, updateAllIconValues };
})();

`,
  "js/views/meterRenderer.js": `// Gradient meter + ticks + icons rendering
// Public API:
//   initMeter(containerEl)
//   updateMeter(values: number[], options?: { names?: string[], icon?: string })

(function () {
  const baseCx = 251.74;
  const baseCy = 168.17;
  const baseRadius = Math.sqrt((503.48 / 2) ** 2 + (168.17 * 0.52) ** 2);
  const strokeWidth = 100;
  const startAngle = -140;
  const endAngle = -40;
  const LANE_OFFSETS = [-40, -20, 0, 20, 40, 60]; // Fallback for max 6 devices
  const MAX_LANE_OFFSET = 30; // Maximum offset from base radius (within meter bounds)
  const MIN_LANE_OFFSET = -30; // Minimum offset from base radius (within meter bounds)

  // Calculate lane offsets dynamically based on device count
  function calculateLaneOffsets(deviceCount) {
    if (deviceCount <= 0) return [];
    if (deviceCount === 1) return [0]; // Center for single device
    // Distribute evenly between MIN_LANE_OFFSET and MAX_LANE_OFFSET
    const offsets = [];
    for (let i = 0; i < deviceCount; i++) {
      const t = deviceCount === 1 ? 0.5 : i / (deviceCount - 1); // 0 to 1
      const offset = MIN_LANE_OFFSET + (MAX_LANE_OFFSET - MIN_LANE_OFFSET) * t;
      offsets.push(offset);
    }
    return offsets;
  }

  const toRadians = (angle) => (angle * Math.PI) / 180;

  function calculateViewBox() { // 外側の円の大きさを計算（アイコンの位置も考慮）
    const outerRadius = baseRadius + strokeWidth / 2;
    const innerRadius = baseRadius - strokeWidth / 2;
    const angles = [startAngle, endAngle];
    for (let angle = Math.ceil(startAngle); angle <= Math.floor(endAngle); angle++) {
      if (angle % 90 === 0) angles.push(angle);
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    angles.forEach(angle => {
      const rad = (angle * Math.PI) / 180;
      const x_outer = baseCx + outerRadius * Math.cos(rad);
      const y_outer = baseCy + outerRadius * Math.sin(rad);
      const x_inner = baseCx + innerRadius * Math.cos(rad);
      const y_inner = baseCy + innerRadius * Math.sin(rad);
      minX = Math.min(minX, x_outer, x_inner);
      maxX = Math.max(maxX, x_outer, x_inner);
      minY = Math.min(minY, y_outer, y_inner);
      maxY = Math.max(maxY, y_outer, y_inner);
    });

    // Consider icon positions (icons are 50x50, with offsets up to 60)
    const maxIconOffset = Math.max(...LANE_OFFSETS.map(Math.abs));
    const iconRadius = 25; // Half of icon size (50/2)
    const maxRadius = baseRadius + maxIconOffset + iconRadius;

    // Check icon positions at start and end angles
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const iconPositions = [
      { x: baseCx + maxRadius * Math.cos(startRad), y: baseCy + maxRadius * Math.sin(startRad) },
      { x: baseCx + maxRadius * Math.cos(endRad), y: baseCy + maxRadius * Math.sin(endRad) }
    ];

    // Also check middle positions for icons
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const angle = startAngle + (endAngle - startAngle) * t;
      const angleRad = toRadians(angle);
      const radius = baseRadius + maxIconOffset;
      const x = baseCx + radius * Math.cos(angleRad);
      const y = baseCy + radius * Math.sin(angleRad);
      minX = Math.min(minX, x - iconRadius);
      maxX = Math.max(maxX, x + iconRadius);
      minY = Math.min(minY, y - iconRadius);
      maxY = Math.max(maxY, y + iconRadius);
    }

    // Add extra padding to ensure icons are never clipped
    const padding = 30; // Increased padding for overlay
    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      offsetX: -minX + padding,
      offsetY: -minY + padding
    };
  }

  const viewBox = calculateViewBox();
  const cx = baseCx + viewBox.offsetX;
  const cy = baseCy + viewBox.offsetY;

  function describeArc() {
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const innerRadius = baseRadius - strokeWidth / 2;
    const outerRadius = baseRadius + strokeWidth / 2;
    const x1 = cx + innerRadius * Math.cos(startRad);
    const y1 = cy + innerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(startRad);
    const y2 = cy + outerRadius * Math.sin(startRad);
    const x3 = cx + outerRadius * Math.cos(endRad);
    const y3 = cy + outerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(endRad);
    const y4 = cy + innerRadius * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return \`M \${x1} \${y1} L \${x2} \${y2} A \${outerRadius} \${outerRadius} 0 \${largeArc} 1 \${x3} \${y3} L \${x4} \${y4} A \${innerRadius} \${innerRadius} 0 \${largeArc} 0 \${x1} \${y1}\`;
  }

  function calculateIconPosition(percentage, laneIndex, deviceCount) {
    const clamped = Math.max(0, Math.min(100, percentage));
    const t = clamped / 100;
    const angle = startAngle + (endAngle - startAngle) * t;
    const angleRad = toRadians(angle);

    // Use dynamic lane offsets if deviceCount is provided, otherwise fallback to fixed offsets
    let laneOffsets;
    if (deviceCount && deviceCount > 0) {
      laneOffsets = calculateLaneOffsets(deviceCount);
    } else {
      laneOffsets = LANE_OFFSETS;
    }

    // Clamp laneIndex to valid range
    const safeLaneIndex = Math.max(0, Math.min(laneOffsets.length - 1, laneIndex));
    const offset = laneOffsets[safeLaneIndex] || 0;
    const radius = baseRadius + offset;
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    return { x, y };
  }

  function updateTickLabels(svg, minValue, maxValue, unit) {
    if (!svg) return;

    // Remove existing label group
    const existingGroup = svg.querySelector('g.tick-labels-group');
    if (existingGroup) {
      existingGroup.remove();
    }

  }

  function ensureSvg(containerEl) {
    let svg = containerEl.querySelector('svg[data-meter]');
    if (svg) return svg;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-meter', '');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', \`0 0 \${viewBox.width} \${viewBox.height}\`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.display = 'block';
    svg.style.verticalAlign = 'middle';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'meterGradient');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', String(viewBox.height / 2));
    gradient.setAttribute('x2', String(viewBox.width));
    gradient.setAttribute('y2', String(viewBox.height / 2));
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s1.setAttribute('offset', '0'); s1.setAttribute('stop-color', '#71cce2');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s2.setAttribute('offset', '1'); s2.setAttribute('stop-color', '#6e40a9');
    gradient.append(s1, s2);

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'iconShadow');
    const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    fe.setAttribute('dx', '0'); fe.setAttribute('dy', '2'); fe.setAttribute('stdDeviation', '3'); fe.setAttribute('flood-opacity', '0.3');
    filter.appendChild(fe);
    // Circle mask for icons (objectBoundingBox units to keep it centered)
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', 'maskIconCircle');
    mask.setAttribute('maskContentUnits', 'objectBoundingBox');
    mask.setAttribute('maskUnits', 'objectBoundingBox');
    const maskCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    maskCircle.setAttribute('cx', '0.5');
    maskCircle.setAttribute('cy', '0.5');
    maskCircle.setAttribute('r', '0.5');
    maskCircle.setAttribute('fill', '#fff');
    mask.appendChild(maskCircle);
    defs.append(gradient, filter, mask);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('data-arc', '');
    path.setAttribute('d', describeArc());
    path.setAttribute('fill', 'url(#meterGradient)');

    svg.append(defs, path);

    // ticks
    const tickCount = 11;
    const totalAngle = endAngle - startAngle;
    for (let i = 1; i < tickCount; i++) {
      const angle = startAngle + (totalAngle / tickCount) * i;
      const angleRad = toRadians(angle);
      const innerR = baseRadius - strokeWidth / 2;
      const outerR = baseRadius - strokeWidth / 2 + 10;
      const x1 = cx + innerR * Math.cos(angleRad);
      const y1 = cy + innerR * Math.sin(angleRad);
      const x2 = cx + outerR * Math.cos(angleRad);
      const y2 = cy + outerR * Math.sin(angleRad);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', '#fff'); line.setAttribute('stroke-width', '3');
      svg.appendChild(line);
    }

    containerEl.innerHTML = '';
    containerEl.appendChild(svg);
    return svg;
  }

  function updateMeter(values, options) {
    const icon = (options && options.icon !== undefined) ? options.icon : null; // Default to null instead of 'assets/icon.svg'
    const icons = (options && options.icons) || null; // per-index icons
    const connectedDeviceIndices = (options && options.connectedDeviceIndices) || null; // null means calculate from values (non-null indices)
    const actualValues = (options && options.actualValues) || null; // Actual values for display (not normalized)
    const unit = (options && options.unit) || '%'; // Unit for display
    const minValue = (options && typeof options.minValue === 'number') ? options.minValue : 0;
    const maxValue = (options && typeof options.maxValue === 'number') ? options.maxValue : 100;

    // Calculate device count from connected device indices
    let deviceCount = 0;
    if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
      deviceCount = connectedDeviceIndices.length;
    } else {
      // If null, count non-null values (including 0)
      deviceCount = values.filter(v => v !== null && v !== undefined && !isNaN(v)).length;
    }
    // If no devices connected, don't render anything (early return)
    if (deviceCount === 0) {
      // Remove all existing icons
      const containerEl = document.getElementById('meter-container');
      const svg = containerEl ? containerEl.querySelector('svg[data-meter]') : null;
      if (svg) {
        svg.querySelectorAll('g[data-perf]').forEach(g => g.remove());
      }
      return;
    }

    // Helper function to convert normalized value (0-100%) to actual value based on min/max settings
    function denormalizeValue(percentage) {
      const range = maxValue - minValue;
      if (range === 0) return minValue; // Avoid division by zero
      return minValue + (percentage / 100) * range;
    }

    const containerEl = document.getElementById('meter-container');
    const svg = ensureSvg(containerEl);

    const existing = new Map();
    svg.querySelectorAll('g[data-perf]').forEach(g => {
      existing.set(g.getAttribute('data-perf'), g);
    });

    values.slice(0, 6).forEach((val, index) => {
      // Skip if value is null (device not connected)
      if (val === null || val === undefined) {
        // Remove icon if it exists
        const existingG = svg.querySelector(\`g[data-perf="\${index}"]\`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      // Skip if this index should be hidden (when connectedDeviceIndices is specified)
      if (connectedDeviceIndices !== null && !connectedDeviceIndices.includes(index)) {
        // Remove icon if it exists
        const existingG = svg.querySelector(\`g[data-perf="\${index}"]\`);
        if (existingG) existingG.remove();
        existing.delete(String(index));
        return;
      }

      // Map index to lane index based on connected device indices
      let laneIndex = 0;
      if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
        const positionInConnected = connectedDeviceIndices.indexOf(index);
        laneIndex = positionInConnected >= 0 ? positionInConnected : 0;
      } else {
        // If no connected device indices specified, use index directly (but limit to deviceCount)
        laneIndex = index % deviceCount;
      }

      const numericVal = Number(val);
      const safeVal = Number.isFinite(numericVal) ? numericVal : 0;
      const pos = calculateIconPosition(safeVal, laneIndex, deviceCount);

      let g = svg.querySelector(\`g[data-perf="\${index}"]\`);
      if (!g) {
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-perf', String(index));
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.style.willChange = 'transform';

        // Background user image (if provided), masked as circle
        const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        const bgHref = (icons && icons[index]) ? icons[index] : '';
        if (bgHref) {
          bgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', bgHref);
          bgImage.setAttribute('href', bgHref);
          bgImage.style.display = 'block';
        } else {
          bgImage.style.display = 'none';
        }
        bgImage.setAttribute('x', String(-25));
        bgImage.setAttribute('y', String(-25));
        bgImage.setAttribute('width', '50');
        bgImage.setAttribute('height', '50');
        bgImage.setAttribute('mask', 'url(#maskIconCircle)');

        // Foreground SVG icon (only if icon is provided)
        let fgImage = null;
        if (icon) {
          fgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          fgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
          fgImage.setAttribute('href', icon);
          fgImage.setAttribute('x', String(-25));
          fgImage.setAttribute('y', String(-25));
          fgImage.setAttribute('width', '50');
          fgImage.setAttribute('height', '50');
          fgImage.setAttribute('filter', 'url(#iconShadow)');
        }

        // Machine-readable attributes for UI parsing
        const displayValue = actualValues && actualValues[index] !== undefined
          ? actualValues[index]
          : denormalizeValue(safeVal);
        const roundedDisplay = Math.round(displayValue);
        g.setAttribute('data-percentage', String(Math.max(0, Math.min(100, safeVal))));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);

        // Append in order: background, foreground (if exists)
        if (fgImage) {
          g.append(bgImage, fgImage);
        } else {
          g.append(bgImage);
        }
        // Set initial transform (no animation on first paint)
        g.setAttribute('transform', \`translate(\${pos.x}, \${pos.y})\`);
        svg.appendChild(g);
      } else {
        // Remove any existing text element(legacy)
        const t = g.querySelector('text');
        if (t) {
          t.remove();
        }
        // Update machine-readable attributes
        const displayValue = actualValues && actualValues[index] !== undefined
          ? actualValues[index]
          : denormalizeValue(safeVal);
        const roundedDisplay = Math.round(displayValue);
        const clampedPercent = Math.max(0, Math.min(100, safeVal));
        g.setAttribute('data-percentage', String(clampedPercent));
        g.setAttribute('data-actual', String(roundedDisplay));
        g.setAttribute('data-unit', unit);
        // Update background user icon and foreground SVG icon
        const imgs = g.querySelectorAll('image');
        // imgs[0] -> bg, imgs[1] -> fg (if exists)
        const bg = imgs[0];
        const fg = imgs.length >= 2 ? imgs[1] : null;

        if (bg) {
          const desiredBg = (icons && icons[index]) ? icons[index] : '';
          if (desiredBg) {
            if (bg.getAttribute('href') !== desiredBg) {
              bg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', desiredBg);
              bg.setAttribute('href', desiredBg);
            }
            bg.style.display = 'block';
          } else {
            // If no bg icon, clear href AND hide
            if (bg.getAttribute('href')) {
              bg.removeAttribute('href');
              bg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
            }
            bg.style.display = 'none';
          }
        }

        // Handle foreground icon
        if (icon) {
          // Icon should be shown
          if (fg) {
            // Update existing foreground icon
            if (fg.getAttribute('href') !== icon) {
              fg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
              fg.setAttribute('href', icon);
            }
          } else {
            // Create new foreground icon
            const newFg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            newFg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
            newFg.setAttribute('href', icon);
            newFg.setAttribute('x', String(-25));
            newFg.setAttribute('y', String(-25));
            newFg.setAttribute('width', '50');
            newFg.setAttribute('height', '50');
            newFg.setAttribute('filter', 'url(#iconShadow)');
            g.appendChild(newFg);
          }
        } else {
          // Icon should be hidden - remove foreground icon if it exists
          if (fg) {
            fg.remove();
          }
        }
        // Trigger transition by changing transform only
        g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        g.setAttribute('transform', \`translate(\${pos.x}, \${pos.y})\`);
      }
      existing.delete(String(index));
    });

    // Remove any extra stale groups
    existing.forEach((g) => g.remove());

    // Update tick labels with min/max values (after all other updates)
    updateTickLabels(svg, minValue, maxValue, unit);
  }

  function initMeter(containerEl) {
    ensureSvg(containerEl);
  }

  window.MeterRenderer = { initMeter, updateMeter };
})();

`,
  "jsconfig.json": `{
  "compilerOptions": {
    // Environment setup & latest features
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,

    // Bundler mode
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,

    // Best practices
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Some stricter flags (disabled by default)
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  }
}
`,
  "overlay.html": `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LeverScope - Overlay</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <script>
      (function(d) {
        var config = { kitId: 'kaz6zgt', scriptTimeout: 3000, async: true },
        h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\bwf-loading\\b/g,"")+" wf-inactive";},config.scriptTimeout),
        tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";
        tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;
        tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};
        s.parentNode.insertBefore(tk,s)
      })(document);
    </script>
    <style>
      html,body{margin:0;padding:0;background:#00ff00;overflow:hidden} /* Green for chroma key */
      .overlay-root{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:#00ff00} /* Green for chroma key */
      .meter-only{width:100%;max-width:1920px;padding:120px;margin:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center} /* Increased padding to prevent icon clipping */
      #meter-container{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
      #meter-container svg{display:block;margin:0 auto}
      /* Optional safe padding for cropping */
      .pad{padding:0}
    </style>
</head>
<body>
  <div class="overlay-root">
    <div id="meter-container" class="meter-only"></div>
  </div>

  <script>window.USE_MVVM = true;</script>
  <script src="src/app/overlayApp.js"></script>
</body>
</html>


`,
  "package-lock.json": `{
  "name": "lever-scope",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "lever-scope",
      "version": "1.0.0",
      "license": "ISC",
      "dependencies": {
        "socket.io-client": "^4.7.5",
        "ws": "^8.18.3"
      },
      "bin": {
        "lever-scope": "start-app.js"
      },
      "devDependencies": {
        "pkg": "^5.8.1"
      }
    },
    "node_modules/@babel/generator": {
      "version": "7.18.2",
      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.18.2.tgz",
      "integrity": "sha512-W1lG5vUwFvfMd8HVXqdfbuG7RuaSrTCCD8cl8fP8wOivdbtbIg2Db3IWUcgvfxKbbn6ZBGYRW/Zk1MIwK49mgw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.18.2",
        "@jridgewell/gen-mapping": "^0.3.0",
        "jsesc": "^2.5.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-string-parser": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz",
      "integrity": "sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-identifier": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.28.5.tgz",
      "integrity": "sha512-qSs4ifwzKJSV39ucNjsvc6WVHs6b7S03sOh2OcHF9UHfVPqWWALUsNUVzhSBiItjRZoLHx7nIarVjqKVusUZ1Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/parser": {
      "version": "7.18.4",
      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.18.4.tgz",
      "integrity": "sha512-FDge0dFazETFcxGw/EXzOkN8uJp0PC7Qbm+Pe9T+av2zlBpOgunFHkQPPn+eRuClU73JF+98D531UgayY89tow==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "parser": "bin/babel-parser.js"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/types": {
      "version": "7.19.0",
      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.19.0.tgz",
      "integrity": "sha512-YuGopBq3ke25BVSiS6fgF49Ul9gH1x70Bcr6bqRLjWCkcX8Hre1/5+z+IiWOIerRMSSEfGZVB9z9kyq7wVs9YA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-string-parser": "^7.18.10",
        "@babel/helper-validator-identifier": "^7.18.6",
        "to-fast-properties": "^2.0.0"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.5.tgz",
      "integrity": "sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@socket.io/component-emitter": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@socket.io/component-emitter/-/component-emitter-3.1.2.tgz",
      "integrity": "sha512-9BCxFwvbGg/RsZK9tjXd8s4UcwR0MWeFQ1XEKIQVVvAGJyINdrqKMcTRyLoK8Rse1GjzLV9cwjWV1olXRWEXVA==",
      "license": "MIT"
    },
    "node_modules/agent-base": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/agent-base/-/agent-base-6.0.2.tgz",
      "integrity": "sha512-RZNwNclF7+MS/8bDg70amg32dyeZGZxiDuQmZxKLAlQjr3jGyLx+4Kkk58UO7D2QdgFIQCovuSuZESne6RG6XQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "debug": "4"
      },
      "engines": {
        "node": ">= 6.0.0"
      }
    },
    "node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
      "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/array-union": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/array-union/-/array-union-2.1.0.tgz",
      "integrity": "sha512-HGyxoOTYUyCM6stUe6EJgnd4EoewAI7zMdfqO+kGjnlZmBDz/cR5pf8r/cR4Wq60sL/p0IkcjUEEPwS3GFrIyw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/at-least-node": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/at-least-node/-/at-least-node-1.0.0.tgz",
      "integrity": "sha512-+q/t7Ekv1EDY2l6Gda6LLiX14rU9TV20Wa3ofeQmwPFZbOMo9DXrLbOjFaaclkXKWidIaopwAObQDqwWtGUjqg==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">= 4.0.0"
      }
    },
    "node_modules/base64-js": {
      "version": "1.5.1",
      "resolved": "https://registry.npmjs.org/base64-js/-/base64-js-1.5.1.tgz",
      "integrity": "sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/bl": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/bl/-/bl-4.1.0.tgz",
      "integrity": "sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "buffer": "^5.5.0",
        "inherits": "^2.0.4",
        "readable-stream": "^3.4.0"
      }
    },
    "node_modules/bl/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/buffer": {
      "version": "5.7.1",
      "resolved": "https://registry.npmjs.org/buffer/-/buffer-5.7.1.tgz",
      "integrity": "sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "base64-js": "^1.3.1",
        "ieee754": "^1.1.13"
      }
    },
    "node_modules/chalk": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.1.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/chalk?sponsor=1"
      }
    },
    "node_modules/chownr": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/chownr/-/chownr-1.1.4.tgz",
      "integrity": "sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/cliui": {
      "version": "7.0.4",
      "resolved": "https://registry.npmjs.org/cliui/-/cliui-7.0.4.tgz",
      "integrity": "sha512-OcRE68cOsVMXp1Yvonl/fzkQOyjLSu/8bhPDfQt0e0/Eb283TKP20Fs2MqoPsr9SwA595rRCA+QMzYc9nBP+JQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "string-width": "^4.2.0",
        "strip-ansi": "^6.0.0",
        "wrap-ansi": "^7.0.0"
      }
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
      "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
      "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/core-util-is": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/core-util-is/-/core-util-is-1.0.3.tgz",
      "integrity": "sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/debug": {
      "version": "4.3.7",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.3.7.tgz",
      "integrity": "sha512-Er2nc/H7RrMXZBFCEim6TCmMk02Z8vLC2Rbi1KEBggpo0fS6l0S1nnapwmIi3yW/+GOJap1Krg4w0Hg80oCqgQ==",
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/decompress-response": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/decompress-response/-/decompress-response-6.0.0.tgz",
      "integrity": "sha512-aW35yZM6Bb/4oJlZncMH2LCoZtJXTRxES17vE3hoRiowU2kWHaJKFkSBDnDR+cm9J+9QhXmREyIfv0pji9ejCQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "mimic-response": "^3.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/deep-extend": {
      "version": "0.6.0",
      "resolved": "https://registry.npmjs.org/deep-extend/-/deep-extend-0.6.0.tgz",
      "integrity": "sha512-LOHxIOaPYdHlJRtCQfDIVZtfw/ufM8+rVj649RIHzcm/vGwQRXFt6OPqIFWsm2XEMrNIEtWR64sY1LEKD2vAOA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4.0.0"
      }
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/dir-glob": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/dir-glob/-/dir-glob-3.0.1.tgz",
      "integrity": "sha512-WkrWp9GR4KXfKGYzOLmTuGVi1UWFfws377n9cc55/tb6DuqyF6pcQ5AbiHEshaDpY9v6oaSr2XCDidGmMwdzIA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-type": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/end-of-stream": {
      "version": "1.4.5",
      "resolved": "https://registry.npmjs.org/end-of-stream/-/end-of-stream-1.4.5.tgz",
      "integrity": "sha512-ooEGc6HP26xXq/N+GCGOT0JKCLDGrq2bQUZrQ7gyrJiZANJ/8YDTxTpQBXGMn+WbIQXNVpyWymm7KYVICQnyOg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "once": "^1.4.0"
      }
    },
    "node_modules/engine.io-client": {
      "version": "6.6.3",
      "resolved": "https://registry.npmjs.org/engine.io-client/-/engine.io-client-6.6.3.tgz",
      "integrity": "sha512-T0iLjnyNWahNyv/lcjS2y4oE358tVS/SYQNxYXGAJ9/GLgH4VCvOQ/mhTjqU88mLZCQgiG8RIegFHYCdVC+j5w==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.1",
        "engine.io-parser": "~5.2.1",
        "ws": "~8.17.1",
        "xmlhttprequest-ssl": "~2.1.1"
      }
    },
    "node_modules/engine.io-client/node_modules/ws": {
      "version": "8.17.1",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.17.1.tgz",
      "integrity": "sha512-6XQFvXTkbfUOZOKKILFG1PDK2NDQs4azKQl26T0YS5CxqWLgXajbPZ+h4gZekJyRqFU8pvnbAbbs/3TgRPy+GQ==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    },
    "node_modules/engine.io-parser": {
      "version": "5.2.3",
      "resolved": "https://registry.npmjs.org/engine.io-parser/-/engine.io-parser-5.2.3.tgz",
      "integrity": "sha512-HqD3yTBfnBxIrbnM1DoD6Pcq8NECnh8d4As1Qgh0z5Gg3jRRIqijury0CL3ghu/edArpUYiYqQiDUQBIs4np3Q==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/expand-template": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/expand-template/-/expand-template-2.0.3.tgz",
      "integrity": "sha512-XYfuKMvj4O35f/pOXLObndIRvyQ+/+6AhODh+OKWj9S9498pHHn/IMszH+gt0fBCRWMNfk1ZSp5x3AifmnI2vg==",
      "dev": true,
      "license": "(MIT OR WTFPL)",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fast-glob": {
      "version": "3.3.3",
      "resolved": "https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.3.tgz",
      "integrity": "sha512-7MptL8U0cqcFdzIzwOTHoilX9x5BrNqye7Z/LuC7kCMRio1EMSyqRK3BEAUD7sXRq4iT4AzTVuZdhgQ2TCvYLg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fastq": {
      "version": "1.19.1",
      "resolved": "https://registry.npmjs.org/fastq/-/fastq-1.19.1.tgz",
      "integrity": "sha512-GwLTyxkCXjXbxqIhTsMI2Nui8huMPtnxg7krajPJAjnEG/iiOS7i+zCtWGZR9G0NBKbXKh6X9m9UIsYX/N6vvQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/from2": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/from2/-/from2-2.3.0.tgz",
      "integrity": "sha512-OMcX/4IC/uqEPVgGeyfN22LJk6AZrMkRZHxcHBMBvHScDGgwTm2GT2Wkgtocyd3JfZffjj2kYUDXXII0Fk9W0g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.1",
        "readable-stream": "^2.0.0"
      }
    },
    "node_modules/fs-constants": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/fs-constants/-/fs-constants-1.0.0.tgz",
      "integrity": "sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fs-extra": {
      "version": "9.1.0",
      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-9.1.0.tgz",
      "integrity": "sha512-hcg3ZmepS30/7BSFqRvoo3DOMQu7IjqxO5nCDt+zM9XWjb33Wg7ziNT+Qvqbuc3+gWpzO02JubVyk2G4Zvo1OQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "at-least-node": "^1.0.0",
        "graceful-fs": "^4.2.0",
        "jsonfile": "^6.0.1",
        "universalify": "^2.0.0"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
      "integrity": "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-caller-file": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/get-caller-file/-/get-caller-file-2.0.5.tgz",
      "integrity": "sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": "6.* || 8.* || >= 10.*"
      }
    },
    "node_modules/github-from-package": {
      "version": "0.0.0",
      "resolved": "https://registry.npmjs.org/github-from-package/-/github-from-package-0.0.0.tgz",
      "integrity": "sha512-SyHy3T1v2NUXn29OsWdxmK6RwHD+vkj3v8en8AOBZ1wBQ/hCAQ5bAQTD02kW4W9tUp/3Qh6J8r9EvntiyCmOOw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/globby": {
      "version": "11.1.0",
      "resolved": "https://registry.npmjs.org/globby/-/globby-11.1.0.tgz",
      "integrity": "sha512-jhIXaOzy1sb8IyocaruWSn1TjmnBVs8Ayhcy83rmxNJ8q2uWKCAj3CnJY+KpGSXCueAPc0i05kVvVKtP1t9S3g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-union": "^2.1.0",
        "dir-glob": "^3.0.1",
        "fast-glob": "^3.2.9",
        "ignore": "^5.2.0",
        "merge2": "^1.4.1",
        "slash": "^3.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
      "integrity": "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/has": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/has/-/has-1.0.4.tgz",
      "integrity": "sha512-qdSAmqLF6209RFj4VVItywPMbm3vWylknmB3nvNiUIs72xAimcM8nVYxYr7ncvZq5qzk9MKIZR8ijqD/1QuYjQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4.0"
      }
    },
    "node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.2.tgz",
      "integrity": "sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/https-proxy-agent": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/https-proxy-agent/-/https-proxy-agent-5.0.1.tgz",
      "integrity": "sha512-dFcAjpTQFgoLMzC2VwU+C/CbS7uRL0lWmxDITmqm7C+7F0Odmj6s9l6alZc6AELXhrnggM2CeWSXHGOdX2YtwA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "agent-base": "6",
        "debug": "4"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/ieee754": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/ieee754/-/ieee754-1.2.1.tgz",
      "integrity": "sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz",
      "integrity": "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/inherits": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
      "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/ini": {
      "version": "1.3.8",
      "resolved": "https://registry.npmjs.org/ini/-/ini-1.3.8.tgz",
      "integrity": "sha512-JV/yugV2uzW5iMRSiZAyDtQd+nxtUnjeLt0acNdw98kKLrvuRVyB80tsREOE7yvGVgalhZ6RNXCmEHkUKBKxew==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/into-stream": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/into-stream/-/into-stream-6.0.0.tgz",
      "integrity": "sha512-XHbaOAvP+uFKUFsOgoNPRjLkwB+I22JFPFe5OjTkQ0nwgj6+pSjb4NmB6VMxaPshLiOf+zcpOCBQuLwC1KHhZA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "from2": "^2.3.0",
        "p-is-promise": "^3.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.9.0",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.9.0.tgz",
      "integrity": "sha512-+5FPy5PnwmO3lvfMb0AsoPaBG+5KHUI0wYFXOtYPnVVVspTFUuMZNfNaNVRt3FZadstu2c8x23vykRW/NBoU6A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has": "^1.0.3"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-fullwidth-code-point": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz",
      "integrity": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/isarray": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/isarray/-/isarray-1.0.0.tgz",
      "integrity": "sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/jsesc": {
      "version": "2.5.2",
      "resolved": "https://registry.npmjs.org/jsesc/-/jsesc-2.5.2.tgz",
      "integrity": "sha512-OYu7XEzjkCQ3C5Ps3QIZsQfNpqoJyZZA99wd9aWd05NCtC5pWOkShK2mkL6HXQR6/Cy2lbNdPlZBpuQHXE63gA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jsesc": "bin/jsesc"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/jsonfile": {
      "version": "6.2.0",
      "resolved": "https://registry.npmjs.org/jsonfile/-/jsonfile-6.2.0.tgz",
      "integrity": "sha512-FGuPw30AdOIUTRMC2OMRtQV+jkVj2cfPqSeWXv1NEAJ1qZ5zb1X6z1mFhbfOB/iy3ssJCD+3KuZ8r8C3uVFlAg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "universalify": "^2.0.0"
      },
      "optionalDependencies": {
        "graceful-fs": "^4.1.6"
      }
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "resolved": "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz",
      "integrity": "sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/mimic-response": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/mimic-response/-/mimic-response-3.1.0.tgz",
      "integrity": "sha512-z0yWI+4FDrrweS8Zmt4Ej5HdJmky15+L2e6Wgn3+iK5fWzb6T3fhNFq2+MeTRb064c6Wr4N/wv0DzQTjNzHNGQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/minimist/-/minimist-1.2.8.tgz",
      "integrity": "sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/mkdirp-classic": {
      "version": "0.5.3",
      "resolved": "https://registry.npmjs.org/mkdirp-classic/-/mkdirp-classic-0.5.3.tgz",
      "integrity": "sha512-gKLcREMhtuZRwRAfqP3RFW+TK4JqApVBtOIftVgjuABpAtpxhPGaDcfvbhNvD0B8iD1oUr/txX35NjcaY6Ns/A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "license": "MIT"
    },
    "node_modules/multistream": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/multistream/-/multistream-4.1.0.tgz",
      "integrity": "sha512-J1XDiAmmNpRCBfIWJv+n0ymC4ABcf/Pl+5YvC5B/D2f/2+8PtHvCNxMPKiQcZyi922Hq69J2YOpb1pTywfifyw==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "once": "^1.4.0",
        "readable-stream": "^3.6.0"
      }
    },
    "node_modules/multistream/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/napi-build-utils": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/napi-build-utils/-/napi-build-utils-1.0.2.tgz",
      "integrity": "sha512-ONmRUqK7zj7DWX0D9ADe03wbwOBZxNAfF20PlGfCWQcD3+/MakShIHrMqx9YwPTfxDdF1zLeL+RGZiR9kGMLdg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/node-abi": {
      "version": "3.85.0",
      "resolved": "https://registry.npmjs.org/node-abi/-/node-abi-3.85.0.tgz",
      "integrity": "sha512-zsFhmbkAzwhTft6nd3VxcG0cvJsT70rL+BIGHWVq5fi6MwGrHwzqKaxXE+Hl2GmnGItnDKPPkO5/LQqjVkIdFg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "semver": "^7.3.5"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/node-fetch": {
      "version": "2.7.0",
      "resolved": "https://registry.npmjs.org/node-fetch/-/node-fetch-2.7.0.tgz",
      "integrity": "sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "whatwg-url": "^5.0.0"
      },
      "engines": {
        "node": "4.x || >=6.0.0"
      },
      "peerDependencies": {
        "encoding": "^0.1.0"
      },
      "peerDependenciesMeta": {
        "encoding": {
          "optional": true
        }
      }
    },
    "node_modules/once": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
      "integrity": "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "wrappy": "1"
      }
    },
    "node_modules/p-is-promise": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/p-is-promise/-/p-is-promise-3.0.0.tgz",
      "integrity": "sha512-Wo8VsW4IRQSKVXsJCn7TomUaVtyfjVDn3nUP7kE967BQk0CwFpdbZs0X0uk5sW9mkBa9eNM7hCMaG93WUAwxYQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/path-parse/-/path-parse-1.0.7.tgz",
      "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/path-type": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-type/-/path-type-4.0.0.tgz",
      "integrity": "sha512-gDKb8aZMDeD/tZWs9P6+q0J9Mwkdl6xMV8TjnGP3qJVJ06bdMgkbBlLU8IdfOsIsFz2BW1rNVT3XuNEl8zPAvw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/picomatch": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.1.tgz",
      "integrity": "sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pkg": {
      "version": "5.8.1",
      "resolved": "https://registry.npmjs.org/pkg/-/pkg-5.8.1.tgz",
      "integrity": "sha512-CjBWtFStCfIiT4Bde9QpJy0KeH19jCfwZRJqHFDFXfhUklCx8JoFmMj3wgnEYIwGmZVNkhsStPHEOnrtrQhEXA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/generator": "7.18.2",
        "@babel/parser": "7.18.4",
        "@babel/types": "7.19.0",
        "chalk": "^4.1.2",
        "fs-extra": "^9.1.0",
        "globby": "^11.1.0",
        "into-stream": "^6.0.0",
        "is-core-module": "2.9.0",
        "minimist": "^1.2.6",
        "multistream": "^4.1.0",
        "pkg-fetch": "3.4.2",
        "prebuild-install": "7.1.1",
        "resolve": "^1.22.0",
        "stream-meter": "^1.0.4"
      },
      "bin": {
        "pkg": "lib-es5/bin.js"
      },
      "peerDependencies": {
        "node-notifier": ">=9.0.1"
      },
      "peerDependenciesMeta": {
        "node-notifier": {
          "optional": true
        }
      }
    },
    "node_modules/pkg-fetch": {
      "version": "3.4.2",
      "resolved": "https://registry.npmjs.org/pkg-fetch/-/pkg-fetch-3.4.2.tgz",
      "integrity": "sha512-0+uijmzYcnhC0hStDjm/cl2VYdrmVVBpe7Q8k9YBojxmR5tG8mvR9/nooQq3QSXiQqORDVOTY3XqMEqJVIzkHA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chalk": "^4.1.2",
        "fs-extra": "^9.1.0",
        "https-proxy-agent": "^5.0.0",
        "node-fetch": "^2.6.6",
        "progress": "^2.0.3",
        "semver": "^7.3.5",
        "tar-fs": "^2.1.1",
        "yargs": "^16.2.0"
      },
      "bin": {
        "pkg-fetch": "lib-es5/bin.js"
      }
    },
    "node_modules/prebuild-install": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/prebuild-install/-/prebuild-install-7.1.1.tgz",
      "integrity": "sha512-jAXscXWMcCK8GgCoHOfIr0ODh5ai8mj63L2nWrjuAgXE6tDyYGnx4/8o/rCgU+B4JSyZBKbeZqzhtwtC3ovxjw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "detect-libc": "^2.0.0",
        "expand-template": "^2.0.3",
        "github-from-package": "0.0.0",
        "minimist": "^1.2.3",
        "mkdirp-classic": "^0.5.3",
        "napi-build-utils": "^1.0.1",
        "node-abi": "^3.3.0",
        "pump": "^3.0.0",
        "rc": "^1.2.7",
        "simple-get": "^4.0.0",
        "tar-fs": "^2.0.0",
        "tunnel-agent": "^0.6.0"
      },
      "bin": {
        "prebuild-install": "bin.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/process-nextick-args": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/process-nextick-args/-/process-nextick-args-2.0.1.tgz",
      "integrity": "sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/progress": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/progress/-/progress-2.0.3.tgz",
      "integrity": "sha512-7PiHtLll5LdnKIMw100I+8xJXR5gW2QwWYkT6iJva0bXitZKa/XMrSbdmg3r2Xnaidz9Qumd0VPaMrZlF9V9sA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/pump": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/pump/-/pump-3.0.3.tgz",
      "integrity": "sha512-todwxLMY7/heScKmntwQG8CXVkWUOdYxIvY2s0VWAAMh/nd8SoYiRaKjlr7+iCs984f2P8zvrfWcDDYVb73NfA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "end-of-stream": "^1.1.0",
        "once": "^1.3.1"
      }
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/rc": {
      "version": "1.2.8",
      "resolved": "https://registry.npmjs.org/rc/-/rc-1.2.8.tgz",
      "integrity": "sha512-y3bGgqKj3QBdxLbLkomlohkvsA8gdAiUQlSBJnBhfn+BPxg4bc62d8TcBW15wavDfgexCgccckhcZvywyQYPOw==",
      "dev": true,
      "license": "(BSD-2-Clause OR MIT OR Apache-2.0)",
      "dependencies": {
        "deep-extend": "^0.6.0",
        "ini": "~1.3.0",
        "minimist": "^1.2.0",
        "strip-json-comments": "~2.0.1"
      },
      "bin": {
        "rc": "cli.js"
      }
    },
    "node_modules/readable-stream": {
      "version": "2.3.8",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-2.3.8.tgz",
      "integrity": "sha512-8p0AUk4XODgIewSi0l8Epjs+EVnWiK7NoDIEGU0HhE7+ZyY8D1IMY7odu5lRrFXGg71L15KG8QrPmum45RTtdA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "core-util-is": "~1.0.0",
        "inherits": "~2.0.3",
        "isarray": "~1.0.0",
        "process-nextick-args": "~2.0.0",
        "safe-buffer": "~5.1.1",
        "string_decoder": "~1.1.1",
        "util-deprecate": "~1.0.1"
      }
    },
    "node_modules/require-directory": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz",
      "integrity": "sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.11",
      "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.22.11.tgz",
      "integrity": "sha512-RfqAvLnMl313r7c9oclB1HhUEAezcpLjz95wFH4LVuhk9JF/r22qmVP9AMmOU4vMX7Q8pN8jwNg/CSpdFnMjTQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve/node_modules/is-core-module": {
      "version": "2.16.1",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.16.1.tgz",
      "integrity": "sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/reusify/-/reusify-1.1.0.tgz",
      "integrity": "sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/run-parallel/-/run-parallel-1.2.0.tgz",
      "integrity": "sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/safe-buffer": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.1.2.tgz",
      "integrity": "sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "7.7.3",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.7.3.tgz",
      "integrity": "sha512-SdsKMrI9TdgjdweUSR9MweHA4EJ8YxHn8DFaDisvhVlUOe4BF1tLD7GAj0lIqWVl+dPb/rExr0Btby5loQm20Q==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/simple-concat": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/simple-concat/-/simple-concat-1.0.1.tgz",
      "integrity": "sha512-cSFtAPtRhljv69IK0hTVZQ+OfE9nePi/rtJmw5UjHeVyVroEqJXP1sFztKUy1qU+xvz3u/sfYJLa947b7nAN2Q==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/simple-get": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/simple-get/-/simple-get-4.0.1.tgz",
      "integrity": "sha512-brv7p5WgH0jmQJr1ZDDfKDOSeWWg+OVypG99A/5vYGPqJ6pxiaHLy8nxtFjBA7oMa01ebA9gfh1uMCFqOuXxvA==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "decompress-response": "^6.0.0",
        "once": "^1.3.1",
        "simple-concat": "^1.0.0"
      }
    },
    "node_modules/slash": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/slash/-/slash-3.0.0.tgz",
      "integrity": "sha512-g9Q1haeby36OSStwb4ntCGGGaKsaVSjQ68fBxoQcutl5fS1vuY18H3wSt3jFyFtrkx+Kz0V1G85A4MyAdDMi2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/socket.io-client": {
      "version": "4.8.1",
      "resolved": "https://registry.npmjs.org/socket.io-client/-/socket.io-client-4.8.1.tgz",
      "integrity": "sha512-hJVXfu3E28NmzGk8o1sHhN3om52tRvwYeidbj7xKy2eIIse5IoKX3USlS6Tqt3BHAtflLIkCQBkzVrEEfWUyYQ==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.2",
        "engine.io-client": "~6.6.1",
        "socket.io-parser": "~4.2.4"
      },
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/socket.io-parser": {
      "version": "4.2.4",
      "resolved": "https://registry.npmjs.org/socket.io-parser/-/socket.io-parser-4.2.4.tgz",
      "integrity": "sha512-/GbIKmo8ioc+NIWIhwdecY0ge+qVBSMdgxGygevmdHj24bsfgtCmcUUcQ5ZzcylGFHsN3k4HB4Cgkl96KVnuew==",
      "license": "MIT",
      "dependencies": {
        "@socket.io/component-emitter": "~3.1.0",
        "debug": "~4.3.1"
      },
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/stream-meter": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/stream-meter/-/stream-meter-1.0.4.tgz",
      "integrity": "sha512-4sOEtrbgFotXwnEuzzsQBYEV1elAeFSO8rSGeTwabuX1RRn/kEq9JVH7I0MRBhKVRR0sJkr0M0QCH7yOLf9fhQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "readable-stream": "^2.1.4"
      }
    },
    "node_modules/string_decoder": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/string_decoder/-/string_decoder-1.1.1.tgz",
      "integrity": "sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "safe-buffer": "~5.1.0"
      }
    },
    "node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-json-comments": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-2.0.1.tgz",
      "integrity": "sha512-4gB8na07fecVVkOI6Rs4e7T6NOTki5EmL7TUduTs6bu3EdnSycntVJ4re8kgZA+wx9IueI2Y11bfbgwtzuE0KQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/supports-color": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
      "integrity": "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/supports-preserve-symlinks-flag/-/supports-preserve-symlinks-flag-1.0.0.tgz",
      "integrity": "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tar-fs": {
      "version": "2.1.4",
      "resolved": "https://registry.npmjs.org/tar-fs/-/tar-fs-2.1.4.tgz",
      "integrity": "sha512-mDAjwmZdh7LTT6pNleZ05Yt65HC3E+NiQzl672vQG38jIrehtJk/J3mNwIg+vShQPcLF/LV7CMnDW6vjj6sfYQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chownr": "^1.1.1",
        "mkdirp-classic": "^0.5.2",
        "pump": "^3.0.0",
        "tar-stream": "^2.1.4"
      }
    },
    "node_modules/tar-stream": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/tar-stream/-/tar-stream-2.2.0.tgz",
      "integrity": "sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "bl": "^4.0.3",
        "end-of-stream": "^1.4.1",
        "fs-constants": "^1.0.0",
        "inherits": "^2.0.3",
        "readable-stream": "^3.1.1"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/tar-stream/node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/to-fast-properties": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/to-fast-properties/-/to-fast-properties-2.0.0.tgz",
      "integrity": "sha512-/OaKK0xYrs3DmxRYqL/yDc+FxFUVYhDlXMhRmv3z915w2HF1tnN1omB354j8VUGO/hbRzyD6Y3sA7v7GS/ceog==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/tr46": {
      "version": "0.0.3",
      "resolved": "https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz",
      "integrity": "sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/tunnel-agent": {
      "version": "0.6.0",
      "resolved": "https://registry.npmjs.org/tunnel-agent/-/tunnel-agent-0.6.0.tgz",
      "integrity": "sha512-McnNiV1l8RYeY8tBgEpuodCC1mLUdbSN+CYBL7kJsJNInOP8UjDDEwdk6Mw60vdLLrr5NHKZhMAOSrR2NZuQ+w==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "safe-buffer": "^5.0.1"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/universalify": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/universalify/-/universalify-2.0.1.tgz",
      "integrity": "sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlRUtConJRlvaw6DuX0wO5Jeko9sWrMBhh+PsYAZ7oXAiOnf/UKogyiw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 10.0.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
      "integrity": "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/webidl-conversions": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-3.0.1.tgz",
      "integrity": "sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==",
      "dev": true,
      "license": "BSD-2-Clause"
    },
    "node_modules/whatwg-url": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/whatwg-url/-/whatwg-url-5.0.0.tgz",
      "integrity": "sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "tr46": "~0.0.3",
        "webidl-conversions": "^3.0.0"
      }
    },
    "node_modules/wrap-ansi": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-7.0.0.tgz",
      "integrity": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.0.0",
        "string-width": "^4.1.0",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/wrap-ansi?sponsor=1"
      }
    },
    "node_modules/wrappy": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz",
      "integrity": "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/ws": {
      "version": "8.18.3",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.18.3.tgz",
      "integrity": "sha512-PEIGCY5tSlUt50cqyMXfCzX+oOPqN0vuGqWzbcJ2xvnkzkq46oOpz7dQaTDBdfICb4N14+GARUDw2XV2N4tvzg==",
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    },
    "node_modules/xmlhttprequest-ssl": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/xmlhttprequest-ssl/-/xmlhttprequest-ssl-2.1.2.tgz",
      "integrity": "sha512-TEU+nJVUUnA4CYJFLvK5X9AOeH4KvDvhIfm0vV1GaQRtchnG0hgK5p8hw/xjv8cunWYCsiPCSDzObPyhEwq3KQ==",
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/y18n": {
      "version": "5.0.8",
      "resolved": "https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz",
      "integrity": "sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yargs": {
      "version": "16.2.0",
      "resolved": "https://registry.npmjs.org/yargs/-/yargs-16.2.0.tgz",
      "integrity": "sha512-D1mvvtDG0L5ft/jGWkLpG1+m0eQxOfaBvTNELraWj22wSVUMWxZUvYgJYcKh6jGGIkJFhH4IZPQhR4TKpc8mBw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cliui": "^7.0.2",
        "escalade": "^3.1.1",
        "get-caller-file": "^2.0.5",
        "require-directory": "^2.1.1",
        "string-width": "^4.2.0",
        "y18n": "^5.0.5",
        "yargs-parser": "^20.2.2"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yargs-parser": {
      "version": "20.2.9",
      "resolved": "https://registry.npmjs.org/yargs-parser/-/yargs-parser-20.2.9.tgz",
      "integrity": "sha512-y11nGElTIV+CT3Zv9t7VKl+Q3hTQoT9a1Qzezhhl6Rp21gJ/IVTW7Z3y9EWXhuUBC2Shnf+DX0antecpAwSP8w==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    }
  }
}
`,
  "package.json": `{
  "name": "lever-scope",
  "version": "1.0.0",
  "description": "レバー位置可視化アプリケーション",
  "main": "integrated-server.js",
  "bin": "integrated-server.js",
  "scripts": {
    "test": "echo \\"Error: no test specified\\" && exit 1",
    "start": "node integrated-server.js",
    "build": "npm run build:servers && npm run build:api",

    "build:servers": "npm run build:http && npm run build:bridge",
    "bundle-static": "node ./bundle-static.js",

    "build:http": "npm run bundle-static && npm run build:http:win && npm run build:http:mac",
    "build:http:win": "bun build ./http-server-bundled.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverHTTP.exe",
    "build:http:mac": "bun build ./http-server-bundled.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverHTTP",

    "build:http:nobundle": "npm run build:http:nobundle:win && npm run build:http:nobundle:mac",
    "build:http:nobundle:win": "bun build ./http-server.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverHTTP.exe",
    "build:http:nobundle:mac": "bun build ./http-server.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverHTTP",

    "build:bridge": "npm run build:bridge:win && npm run build:bridge:mac",
    "build:bridge:win": "bun build ./bridge-server.js --compile --target=bun-windows-x64 --outfile ../app/Windows/LeverBridge.exe",
    "build:bridge:mac": "bun build ./bridge-server.js --compile --target=bun-darwin-arm64 --outfile ../app/macOS/LeverBridge",

    "build:api": "npm run build:api:win || npm run build:api:mac",
    "build:api:win": "cd ../LeverAPI && python -m PyInstaller --onefile --collect-submodules=dns --collect-submodules=eventlet --hidden-import=engineio.async_drivers.eventlet --hidden-import=api.discovery --hidden-import=api.device_manager --hidden-import=api.transformers --hidden-import=api.cache --name LeverAPI app.py && copy /Y dist\\\\LeverAPI.exe ..\\\\app\\\\Windows\\\\",
    "build:api:mac": "cd ../LeverAPI && python3 -m PyInstaller --onefile --collect-submodules=dns --collect-submodules=eventlet --hidden-import=engineio.async_drivers.eventlet --hidden-import=api.discovery --hidden-import=api.device_manager --hidden-import=api.transformers --hidden-import=api.cache --name LeverAPI app.py && cp dist/LeverAPI ../app/macOS/",
    "build:all": "npm run build && npm run build:servers && npm run build:api",
    "build:all:win": "npm run build:win && npm run build:http:win && npm run build:bridge:win && npm run build:api:win",
    "build:all:mac": "npm run build:mac && npm run build:http:mac && npm run build:bridge:mac && npm run build:api:mac"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/notMelonBread/positionVisualizer.git"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "bugs": {
    "url": "https://github.com/notMelonBread/positionVisualizer/issues"
  },
  "homepage": "https://github.com/notMelonBread/positionVisualizer#readme",
  "dependencies": {
    "ws": "^8.18.3",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "private": true,
  "peerDependencies": {
    "typescript": "^5"
  }
}
`,
  "src/app/main.js": `/**
 * main.js - Application Entry Point
 * メインページのエントリーポイント
 */
(function() {
  'use strict';

  /**
   * スクリプトを動的に読み込む
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (src.includes('meterRenderer.js') && window.MeterRenderer) {
        resolve();
        return;
      }
      if (src.includes('iconRenderer.js') && window.IconRenderer) {
        resolve();
        return;
      }
      if (src.includes('event.js') && window.MVVM && window.MVVM.Emitter) {
        resolve();
        return;
      }
      if (src.includes('model.js') && window.MVVM && window.MVVM.MeterState) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      const cacheBuster = '?v=' + Date.now();
      script.src = src + cacheBuster;
      script.onload = resolve;
      script.onerror = () => {
        console.error('Failed to load script:', src);
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Domain Layerを読み込む
   */
  async function loadDomainLayer() {
    const domainScripts = [
      'src/domain/ValueRange.js',
      'src/domain/DeviceConfig.js',
      'src/domain/DeviceState.js',
      'src/domain/SessionLog.js',
      'src/domain/LogEntry.js'
    ];

    for (const src of domainScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Infra Layerを読み込む
   */
  async function loadInfraLayer() {
    const infraScripts = [
      'src/infra/repositories/DeviceStateRepository.js',
      'src/infra/repositories/ValueRangeRepository.js',
      'src/infra/repositories/DeviceConfigRepository.js',
      'src/infra/repositories/SessionLogRepository.js',
      'src/infra/bridge/WebSocketBridgeClient.js',
      'src/infra/bridge/HttpPollingClient.js',
      'src/infra/storage/LogFileStorage.js',
      'src/infra/storage/SettingsStorage.js',
      'src/infra/sync/OverlayChannel.js'
    ];

    for (const src of infraScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * UseCase Layerを読み込む
   */
  async function loadUseCaseLayer() {
    const useCaseScripts = [
      'src/usecases/LiveMonitorService.js',
      'src/usecases/RecordingService.js',
      'src/usecases/ReplayService.js',
      'src/usecases/SettingsService.js',
      'src/usecases/IconService.js'
    ];

    for (const src of useCaseScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Presentation Layerを読み込む
   */
  async function loadPresentationLayer() {
    // Legacy MVVM modules (for compatibility)
    const legacyScripts = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/views/meterRenderer.js',
      'js/views/iconRenderer.js'
    ];

    for (const src of legacyScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // New Presentation Layer
    const presentationScripts = [
      'src/presentation/viewmodels/MainPageViewModel.js',
      'src/presentation/bindings/MainPageBindings.js'
    ];

    for (const src of presentationScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * アプリケーションを初期化
   */
  async function initApp() {
    try {
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
      }

      // Load all layers in order
      await loadDomainLayer();
      await loadInfraLayer();
      await loadUseCaseLayer();
      await loadPresentationLayer();

      // Verify required modules
      if (!window.ValueRange || !window.DeviceConfig || !window.DeviceState || 
          !window.SessionLog || !window.LogEntry) {
        throw new Error('Domain Layer modules failed to load');
      }

      if (!window.DeviceStateRepository || !window.ValueRangeRepository || 
          !window.DeviceConfigRepository || !window.SessionLogRepository) {
        throw new Error('Infra Layer repositories failed to load');
      }

      if (!window.LogFileStorage || !window.SettingsStorage) {
        throw new Error('Infra Layer storage failed to load');
      }

      if (!window.LiveMonitorService || !window.RecordingService || 
          !window.ReplayService || !window.SettingsService || !window.IconService) {
        throw new Error('UseCase Layer services failed to load');
      }

      if (!window.MainPageViewModel || !window.MainPageBindings) {
        throw new Error('Presentation Layer modules failed to load');
      }

      // Initialize repositories (Infra Layer)
      const deviceStateRepository = new window.DeviceStateRepository();
      const valueRangeRepository = new window.ValueRangeRepository(0, 100, '%');
      const deviceConfigRepository = new window.DeviceConfigRepository();
      const sessionLogRepository = new window.SessionLogRepository();

      // Initialize storage (Infra Layer)
      const logFileStorage = new window.LogFileStorage();
      const settingsStorage = new window.SettingsStorage();

      // Initialize clients (Infra Layer)
      const webSocketClient = new window.WebSocketBridgeClient();
      const overlayChannel = new window.OverlayChannel();

      // Initialize UseCase services
      const liveMonitorService = new window.LiveMonitorService(deviceStateRepository, valueRangeRepository);
      const recordingService = new window.RecordingService(sessionLogRepository, logFileStorage);
      const replayService = new window.ReplayService(logFileStorage, deviceStateRepository);
      const settingsService = new window.SettingsService(valueRangeRepository);
      const iconService = new window.IconService(deviceConfigRepository);

      // Initialize initial state from DOM
      const initialNames = [];
      for (let i = 1; i <= 6; i++) {
        const el = document.getElementById(\`device\${i}-name\`);
        initialNames.push(el ? (el.value || '') : '');
      }

      // Create initial MeterState (legacy compatibility)
      const MeterState = window.MVVM && window.MVVM.MeterState;
      const initial = new MeterState(
        [],
        initialNames,
        null
      );

      // Initialize ViewModel (Presentation Layer)
      const viewModel = new window.MainPageViewModel(
        initial,
        liveMonitorService,
        recordingService,
        replayService,
        settingsService,
        iconService
      );

      // Initialize bindings (Presentation Layer)
      const mainPageBindings = new window.MainPageBindings(
        viewModel,
        liveMonitorService,
        recordingService,
        replayService,
        settingsService,
        iconService,
        webSocketClient,
        overlayChannel
      );
      mainPageBindings.attach();

      // Initialize UI bindings (legacy compatibility)
      if (window.MVVM && window.MVVM.Bindings) {
        const uiBinding = new window.MVVM.Bindings.UIBinding(viewModel);
        uiBinding.monitorBinding = mainPageBindings; // For recording compatibility
        uiBinding.attach();
      }

      // Start monitoring
      viewModel.start();

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      // Show error message to user
      const container = document.querySelector('.container');
      if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'padding: 20px; background: #ffebee; color: #c62828; border-radius: 8px; margin: 20px;';
        errorDiv.innerHTML = '<h3>初期化エラー</h3><p>アプリケーションの初期化に失敗しました。コンソールを確認してください。</p>';
        container.insertBefore(errorDiv, container.firstChild);
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

`,
  "src/app/overlayApp.js": `/**
 * overlayApp.js - Application Entry Point
 * オーバーレイウィンドウのエントリーポイント
 */
(function() {
  'use strict';

  /**
   * スクリプトを動的に読み込む
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (src.includes('meterRenderer.js') && window.MeterRenderer) {
        resolve();
        return;
      }
      if (src.includes('iconRenderer.js') && window.IconRenderer) {
        resolve();
        return;
      }
      if (src.includes('event.js') && window.MVVM && window.MVVM.Emitter) {
        resolve();
        return;
      }
      if (src.includes('model.js') && window.MVVM && window.MVVM.MeterState) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      const cacheBuster = '?v=' + Date.now();
      script.src = src + cacheBuster;
      script.onload = resolve;
      script.onerror = () => {
        console.error('Failed to load script:', src);
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Domain Layerを読み込む
   */
  async function loadDomainLayer() {
    const domainScripts = [
      'src/domain/ValueRange.js',
      'src/domain/DeviceConfig.js',
      'src/domain/DeviceState.js',
      'src/domain/SessionLog.js',
      'src/domain/LogEntry.js'
    ];

    for (const src of domainScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Infra Layerを読み込む
   */
  async function loadInfraLayer() {
    const infraScripts = [
      'src/infra/repositories/DeviceStateRepository.js',
      'src/infra/repositories/ValueRangeRepository.js',
      'src/infra/bridge/WebSocketBridgeClient.js',
      'src/infra/bridge/HttpPollingClient.js',
      'src/infra/storage/LogFileStorage.js',
      'src/infra/sync/OverlayChannel.js'
    ];

    for (const src of infraScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * UseCase Layerを読み込む
   */
  async function loadUseCaseLayer() {
    const useCaseScripts = [
      'src/usecases/ReplayService.js',
      'src/usecases/SettingsService.js'
    ];

    for (const src of useCaseScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Presentation Layerを読み込む
   */
  async function loadPresentationLayer() {
    // Legacy MVVM modules (for compatibility)
    const legacyScripts = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/views/meterRenderer.js',
      'js/views/iconRenderer.js'
    ];

    for (const src of legacyScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // New Presentation Layer
    const presentationScripts = [
      'src/presentation/viewmodels/OverlayViewModel.js',
      'src/presentation/bindings/OverlayBindings.js'
    ];

    for (const src of presentationScripts) {
      await loadScript(src);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * アプリケーションを初期化
   */
  async function initOverlayApp() {
    try {
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
      }

      // Load all layers in order
      await loadDomainLayer();
      await loadInfraLayer();
      await loadUseCaseLayer();
      await loadPresentationLayer();

      // Verify required modules
      if (!window.ValueRange || !window.DeviceState) {
        throw new Error('Domain Layer modules failed to load');
      }

      if (!window.DeviceStateRepository || !window.ValueRangeRepository) {
        throw new Error('Infra Layer repositories failed to load');
      }

      if (!window.LogFileStorage) {
        throw new Error('Infra Layer storage failed to load');
      }

      if (!window.ReplayService || !window.SettingsService) {
        throw new Error('UseCase Layer services failed to load');
      }

      if (!window.OverlayViewModel || !window.OverlayBindings) {
        throw new Error('Presentation Layer modules failed to load');
      }

      // Initialize repositories (Infra Layer)
      const valueRangeRepository = new window.ValueRangeRepository(0, 100, '%');
      const deviceStateRepository = new window.DeviceStateRepository();

      // Initialize storage (Infra Layer)
      const logFileStorage = new window.LogFileStorage();

      // Initialize clients (Infra Layer)
      const webSocketClient = new window.WebSocketBridgeClient();
      const httpPollingClient = new window.HttpPollingClient();
      const overlayChannel = new window.OverlayChannel();

      // Initialize UseCase services
      const replayService = new window.ReplayService(logFileStorage, deviceStateRepository);
      const settingsService = new window.SettingsService(valueRangeRepository);

      // Create initial MeterState (legacy compatibility)
      const MeterState = window.MVVM && window.MVVM.MeterState;
      const initial = new MeterState([], ['','','','','',''], null);

      // Initialize ViewModel (Presentation Layer)
      const viewModel = new window.OverlayViewModel(
        initial,
        replayService,
        settingsService
      );

      // Initialize bindings (Presentation Layer)
      const overlayBindings = new window.OverlayBindings(
        viewModel,
        webSocketClient,
        httpPollingClient,
        overlayChannel
      );
      overlayBindings.attach();

      console.log('Overlay application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize overlay application:', error);
      // Show error message
      const container = document.getElementById('meter-container');
      if (container) {
        container.innerHTML = '<div style="padding: 20px; color: #c62828;">初期化エラー: コンソールを確認してください</div>';
      }
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initOverlayApp);
  } else {
    initOverlayApp();
  }
})();

`,
  "src/domain/DeviceConfig.js": `/**
 * DeviceConfig - Domain Model
 * デバイスの設定情報（IP、アイコンURLなど）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function DeviceConfig(id, ip, iconUrl, name) {
    this.id = id || null;
    this.ip = String(ip || '').trim();
    this.iconUrl = String(iconUrl || '').trim();
    this.name = String(name || '').trim();
  }

  /**
   * デバイスが設定されているかどうか
   */
  DeviceConfig.prototype.isConfigured = function() {
    return this.ip.length > 0 || this.name.length > 0;
  };

  /**
   * クローンを作成
   */
  DeviceConfig.prototype.clone = function() {
    return new DeviceConfig(this.id, this.ip, this.iconUrl, this.name);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceConfig;
  } else {
    window.DeviceConfig = DeviceConfig;
  }
})();

`,
  "src/domain/DeviceState.js": `/**
 * DeviceState - Domain Model
 * デバイスの状態（正規化値、実際の値、接続状態）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function DeviceState(index, normalizedValue, actualValue, connected) {
    this.index = Number(index) || 0;
    this.normalizedValue = normalizedValue !== null && normalizedValue !== undefined ? Number(normalizedValue) : null;
    this.actualValue = actualValue !== null && actualValue !== undefined ? Number(actualValue) : null;
    this.connected = Boolean(connected);
  }

  /**
   * デバイスが接続されているかどうか
   */
  DeviceState.prototype.isConnected = function() {
    return this.connected && this.normalizedValue !== null;
  };

  /**
   * 値が更新されたかどうか
   */
  DeviceState.prototype.hasChanged = function(other) {
    if (!other || !(other instanceof DeviceState)) return true;
    return this.normalizedValue !== other.normalizedValue ||
           this.actualValue !== other.actualValue ||
           this.connected !== other.connected;
  };

  /**
   * クローンを作成
   */
  DeviceState.prototype.clone = function() {
    return new DeviceState(this.index, this.normalizedValue, this.actualValue, this.connected);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceState;
  } else {
    window.DeviceState = DeviceState;
  }
})();

`,
  "src/domain/LogEntry.js": `/**
 * LogEntry - Domain Model
 * ログエントリ（タイムスタンプ、正規化値、id）を表す純粋なデータクラス
 */
(function () {
  'use strict';

  function LogEntry(timestamp, id, value) {
    this.timestamp = timestamp ? new Date(timestamp) : new Date();
    this.id = id;
    this.value = value;
  }

  /**
   * クローンを作成
   */
  LogEntry.prototype.clone = function () {
    return new LogEntry(this.timestamp, this.id, this.value);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogEntry;
  } else {
    window.LogEntry = LogEntry;
  }
})();

`,
  "src/domain/SessionLog.js": `/**
 * SessionLog - Domain Model
 * セッションログ（開始時刻、終了時刻、ログエントリのリスト）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function SessionLog(startedAt, endedAt, entries) {
    this.startedAt = startedAt ? new Date(startedAt) : new Date();
    this.endedAt = endedAt ? new Date(endedAt) : null;
    this.entries = Array.isArray(entries) ? entries.slice() : [];
  }

  /**
   * ログエントリを追加
   */
  SessionLog.prototype.addEntry = function(entry) {
    if (entry && typeof entry.timestamp !== 'undefined') {
      this.entries.push(entry);
    }
  };

  /**
   * セッションが終了しているかどうか
   */
  SessionLog.prototype.isEnded = function() {
    return this.endedAt !== null;
  };

  /**
   * セッションを終了
   */
  SessionLog.prototype.end = function() {
    if (!this.isEnded()) {
      this.endedAt = new Date();
    }
  };

  /**
   * エントリ数を取得
   */
  SessionLog.prototype.getEntryCount = function() {
    return this.entries.length;
  };

  /**
   * クローンを作成
   */
  SessionLog.prototype.clone = function() {
    return new SessionLog(this.startedAt, this.endedAt, this.entries.slice());
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionLog;
  } else {
    window.SessionLog = SessionLog;
  }
})();

`,
  "src/domain/ValueRange.js": `/**
 * ValueRange - Domain Model
 * 値の範囲（最小値、最大値、単位）を表す純粋なデータクラス
 */
(function() {
  'use strict';

  function ValueRange(min, max, unit) {
    this.min = Number(min) || 0;
    this.max = Number(max) || 100;
    this.unit = String(unit || '%').trim() || '%';
    
    // Validation: ensure min < max
    if (this.min >= this.max) {
      this.max = this.min + 1;
    }
  }

  /**
   * 実際の値を0-100の正規化値に変換
   */
  ValueRange.prototype.normalize = function(actualValue) {
    const range = this.max - this.min;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.min) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値（0-100）を実際の値に変換
   */
  ValueRange.prototype.denormalize = function(normalizedValue) {
    const range = this.max - this.min;
    return this.min + (normalizedValue / 100) * range;
  };

  /**
   * 値が範囲内かどうかをチェック
   */
  ValueRange.prototype.isInRange = function(value) {
    return value >= this.min && value <= this.max;
  };

  /**
   * クローンを作成
   */
  ValueRange.prototype.clone = function() {
    return new ValueRange(this.min, this.max, this.unit);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueRange;
  } else {
    window.ValueRange = ValueRange;
  }
})();

`,
  "src/infra/bridge/HttpPollingClient.js": `/**
 * HttpPollingClient - Infra Layer
 * HTTPポーリングでブリッジサーバーから状態を取得するクライアント
 */
(function() {
  'use strict';

  function HttpPollingClient(url, interval) {
    this.url = url || 'http://127.0.0.1:8123/state';
    this.interval = interval || 1500; // Default 1.5 seconds
    this.pollTimer = null;
    this.subscribers = [];
    this.isPolling = false;
  }

  /**
   * ポーリングを開始
   */
  HttpPollingClient.prototype.start = function() {
    if (this.isPolling) return;
    this.isPolling = true;
    this._poll();
  };

  /**
   * ポーリングを停止
   */
  HttpPollingClient.prototype.stop = function() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  };

  /**
   * ポーリング実行
   */
  HttpPollingClient.prototype._poll = function() {
    if (!this.isPolling) return;

    fetch(this.url, { cache: 'no-store' })
      .then(response => {
        if (!response || !response.ok) {
          throw new Error(\`HTTP \${response.status}\`);
        }
        return response.json();
      })
      .then(data => {
        this._notifySubscribers({ type: 'data', data });
      })
      .catch(error => {
        this._notifySubscribers({ type: 'error', error });
      })
      .finally(() => {
        if (this.isPolling) {
          this.pollTimer = setTimeout(() => {
            this.pollTimer = null;
            this._poll();
          }, this.interval);
        }
      });
  };

  /**
   * イベントを購読
   */
  HttpPollingClient.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  HttpPollingClient.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  HttpPollingClient.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HttpPollingClient;
  } else {
    window.HttpPollingClient = HttpPollingClient;
  }
})();

`,
  "src/infra/bridge/WebSocketBridgeClient.js": `/**
 * WebSocketBridgeClient - Infra Layer
 * WebSocket経由でブリッジサーバーと通信するクライアント
 */
(function() {
  'use strict';

  function WebSocketBridgeClient(url) {
    this.url = url || 'ws://127.0.0.1:8123';
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 1500;
    this.subscribers = [];
    this.isConnected = false;
  }

  /**
   * 接続を確立
   */
  WebSocketBridgeClient.prototype.connect = function() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          try {
            this.ws.close();
          } catch (e) {}
          this.ws = null;
        }

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
          this.isConnected = true;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this._notifySubscribers({ type: 'connected' });
          resolve();
        };

        ws.onclose = () => {
          this.isConnected = false;
          this._notifySubscribers({ type: 'disconnected' });
          // Auto-reconnect
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect().catch(() => {}); // Ignore errors during reconnect
            }, this.reconnectDelay);
          }
        };

        ws.onerror = (error) => {
          this._notifySubscribers({ type: 'error', error });
          try {
            ws.close();
          } catch (e) {}
          reject(error);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this._notifySubscribers({ type: 'message', data });
          } catch (e) {
            // Not JSON or invalid format, ignore
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * メッセージを送信
   */
  WebSocketBridgeClient.prototype.send = function(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(message);
        return true;
      } catch (e) {
        console.error('Failed to send message:', e);
        return false;
      }
    }
    return false;
  };

  /**
   * 接続を切断
   */
  WebSocketBridgeClient.prototype.disconnect = function() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  };

  /**
   * イベントを購読
   */
  WebSocketBridgeClient.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  WebSocketBridgeClient.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  WebSocketBridgeClient.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketBridgeClient;
  } else {
    window.WebSocketBridgeClient = WebSocketBridgeClient;
  }
})();

`,
  "src/infra/repositories/DeviceConfigRepository.js": `/**
 * DeviceConfigRepository - Infra Layer
 * DeviceConfigの永続化を管理するRepository
 */
(function() {
  'use strict';

  const DeviceConfig = window.DeviceConfig || (typeof module !== 'undefined' && module.exports ? require('../../domain/DeviceConfig') : null);

  function DeviceConfigRepository() {
    this.configs = new Array(6).fill(null).map((_, i) => {
      return new DeviceConfig(i, '', '', '');
    });
  }

  /**
   * インデックスで取得
   */
  DeviceConfigRepository.prototype.getByIndex = function(index) {
    if (index < 0 || index >= 6) return null;
    return this.configs[index];
  };

  /**
   * デバイスIDで取得
   */
  DeviceConfigRepository.prototype.getByDeviceId = function(deviceId) {
    const index = this._deviceIdToIndex(deviceId);
    if (index >= 0 && index < 6) {
      return this.configs[index];
    }
    return null;
  };

  /**
   * すべての設定を取得
   */
  DeviceConfigRepository.prototype.getAll = function() {
    return this.configs.slice();
  };

  /**
   * 設定を保存
   */
  DeviceConfigRepository.prototype.save = function(config) {
    if (!config || !(config instanceof DeviceConfig)) return;
    if (config.id >= 0 && config.id < 6) {
      this.configs[config.id] = config;
    }
  };

  /**
   * デバイスIDをインデックスに変換
   */
  DeviceConfigRepository.prototype._deviceIdToIndex = function(deviceId) {
    if (!deviceId) return -1;
    const match = String(deviceId).match(/(\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceConfigRepository;
  } else {
    window.DeviceConfigRepository = DeviceConfigRepository;
  }
})();

`,
  "src/infra/repositories/DeviceStateRepository.js": `/**
 * DeviceStateRepository - Infra Layer
 * DeviceStateの永続化を管理するRepository
 */
(function() {
  'use strict';

  const DeviceState = window.DeviceState || (typeof module !== 'undefined' && module.exports ? require('../../domain/DeviceState') : null);

  function DeviceStateRepository() {
    this.states = new Map(); // Map<deviceId, DeviceState>
    this.statesByIndex = new Array(6).fill(null); // Array<DeviceState>
  }

  /**
   * デバイスIDで取得
   */
  DeviceStateRepository.prototype.getByDeviceId = function(deviceId) {
    if (!this.states.has(deviceId)) {
      // インデックスを推測
      const index = this._deviceIdToIndex(deviceId);
      const state = new DeviceState(index, null, null, false);
      this.states.set(deviceId, state);
      if (index >= 0 && index < 6) {
        this.statesByIndex[index] = state;
      }
    }
    return this.states.get(deviceId);
  };

  /**
   * インデックスで取得
   */
  DeviceStateRepository.prototype.getByIndex = function(index) {
    if (index < 0 || index >= 6) return null;
    
    if (!this.statesByIndex[index]) {
      const deviceId = \`lever\${index + 1}\`;
      const state = new DeviceState(index, null, null, false);
      this.states.set(deviceId, state);
      this.statesByIndex[index] = state;
    }
    return this.statesByIndex[index];
  };

  /**
   * すべての状態を取得
   */
  DeviceStateRepository.prototype.getAll = function() {
    return Array.from(this.states.values());
  };

  /**
   * 状態を保存
   */
  DeviceStateRepository.prototype.save = function(deviceState) {
    if (!deviceState || !(deviceState instanceof DeviceState)) return;
    
    this.states.set(\`lever\${deviceState.index + 1}\`, deviceState);
    if (deviceState.index >= 0 && deviceState.index < 6) {
      this.statesByIndex[deviceState.index] = deviceState;
    }
  };

  /**
   * デバイスIDをインデックスに変換
   */
  DeviceStateRepository.prototype._deviceIdToIndex = function(deviceId) {
    if (!deviceId) return -1;
    const match = String(deviceId).match(/(\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        return num - 1;
      }
    }
    return -1;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceStateRepository;
  } else {
    window.DeviceStateRepository = DeviceStateRepository;
  }
})();

`,
  "src/infra/repositories/SessionLogRepository.js": `/**
 * SessionLogRepository - Infra Layer
 * SessionLogの永続化を管理するRepository
 */
(function() {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../../domain/SessionLog') : null);

  function SessionLogRepository() {
    this.sessions = [];
    this.currentSession = null;
  }

  /**
   * セッションを保存
   */
  SessionLogRepository.prototype.save = function(sessionLog) {
    if (!sessionLog || !(sessionLog instanceof SessionLog)) return;
    
    // 既存のセッションを更新
    const startedAtTime = sessionLog.startedAt instanceof Date ? sessionLog.startedAt.getTime() : sessionLog.startedAt;
    const index = this.sessions.findIndex(s => {
      const sTime = s.startedAt instanceof Date ? s.startedAt.getTime() : s.startedAt;
      return sTime === startedAtTime;
    });
    if (index >= 0) {
      this.sessions[index] = sessionLog;
    } else {
      this.sessions.push(sessionLog);
    }
    
    this.currentSession = sessionLog;
  };

  /**
   * 現在のセッションを取得
   */
  SessionLogRepository.prototype.getCurrent = function() {
    return this.currentSession;
  };

  /**
   * すべてのセッションを取得
   */
  SessionLogRepository.prototype.getAll = function() {
    return this.sessions.slice();
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionLogRepository;
  } else {
    window.SessionLogRepository = SessionLogRepository;
  }
})();

`,
  "src/infra/repositories/ValueRangeRepository.js": `/**
 * ValueRangeRepository - Infra Layer
 * ValueRangeの永続化を管理するRepository
 */
(function() {
  'use strict';

  const ValueRange = window.ValueRange || (typeof module !== 'undefined' && module.exports ? require('../../domain/ValueRange') : null);

  function ValueRangeRepository(defaultMin, defaultMax, defaultUnit) {
    this.valueRange = new ValueRange(defaultMin || 0, defaultMax || 100, defaultUnit || '%');
  }

  /**
   * ValueRangeを取得
   */
  ValueRangeRepository.prototype.get = function() {
    return this.valueRange;
  };

  /**
   * ValueRangeを保存
   */
  ValueRangeRepository.prototype.save = function(valueRange) {
    if (valueRange && valueRange instanceof ValueRange) {
      this.valueRange = valueRange;
    }
  };

  /**
   * ValueRangeを更新
   */
  ValueRangeRepository.prototype.update = function(min, max, unit) {
    this.valueRange = new ValueRange(min, max, unit);
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueRangeRepository;
  } else {
    window.ValueRangeRepository = ValueRangeRepository;
  }
})();

`,
  "src/infra/storage/LogFileStorage.js": `/**
 * LogFileStorage - Infra Layer
 * ログファイルの保存・読み込みを管理するストレージ
 */
(function() {
  'use strict';

  function LogFileStorage(serverUrl) {
    this.serverUrl = serverUrl || 'http://127.0.0.1:8123';
  }

  /**
   * ログデータを保存
   */
  LogFileStorage.prototype.save = function(data) {
    return new Promise((resolve, reject) => {
      if (!data || data.length === 0) {
        reject(new Error('記録されたデータがありません'));
        return;
      }

      // Create JSON content
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = \`meter-log-\${timestamp}.json\`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also save to server (backup)
      this._saveToServer(data, filename)
        .then(() => resolve({ filename, data }))
        .catch(err => {
          console.warn('Failed to save to server:', err);
          // Download already succeeded, so resolve anyway
          resolve({ filename, data });
        });
    });
  };

  /**
   * サーバーに保存
   */
  LogFileStorage.prototype._saveToServer = function(data, filename) {
    return fetch(\`\${this.serverUrl}/save-log\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: data, filename: filename }),
      cache: 'no-store'
    }).then(response => {
      if (!response.ok) {
        throw new Error(\`Server returned \${response.status}\`);
      }
    });
  };

  /**
   * ログファイルを読み込む
   */
  LogFileStorage.prototype.load = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogFileStorage;
  } else {
    window.LogFileStorage = LogFileStorage;
  }
})();

`,
  "src/infra/storage/SettingsStorage.js": `/**
 * SettingsStorage - Infra Layer
 * 設定（値の範囲、デバイス設定など）の保存・読み込みを管理するストレージ
 */
(function() {
  'use strict';

  function SettingsStorage() {
    this.storageKey = 'positionVisualizer-settings';
  }

  /**
   * 設定を保存
   */
  SettingsStorage.prototype.save = function(settings) {
    try {
      const data = JSON.stringify(settings);
      localStorage.setItem(this.storageKey, data);
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  };

  /**
   * 設定を読み込む
   */
  SettingsStorage.prototype.load = function() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
      return null;
    }
  };

  /**
   * 設定を削除
   */
  SettingsStorage.prototype.clear = function() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (e) {
      console.error('Failed to clear settings:', e);
      return false;
    }
  };

  /**
   * 値の範囲を保存
   */
  SettingsStorage.prototype.saveValueRange = function(valueRange) {
    const settings = this.load() || {};
    settings.valueRange = {
      min: valueRange.min,
      max: valueRange.max,
      unit: valueRange.unit
    };
    return this.save(settings);
  };

  /**
   * 値の範囲を読み込む
   */
  SettingsStorage.prototype.loadValueRange = function() {
    const settings = this.load();
    if (settings && settings.valueRange) {
      return settings.valueRange;
    }
    return null;
  };

  /**
   * デバイス設定を保存
   */
  SettingsStorage.prototype.saveDeviceConfigs = function(configs) {
    const settings = this.load() || {};
    settings.deviceConfigs = configs.map(config => ({
      id: config.id,
      ip: config.ip,
      iconUrl: config.iconUrl,
      name: config.name
    }));
    return this.save(settings);
  };

  /**
   * デバイス設定を読み込む
   */
  SettingsStorage.prototype.loadDeviceConfigs = function() {
    const settings = this.load();
    if (settings && settings.deviceConfigs) {
      return settings.deviceConfigs;
    }
    return null;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsStorage;
  } else {
    window.SettingsStorage = SettingsStorage;
  }
})();

`,
  "src/infra/sync/OverlayChannel.js": `/**
 * OverlayChannel - Infra Layer
 * BroadcastChannelを使用してオーバーレイウィンドウと同期するチャネル
 */
(function() {
  'use strict';

  function OverlayChannel(channelName) {
    this.channelName = channelName || 'meter-overlay';
    this.bc = null;
    this.subscribers = [];
    
    try {
      this.bc = new BroadcastChannel(this.channelName);
      this.bc.onmessage = (event) => {
        this._notifySubscribers({ type: 'message', data: event.data });
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  /**
   * メッセージを送信
   */
  OverlayChannel.prototype.postMessage = function(data) {
    if (this.bc) {
      try {
        this.bc.postMessage(data);
        return true;
      } catch (e) {
        console.error('Failed to post message:', e);
        return false;
      }
    }
    return false;
  };

  /**
   * イベントを購読
   */
  OverlayChannel.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  OverlayChannel.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  OverlayChannel.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * チャネルを閉じる
   */
  OverlayChannel.prototype.close = function() {
    if (this.bc) {
      try {
        this.bc.close();
      } catch (e) {}
      this.bc = null;
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayChannel;
  } else {
    window.OverlayChannel = OverlayChannel;
  }
})();

`,
  "src/presentation/bindings/MainPageBindings.js": `/**
 * MainPageBindings - Presentation Layer
 * メインページのDOMバインディング
 */
(function () {
  'use strict';

  const MeterRenderer = window.MeterRenderer;
  const IconRenderer = window.IconRenderer;

  function MainPageBindings(viewModel, liveMonitorService, recordingService, replayService, settingsService, iconService, webSocketClient, overlayChannel) {
    this.viewModel = viewModel;
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;
    this.webSocketClient = webSocketClient;
    this.overlayChannel = overlayChannel;

    this.deviceIdMap = new Map();
  }

  /**
   * デバイスIDをインデックスにマッピング
   */
  MainPageBindings.prototype._getDeviceIndex = function (deviceId) {
    if (!deviceId) return -1;

    if (this.deviceIdMap.has(deviceId)) {
      return this.deviceIdMap.get(deviceId);
    }

    const match = deviceId.match(/(\\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        const index = num - 1;
        this.deviceIdMap.set(deviceId, index);
        return index;
      }
    }

    // Try to find by IP address or name
    for (let i = 0; i < 6; i++) {
      const ipEl = document.getElementById(\`device\${i + 1}-ip\`);
      const nameEl = document.getElementById(\`device\${i + 1}-name\`);
      const ip = ipEl ? ipEl.value.trim() : '';
      const name = nameEl ? nameEl.value.trim() : '';
      if (name && name.toLowerCase().includes(deviceId.toLowerCase())) {
        this.deviceIdMap.set(deviceId, i);
        return i;
      }
    }

    return -1;
  };

  /**
   * WebSocketメッセージを処理
   */
  MainPageBindings.prototype._handleWebSocketMessage = function (event) {
    if (event.type !== 'message') return;

    const data = event.data;

    // Handle state messages
    if (data.type === 'state' && data.payload) {
      const payload = data.payload;
      if (payload.values && Array.isArray(payload.values)) {
        for (let i = 0; i < 6; i++) {
          const value = payload.values[i];
          const prevValue = this.viewModel.state.values[i];

          if (value !== null && value !== undefined) {
            this.viewModel.setValue(i, value, true, true);

            // Record data if recording is active
            if (this.recordingService && prevValue !== value) {
              const deviceId = \`lever\${i + 1}\`;
              this.recordingService.recordDeviceData(deviceId, value);
            }
          } else {
            this.viewModel.setValue(i, null, false);
          }
        }
      }
      return;
    }

    // Handle device data JSON (legacy format)
    if (data.device_id && data.data) {
      this._processDeviceData(data);
    } else if (data.type === 'device' && data.payload) {
      this._processDeviceData(data.payload);
    } else if (Array.isArray(data)) {
      data.forEach(item => this._processDeviceData(item));
    }
  };

  /**
   * デバイスデータを処理
   */
  MainPageBindings.prototype._processDeviceData = function (jsonData) {
    try {
      if (!jsonData || typeof jsonData !== 'object') return;

      const deviceId = jsonData.device_id;
      if (!deviceId) return;

      const index = this._getDeviceIndex(deviceId);
      if (index < 0 || index > 5) return;

      const data = jsonData.data;
      if (!data) return;

      let value = null;
      if (typeof data.value === 'number') {
        value = data.value;
      } else if (typeof data.smoothed === 'number') {
        value = data.smoothed;
      } else if (typeof data.raw === 'number') {
        value = data.raw;
      }

      if (value !== null && !isNaN(value)) {
        this.viewModel.setValue(index, value);

        // Record data if recording is active
        if (this.recordingService) {
          const normalizedValue = this.viewModel.state.values[index];
          this.recordingService.recordDeviceData(deviceId, normalizedValue);
        }
      }
    } catch (error) {
      console.error('Error processing device data:', error);
    }
  };

  /**
   * 状態をブロードキャスト
   */
  MainPageBindings.prototype.broadcast = function () {
    const state = this.viewModel.toJSON();
    const isPlaying = this.replayService && this.replayService.isPlaying;

    // SVG string - expensive to serialize!
    // Skip serialization during playback to improve performance
    let svgMarkup = '';
    if (!isPlaying) {
      const svgEl = document.querySelector('#meter-container svg[data-meter]');
      svgMarkup = svgEl ? svgEl.outerHTML : '';
    }

    // BroadcastChannel
    if (this.overlayChannel) {
      // During playback, we send only data (no SVG) to keep 60fps
      // Add isReplaying flag so Overlay knows to ignore Live Data
      this.overlayChannel.postMessage({ ...state, svg: svgMarkup, isReplaying: !!isPlaying });
    }

    // localStorage
    // Skip high-frequency writes during playback
    if (!isPlaying) {
      try {
        localStorage.setItem('meter-state', JSON.stringify({ ...state, ts: Date.now(), isReplaying: false }));
        if (svgMarkup) localStorage.setItem('meter-svg', svgMarkup);
      } catch (e) { }
    } else {
      // Optionally update state sparingly or just rely on Channel? 
      // If we don't update localStorage, Overlay won't see it if it only looks there? 
      // Overlay looks at Channel too.
      // But if we want to support "Ghost Replay" prevention, we might want to write isReplaying: true once?
      // Let's safe-guard by writing ONE minimal state if it changed? No, 60fps write is bad.
      // Overlay listens to Channel so it's fine.
    }

    // WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.send({ type: 'state', payload: { ...state, svg: svgMarkup, isReplaying: !!isPlaying } });
    }
  };

  /**
   * バインディングをアタッチ
   */
  MainPageBindings.prototype.attach = function () {
    const vm = this.viewModel;
    const self = this;

    // Initialize meter renderer
    MeterRenderer.initMeter(document.getElementById('meter-container'));

    // Connect WebSocket
    if (this.webSocketClient) {
      this.webSocketClient.subscribe((event) => {
        self._handleWebSocketMessage(event);
      });
      this.webSocketClient.connect();
    }

    // Subscribe to ViewModel changes
    vm.onChange((state) => {
      const connectedDeviceIndices = vm.getConnectedDeviceIndices();
      const actualValues = vm.getActualValues();

      MeterRenderer.updateMeter(state.values, {
        names: state.names,
        icon: state.icon,
        numbersOnly: true,
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: vm.unit,
        minValue: vm.minValue,
        maxValue: vm.maxValue,
        icons: state.icons
      });

      self.broadcast();
    });

    // Initial paint
    const initialConnectedDeviceIndices = vm.getConnectedDeviceIndices();
    const initialActualValues = vm.getActualValues();
    MeterRenderer.updateMeter(vm.state.values, {
      names: vm.state.names,
      icon: vm.state.icon,
      numbersOnly: true,
      textYOffset: 15,
      connectedDeviceIndices: initialConnectedDeviceIndices,
      actualValues: initialActualValues,
      unit: vm.unit,
      minValue: vm.minValue,
      maxValue: vm.maxValue,
      icons: vm.state.icons
    });
    this.broadcast();

    // Bind UI controls
    this._bindUIControls();
  };

  /**
   * UIコントロールをバインディング
   */
  MainPageBindings.prototype._bindUIControls = function () {
    const vm = this.viewModel;
    const self = this;

    // Bind device name inputs
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(\`device\${i}-name\`);
      if (el) {
        const handler = () => vm.setName(i - 1, el.value);
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    }

    // Bind range settings
    const minValueInput = document.getElementById('min-value');
    const maxValueInput = document.getElementById('max-value');
    const unitInput = document.getElementById('value-unit');

    if (minValueInput) {
      minValueInput.addEventListener('change', () => vm.setMinValue(minValueInput.value));
      minValueInput.addEventListener('input', () => vm.setMinValue(minValueInput.value));
    }

    if (maxValueInput) {
      maxValueInput.addEventListener('change', () => vm.setMaxValue(maxValueInput.value));
      maxValueInput.addEventListener('input', () => vm.setMaxValue(maxValueInput.value));
    }

    if (unitInput) {
      unitInput.addEventListener('change', () => vm.setUnit(unitInput.value));
      unitInput.addEventListener('input', () => vm.setUnit(unitInput.value));
    }

    // Bind icon uploads
    for (let i = 1; i <= 6; i++) {
      const input = document.getElementById(\`device\${i}-icon\`);
      if (input) {
        const button = input.closest('.icon-file-button');
        const buttonText = button ? button.querySelector('.icon-button-text') : null;

        const updateIconState = () => {
          const hasIcon = vm.state.icons && vm.state.icons[i - 1];
          if (button) {
            if (hasIcon) {
              button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            } else {
              button.classList.remove('has-icon');
              if (buttonText) buttonText.textContent = '画像を選択';
            }
          }
        };

        updateIconState();

        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) {
            if (button) button.classList.remove('has-icon');
            if (buttonText) buttonText.textContent = '画像を選択';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (dataUrl) {
              vm.setIconAt(i - 1, dataUrl);
              if (button) button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            }
          };
          reader.readAsDataURL(file);
        });

        vm.onChange(() => {
          updateIconState();
        });
      }
    }

    // Bind recording controls
    const startRecordBtn = document.getElementById('start-record');
    const stopRecordBtn = document.getElementById('stop-record');
    const recordStatusEl = document.getElementById('log-record-status');

    const updateRecordStatus = () => {
      if (!recordStatusEl || !this.recordingService) return;
      const status = this.recordingService.getRecordingStatus();
      if (status.isRecording) {
        recordStatusEl.textContent = \`記録中... (\${status.recordCount}件)\`;
        recordStatusEl.style.color = '#d32f2f';
      } else {
        recordStatusEl.textContent = '停止中';
        recordStatusEl.style.color = '#666';
      }
    };

    if (startRecordBtn && this.recordingService) {
      startRecordBtn.addEventListener('click', () => {
        // Pass current values to capture initial state
        this.recordingService.startRecording(this.viewModel.state.values);
        updateRecordStatus();
      });
    }

    if (stopRecordBtn && this.recordingService) {
      stopRecordBtn.addEventListener('click', () => {
        const entries = this.recordingService.stopRecording();
        if (entries && entries.length > 0) {
          try {
            // Use RecordingService to save data (it handles formatting and download)
            this.recordingService.saveRecordedData(entries);
          } catch (e) {
            console.error('Failed to save log:', e);
            alert('ログの保存に失敗しました: ' + e.message);
          }
        }
        updateRecordStatus();
      });
    }

    // Subscribe to recording status changes
    if (this.recordingService) {
      this.recordingService.subscribe(() => {
        updateRecordStatus();
      });
    }

    updateRecordStatus();

    // Bind replay controls
    const logFile = document.getElementById('log-file');
    const playBtn = document.getElementById('play-log');
    const stopBtn = document.getElementById('stop-log');

    if (playBtn && logFile && this.replayService) {
      playBtn.addEventListener('click', () => {
        const f = logFile.files && logFile.files[0];
        if (!f) {
          alert('ログファイル（JSON）を選択してください');
          return;
        }
        this.replayService.loadFile(f).then(() => {
          this.replayService.play();
        }).catch((err) => {
          alert('読み込み失敗: ' + err.message);
        });
      });
    }

    if (stopBtn && this.replayService) {
      stopBtn.addEventListener('click', () => {
        this.replayService.stop();
      });
    }
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainPageBindings;
  } else {
    window.MainPageBindings = MainPageBindings;
  }
})();

`,
  "src/presentation/bindings/OverlayBindings.js": `/**
 * OverlayBindings - Presentation Layer
 * オーバーレイウィンドウのDOMバインディング
 */
(function () {
  'use strict';

  const MeterRenderer = window.MeterRenderer;

  function OverlayBindings(viewModel, webSocketClient, httpPollingClient, overlayChannel) {
    this.viewModel = viewModel;
    this.webSocketClient = webSocketClient;
    this.httpPollingClient = httpPollingClient;
    this.overlayChannel = overlayChannel;
    this.initialized = false;
    this.isMainPageReplaying = false;
  }

  /**
   * SVGを完全にレンダリング
   */
  OverlayBindings.prototype._renderSvgFull = function (svgMarkup) {
    if (!svgMarkup) return;
    const container = document.getElementById('meter-container');
    if (!container) return;

    container.innerHTML = svgMarkup;
    this.initialized = true;

    if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
      setTimeout(() => {
        window.IconRenderer.updateAllIconValues();
      }, 50);
    }
  };

  /**
   * SVGをパッチ（差分更新）
   */
  OverlayBindings.prototype._patchSvg = function (svgMarkup) {
    if (!svgMarkup) return;
    const container = document.getElementById('meter-container');
    if (!container) return;

    const existingSvg = container.querySelector('svg[data-meter]');
    if (!existingSvg) {
      this._renderSvgFull(svgMarkup);
      return;
    }

    const temp = document.createElement('div');
    temp.innerHTML = svgMarkup;
    const nextSvg = temp.querySelector('svg[data-meter]');
    if (!nextSvg) return;

    // Update viewBox if changed
    const nextViewBox = nextSvg.getAttribute('viewBox');
    if (nextViewBox && existingSvg.getAttribute('viewBox') !== nextViewBox) {
      existingSvg.setAttribute('viewBox', nextViewBox);
    }

    // Update perf groups
    const nextGroups = nextSvg.querySelectorAll('g[data-perf]');
    nextGroups.forEach((ng) => {
      const key = ng.getAttribute('data-perf');
      let g = existingSvg.querySelector(\`g[data-perf="\${key}"]\`);
      if (!g) {
        g = ng.cloneNode(true);
        existingSvg.appendChild(g);
        return;
      }

      // Update transform
      const tr = ng.getAttribute('transform');
      if (tr) g.setAttribute('transform', tr);

      // Update data attributes
      const dataPercentage = ng.getAttribute('data-percentage');
      const dataActual = ng.getAttribute('data-actual');
      const dataUnit = ng.getAttribute('data-unit');
      if (dataPercentage !== null) g.setAttribute('data-percentage', dataPercentage);
      if (dataActual !== null) g.setAttribute('data-actual', dataActual);
      if (dataUnit !== null) g.setAttribute('data-unit', dataUnit);

      // Update text
      const nt = ng.querySelector('text');
      const ct = g.querySelector('text');
      if (nt && ct) {
        if (ct.textContent !== nt.textContent) ct.textContent = nt.textContent;
        ct.setAttribute('y', nt.getAttribute('y') || ct.getAttribute('y') || '15');
      }

      // Update icon-value text
      const nIconText = ng.querySelector('text.icon-value');
      const cIconText = g.querySelector('text.icon-value');
      if (nIconText) {
        if (!cIconText) {
          g.appendChild(nIconText.cloneNode(true));
        } else {
          cIconText.textContent = nIconText.textContent;
          cIconText.setAttribute('data-actual', nIconText.getAttribute('data-actual') || '');
          cIconText.setAttribute('data-unit', nIconText.getAttribute('data-unit') || '');
        }
      }

      // Update images
      const nimgs = ng.querySelectorAll('image');
      const cimgs = g.querySelectorAll('image');
      if (nimgs && nimgs.length) {
        for (let i = 0; i < nimgs.length; i++) {
          if (!cimgs[i]) {
            g.insertBefore(nimgs[i].cloneNode(true), ct || null);
          }
        }
        const updatedCImgs = g.querySelectorAll('image');
        for (let i = 0; i < nimgs.length; i++) {
          const nimg = nimgs[i];
          const cimg = updatedCImgs[i];
          if (cimg) {
            const href = nimg.getAttribute('href') || nimg.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (href) {
              cimg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
              cimg.setAttribute('href', href);
            } else {
              cimg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
              cimg.removeAttribute('href');
            }

            // Copy style (display: none, etc)
            const style = nimg.getAttribute('style');
            if (style) {
              cimg.setAttribute('style', style);
            } else {
              cimg.removeAttribute('style');
            }
          }
        }
      }
    });

    if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
      setTimeout(() => {
        window.IconRenderer.updateAllIconValues();
      }, 50);
    }
  };

  /**
   * 状態を処理
   */
  OverlayBindings.prototype._handleState = function (payload) {
    if (payload && payload.isReplaying !== undefined) {
      this.isMainPageReplaying = !!payload.isReplaying;
    }
    if (payload && typeof payload.svg === 'string' && payload.svg) {
      if (!this.initialized) {
        this._renderSvgFull(payload.svg);
      } else {
        this._patchSvg(payload.svg);
      }
      return;
    }

    if (payload && Array.isArray(payload.values)) {
      const values = payload.values;

      // Update icons if present in payload (fixes missing images during replay)
      if (payload.icons && Array.isArray(payload.icons)) {
        this.viewModel.state.icons = payload.icons.slice(0, 6);
      }

      for (let i = 0; i < 6; i++) {
        const value = values[i];
        if (value !== null && value !== undefined) {
          this.viewModel.setValue(i, value, true, true);
        } else {
          this.viewModel.setValue(i, null, false);
        }
      }

      if (payload.icon !== undefined) {
        this.viewModel.setIcon(payload.icon);
      }
      if (payload.unit !== undefined) {
        this.viewModel.setUnit(payload.unit);
      }
      if (payload.minValue !== undefined) {
        this.viewModel.setMinValue(payload.minValue);
      }
      if (payload.maxValue !== undefined) {
        this.viewModel.setMaxValue(payload.maxValue);
      }

      this.initialized = true;
    }
  };

  /**
   * バインディングをアタッチ
   */
  OverlayBindings.prototype.attach = function () {
    const container = document.getElementById('meter-container');
    const self = this;

    // Initialize meter
    try {
      MeterRenderer.initMeter(container);
      MeterRenderer.updateMeter([], { icon: null });
      this.initialized = !!container.querySelector('svg[data-meter]');

      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 100);
      }
    } catch (e) { }

    // BroadcastChannel receiver
    if (this.overlayChannel) {
      this.overlayChannel.subscribe((event) => {
        if (event.type === 'message') {
          const d = event.data || {};
          if (typeof d.svg === 'string' && d.svg) {
            if (!self.initialized) {
              self._renderSvgFull(d.svg);
            } else {
              self._patchSvg(d.svg);
            }
            return;
          }
          if (Array.isArray(d.values)) {
            self._handleState(d);
            try {
              const svg = localStorage.getItem('meter-svg');
              if (svg) {
                if (!self.initialized) {
                  self._renderSvgFull(svg);
                } else {
                  self._patchSvg(svg);
                }
              }
            } catch (e) { }
          }
        }
      });
    }

    // localStorage storage event
    window.addEventListener('storage', (e) => {
      if (e.key === 'meter-svg' && typeof e.newValue === 'string') {
        if (!self.initialized) {
          self._renderSvgFull(e.newValue);
        } else {
          self._patchSvg(e.newValue);
        }
      }
    });

    // Initial load from localStorage
    try {
      const svg = localStorage.getItem('meter-svg');
      if (svg) {
        this._renderSvgFull(svg);
      }
    } catch (e) { }

    // WebSocket receiver
    if (this.webSocketClient) {
      this.webSocketClient.subscribe((event) => {
        if (self.isMainPageReplaying) return; // Ignore live data during replay

        if (event.type === 'message') {
          const msg = event.data || {};
          if (msg && msg.type === 'state' && msg.payload) {
            self._handleState(msg.payload);
          }
        }
      });
      this.webSocketClient.connect();
    }

    // HTTP polling fallback
    if (this.httpPollingClient) {
      this.httpPollingClient.subscribe((event) => {
        if (self.isMainPageReplaying) return; // Ignore live data during replay

        if (event.type === 'data') {
          self._handleState(event.data);
        }
      });
      this.httpPollingClient.start();
    }

    // Subscribe to ViewModel changes
    this.viewModel.onChange((state) => {
      const connectedDeviceIndices = this.viewModel.getConnectedDeviceIndices();
      const actualValues = this.viewModel.getActualValues();

      MeterRenderer.updateMeter(state.values, {
        names: state.names,
        icon: state.icon,
        numbersOnly: true,
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: this.viewModel.unit,
        minValue: this.viewModel.minValue,
        maxValue: this.viewModel.maxValue,
        icons: state.icons
      });

      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 50);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayBindings;
  } else {
    window.OverlayBindings = OverlayBindings;
  }
})();

`,
  "src/presentation/viewmodels/MainPageViewModel.js": `/**
 * MainPageViewModel - Presentation Layer
 * メインページのUI状態とUseCase呼び出しを管理するViewModel
 */
(function () {
  'use strict';

  const Emitter = window.MVVM && window.MVVM.Emitter;
  const MeterState = window.MVVM && window.MVVM.MeterState;

  function MainPageViewModel(initialState, liveMonitorService, recordingService, replayService, settingsService, iconService) {
    this.emitter = new Emitter();
    this.state = initialState instanceof MeterState ? initialState : new MeterState();

    // UseCase services
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;

    // UI state
    this.running = false;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';

    // Interpolation state
    this._interpolationDuration = 200;
    this._interpolations = [];
    this._animationFrameId = null;

    // Subscribe to UseCase events
    this._setupUseCaseSubscriptions();
  }

  /**
   * UseCaseのイベントを購読
   */
  MainPageViewModel.prototype._setupUseCaseSubscriptions = function () {
    const self = this;

    // LiveMonitorServiceの購読
    if (this.liveMonitorService) {
      this.liveMonitorService.subscribe((deviceState) => {
        const index = deviceState.index;
        if (index >= 0 && index < 6) {
          if (deviceState.isConnected()) {
            self.setValue(index, deviceState.normalizedValue, true, true);
          } else {
            self.setValue(index, null, false);
          }
        }
      });
    }

    // RecordingServiceの購読
    if (this.recordingService) {
      this.recordingService.subscribe((event) => {
        self._notify();
      });
    }

    // ReplayServiceの購読
    if (this.replayService) {
      this.replayService.subscribe((event) => {
        if (event.type === 'frameUpdated') {
          // Update state values from replay
          if (event.values) {
            for (let i = 0; i < 6; i++) {
              const value = event.values[i];
              if (value !== null && value !== undefined) {
                self.setValue(i, value, true, true);
              } else {
                self.setValue(i, null, false);
              }
            }
          }
        } else if (event.type === 'valuesReset') {
          for (let i = 0; i < 6; i++) {
            self.setValue(i, null, false);
          }
        }
      });
    }

    // SettingsServiceの購読
    if (this.settingsService) {
      this.settingsService.subscribe((valueRange) => {
        self.minValue = valueRange.min;
        self.maxValue = valueRange.max;
        self.unit = valueRange.unit;
        self._notify();
      });
    }

    // IconServiceの購読
    if (this.iconService) {
      this.iconService.subscribe((index, config) => {
        if (index >= 0 && index < 6) {
          self.state.icons[index] = config.iconUrl;
          self._notify();
        }
      });
    }
  };

  /**
   * 変更イベントを購読
   */
  MainPageViewModel.prototype.onChange = function (fn) {
    return this.emitter.on('change', fn);
  };

  /**
   * 変更を通知
   */
  MainPageViewModel.prototype._notify = function () {
    this.emitter.emit('change', this.state.clone());
  };

  /**
   * 値の範囲を設定
   */
  MainPageViewModel.prototype.setMinValue = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(v, currentRange.max, currentRange.unit);
    } else {
      let min = Number(v);
      if (!isNaN(min)) {
        if (min >= this.maxValue) {
          this.maxValue = min + 1;
        }
        this.minValue = min;
        this._notify();
      }
    }
  };

  MainPageViewModel.prototype.setMaxValue = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(currentRange.min, v, currentRange.unit);
    } else {
      let max = Number(v);
      if (!isNaN(max)) {
        if (max <= this.minValue) {
          this.minValue = max - 1;
        }
        this.maxValue = max;
        this._notify();
      }
    }
  };

  MainPageViewModel.prototype.setUnit = function (v) {
    if (this.settingsService) {
      const currentRange = this.settingsService.getRange();
      this.settingsService.updateRange(currentRange.min, currentRange.max, v);
    } else {
      this.unit = String(v || '%').trim() || '%';
      this._notify();
    }
  };

  /**
   * 値を正規化
   */
  MainPageViewModel.prototype.normalizeValue = function (actualValue) {
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50;
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値を実際の値に変換
   */
  MainPageViewModel.prototype.denormalizeValue = function (percentage) {
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };

  /**
   * デバイス名を設定
   */
  MainPageViewModel.prototype.setName = function (index, name) {
    if (index < 0 || index > 5) return;
    this.state.names[index] = String(name || '').trim() || this.state.names[index];
    this._notify();
  };

  /**
   * 値を設定
   */
  MainPageViewModel.prototype.setValue = function (index, value, smooth, isNormalized) {
    if (index < 0 || index > 5) return;

    if (value === null || value === undefined) {
      this._interpolations = this._interpolations.filter(interp => interp.index !== index);
      this.state.values[index] = null;
      this._notify();
      return;
    }

    let normalized;
    if (isNormalized === true) {
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }

    const useSmooth = smooth !== false;
    const currentNormalized = this.state.values[index];

    if (useSmooth && currentNormalized !== null && currentNormalized !== undefined && !isNaN(currentNormalized)) {
      const targetNormalized = normalized;
      const diff = Math.abs(currentNormalized - targetNormalized);
      if (diff > 0.01) {
        this._interpolations = this._interpolations.filter(interp => interp.index !== index);
        const now = performance.now();
        this._interpolations.push({
          index: index,
          startValue: currentNormalized,
          targetValue: targetNormalized,
          startTime: now,
          endTime: now + this._interpolationDuration
        });
        this._startInterpolation();
        return;
      }
    }

    this.state.values[index] = normalized;
    this._notify();
  };

  /**
   * 補間アニメーションを開始
   */
  MainPageViewModel.prototype._startInterpolation = function () {
    if (this._animationFrameId !== null) return;

    const self = this;
    const animate = function () {
      const now = performance.now();
      let needsUpdate = false;

      self._interpolations.forEach(interp => {
        if (now >= interp.endTime) {
          if (self.state.values[interp.index] !== interp.targetValue) {
            self.state.values[interp.index] = interp.targetValue;
            needsUpdate = true;
          }
        } else {
          const progress = (now - interp.startTime) / (interp.endTime - interp.startTime);
          const clampedProgress = Math.max(0, Math.min(1, progress));
          const currentValue = interp.startValue + (interp.targetValue - interp.startValue) * clampedProgress;
          self.state.values[interp.index] = currentValue;
          needsUpdate = true;
        }
      });

      self._interpolations = self._interpolations.filter(interp => now < interp.endTime);

      if (needsUpdate) {
        self._notify();
      }

      if (self._interpolations.length > 0) {
        self._animationFrameId = requestAnimationFrame(animate);
      } else {
        self._animationFrameId = null;
      }
    };

    this._animationFrameId = requestAnimationFrame(animate);
  };

  /**
   * 実際の値を取得
   */
  MainPageViewModel.prototype.getActualValue = function (index) {
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };

  MainPageViewModel.prototype.getActualValues = function () {
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };

  /**
   * 接続されているデバイスのインデックスを取得
   */
  MainPageViewModel.prototype.getConnectedDeviceIndices = function () {
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };

  /**
   * アイコンを設定
   */
  MainPageViewModel.prototype.setIcon = function (path) {
    if (path) {
      this.state.icon = path;
      this._notify();
    }
  };

  MainPageViewModel.prototype.setIconAt = function (index, path) {
    if (index < 0 || index > 5) return;
    if (this.iconService) {
      this.iconService.setIcon(index, path);
    } else {
      this.state.icons[index] = String(path || '');
      this._notify();
    }
  };

  /**
   * 状態を設定
   */
  MainPageViewModel.prototype.setState = function (next) {
    if (!next) return;
    if (!(next instanceof MeterState)) {
      next = new MeterState(next.values, next.names, next.icon, next.icons);
    }
    this.state = next;
    this._notify();
  };

  /**
   * JSONに変換
   */
  MainPageViewModel.prototype.toJSON = function () {
    return {
      values: this.state.values.slice(0, 6),
      names: this.state.names.slice(0, 6),
      icon: this.state.icon,
      icons: this.state.icons.slice(0, 6)
    };
  };

  /**
   * 監視を開始
   */
  MainPageViewModel.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    if (this.liveMonitorService) {
      this.liveMonitorService.start();
    }
    this._notify();
  };

  /**
   * 監視を停止
   */
  MainPageViewModel.prototype.stop = function () {
    if (!this.running) return;
    this.running = false;
    if (this.liveMonitorService) {
      this.liveMonitorService.stop();
    }
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this._interpolations.forEach(interp => {
      this.state.values[interp.index] = interp.targetValue;
    });
    this._interpolations = [];
    this._notify();
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainPageViewModel;
  } else {
    window.MainPageViewModel = MainPageViewModel;
  }
})();

`,
  "src/presentation/viewmodels/OverlayViewModel.js": `/**
 * OverlayViewModel - Presentation Layer
 * オーバーレイウィンドウのUI状態とUseCase呼び出しを管理するViewModel
 */
(function() {
  'use strict';

  const Emitter = window.MVVM && window.MVVM.Emitter;
  const MeterState = window.MVVM && window.MVVM.MeterState;

  function OverlayViewModel(initialState, replayService, settingsService) {
    this.emitter = new Emitter();
    this.state = initialState instanceof MeterState ? initialState : new MeterState();
    
    // UseCase services
    this.replayService = replayService;
    this.settingsService = settingsService;
    
    // UI state
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Subscribe to UseCase events
    this._setupUseCaseSubscriptions();
  }

  /**
   * UseCaseのイベントを購読
   */
  OverlayViewModel.prototype._setupUseCaseSubscriptions = function() {
    const self = this;
    
    // ReplayServiceの購読
    if (this.replayService) {
      this.replayService.subscribe((event) => {
        if (event.type === 'frameUpdated') {
          // Update state values from replay
          if (event.values) {
            for (let i = 0; i < 6; i++) {
              self.state.values[i] = event.values[i] !== undefined ? event.values[i] : null;
            }
            self._notify();
          }
        } else if (event.type === 'valuesReset') {
          for (let i = 0; i < 6; i++) {
            self.state.values[i] = null;
          }
          self._notify();
        }
      });
    }
    
    // SettingsServiceの購読
    if (this.settingsService) {
      this.settingsService.subscribe((valueRange) => {
        self.minValue = valueRange.min;
        self.maxValue = valueRange.max;
        self.unit = valueRange.unit;
        self._notify();
      });
    }
  };

  /**
   * 変更イベントを購読
   */
  OverlayViewModel.prototype.onChange = function(fn) {
    return this.emitter.on('change', fn);
  };

  /**
   * 変更を通知
   */
  OverlayViewModel.prototype._notify = function() {
    this.emitter.emit('change', this.state.clone());
  };

  /**
   * 値を正規化
   */
  OverlayViewModel.prototype.normalizeValue = function(actualValue) {
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50;
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };

  /**
   * 正規化値を実際の値に変換
   */
  OverlayViewModel.prototype.denormalizeValue = function(percentage) {
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };

  /**
   * 値を設定
   */
  OverlayViewModel.prototype.setValue = function(index, value, smooth, isNormalized) {
    if (index < 0 || index > 5) return;
    
    if (value === null || value === undefined) {
      this.state.values[index] = null;
      this._notify();
      return;
    }
    
    let normalized;
    if (isNormalized === true) {
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }
    
    this.state.values[index] = normalized;
    this._notify();
  };

  /**
   * 実際の値を取得
   */
  OverlayViewModel.prototype.getActualValue = function(index) {
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };

  OverlayViewModel.prototype.getActualValues = function() {
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };

  /**
   * 接続されているデバイスのインデックスを取得
   */
  OverlayViewModel.prototype.getConnectedDeviceIndices = function() {
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };

  /**
   * アイコンを設定
   */
  OverlayViewModel.prototype.setIcon = function(path) {
    if (path) {
      this.state.icon = path;
      this._notify();
    }
  };

  /**
   * 単位を設定
   */
  OverlayViewModel.prototype.setUnit = function(v) {
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };

  /**
   * 最小値を設定
   */
  OverlayViewModel.prototype.setMinValue = function(v) {
    let min = Number(v);
    if (!isNaN(min)) {
      if (min >= this.maxValue) {
        this.maxValue = min + 1;
      }
      this.minValue = min;
      this._notify();
    }
  };

  /**
   * 最大値を設定
   */
  OverlayViewModel.prototype.setMaxValue = function(v) {
    let max = Number(v);
    if (!isNaN(max)) {
      if (max <= this.minValue) {
        this.minValue = max - 1;
      }
      this.maxValue = max;
      this._notify();
    }
  };

  /**
   * 状態を設定
   */
  OverlayViewModel.prototype.setState = function(next) {
    if (!next) return;
    if (!(next instanceof MeterState)) {
      next = new MeterState(next.values, next.names, next.icon, next.icons);
    }
    this.state = next;
    this._notify();
  };

  /**
   * JSONに変換
   */
  OverlayViewModel.prototype.toJSON = function() {
    return {
      values: this.state.values.slice(0, 6),
      names: this.state.names.slice(0, 6),
      icon: this.state.icon,
      icons: this.state.icons.slice(0, 6)
    };
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayViewModel;
  } else {
    window.OverlayViewModel = OverlayViewModel;
  }
})();

`,
  "src/usecases/IconService.js": `/**
 * IconService - UseCase Layer
 * アイコン設定を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function IconService(deviceConfigRepository) {
    this.deviceConfigRepository = deviceConfigRepository;
    this.subscribers = [];
  }

  /**
   * デバイスのアイコンを設定
   */
  IconService.prototype.setIcon = function(deviceIndex, iconUrl) {
    const deviceConfig = this.deviceConfigRepository.getByIndex(deviceIndex);
    if (deviceConfig) {
      const oldConfig = deviceConfig.clone();
      deviceConfig.iconUrl = String(iconUrl || '').trim();
      
      // 変更があった場合のみ通知
      if (deviceConfig.iconUrl !== oldConfig.iconUrl) {
        this._notifySubscribers(deviceIndex, deviceConfig);
      }
    }
  };

  /**
   * デバイスのアイコンを取得
   */
  IconService.prototype.getIcon = function(deviceIndex) {
    const deviceConfig = this.deviceConfigRepository.getByIndex(deviceIndex);
    return deviceConfig ? deviceConfig.iconUrl : '';
  };

  /**
   * 変更を購読
   */
  IconService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  IconService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  IconService.prototype._notifySubscribers = function(deviceIndex, deviceConfig) {
    this.subscribers.forEach(callback => {
      try {
        callback(deviceIndex, deviceConfig);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IconService;
  } else {
    window.IconService = IconService;
  }
})();

`,
  "src/usecases/LiveMonitorService.js": `/**
 * LiveMonitorService - UseCase Layer
 * 値の購読を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function LiveMonitorService(deviceStateRepository, valueRangeRepository) {
    this.deviceStateRepository = deviceStateRepository;
    this.valueRangeRepository = valueRangeRepository;
    this.subscribers = [];
    this.isMonitoring = false;
  }

  /**
   * 値の変更を購読
   */
  LiveMonitorService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  LiveMonitorService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * デバイス値の更新を処理
   */
  LiveMonitorService.prototype.updateDeviceValue = function(deviceId, actualValue) {
    // Domain LayerのValueRangeを使用して正規化
    const valueRange = this.valueRangeRepository.get();
    const normalizedValue = valueRange.normalize(actualValue);
    
    // Domain LayerのDeviceStateを更新
    const deviceState = this.deviceStateRepository.getByDeviceId(deviceId);
    if (deviceState) {
      const oldState = deviceState.clone();
      deviceState.normalizedValue = normalizedValue;
      deviceState.actualValue = actualValue;
      deviceState.connected = true;
      
      // 変更があった場合のみ通知
      if (deviceState.hasChanged(oldState)) {
        this._notifySubscribers(deviceState);
      }
    }
  };

  /**
   * デバイスの接続状態を更新
   */
  LiveMonitorService.prototype.updateConnectionState = function(deviceId, connected) {
    const deviceState = this.deviceStateRepository.getByDeviceId(deviceId);
    if (deviceState) {
      deviceState.connected = connected;
      if (!connected) {
        deviceState.normalizedValue = null;
        deviceState.actualValue = null;
      }
      this._notifySubscribers(deviceState);
    }
  };

  /**
   * 購読者に通知
   */
  LiveMonitorService.prototype._notifySubscribers = function(deviceState) {
    this.subscribers.forEach(callback => {
      try {
        callback(deviceState);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  /**
   * 監視を開始
   */
  LiveMonitorService.prototype.start = function() {
    this.isMonitoring = true;
  };

  /**
   * 監視を停止
   */
  LiveMonitorService.prototype.stop = function() {
    this.isMonitoring = false;
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveMonitorService;
  } else {
    window.LiveMonitorService = LiveMonitorService;
  }
})();

`,
  "src/usecases/RecordingService.js": `/**
 * RecordingService - UseCase Layer
 * ログ生成を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function () {
  'use strict';

  const SessionLog = window.SessionLog || (typeof module !== 'undefined' && module.exports ? require('../domain/SessionLog') : null);
  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function RecordingService(sessionLogRepository, logFileStorage) {
    this.sessionLogRepository = sessionLogRepository;
    this.logFileStorage = logFileStorage;
    this.currentSession = null;
    this.subscribers = [];
    this.recordingStartTimeMs = null; // Track session start for relative timestamps
  }

  /**
   * 記録を開始
   */
  RecordingService.prototype.startRecording = function (initialValues) {
    if (this.currentSession && !this.currentSession.isEnded()) {
      return; // Already recording
    }

    const sessionLog = new SessionLog();
    this.currentSession = sessionLog;
    this.sessionLogRepository.save(sessionLog);
    this.recordingStartTimeMs = sessionLog.startedAt instanceof Date ? sessionLog.startedAt.getTime() : Date.now();

    this._notifySubscribers({ type: 'started', session: sessionLog });

    // Record initial values if provided
    if (Array.isArray(initialValues)) {
      initialValues.forEach((val, index) => {
        if (val !== null && val !== undefined) {
          // Device IDs are 1-based usually, or index based? 
          // LogEntry uses numeric ID. Main use \`i+1\`?
          // In recordDeviceData: \`const match = deviceId.match(/(\\d+)$/);\`
          // Let's assume ID is index+1.
          this.recordDeviceData(\`lever\${index + 1}\`, val);
        }
      });
    }
  };

  /**
   * 記録を停止
   */
  RecordingService.prototype.stopRecording = function () {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return null;
    }

    this.currentSession.end();
    const entries = this.currentSession.entries.slice();

    this._notifySubscribers({ type: 'stopped', session: this.currentSession });

    const session = this.currentSession;
    this.currentSession = null;

    return entries;
  };

  /**
   * デバイスデータを記録
   */
  RecordingService.prototype.recordDeviceData = function (deviceId, normalizedValue) {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return;
    }

    if (!deviceId || normalizedValue === null || normalizedValue === undefined) {
      return;
    }

    // Convert deviceId to numeric id if possible
    let id = deviceId;
    if (typeof deviceId === 'string') {
      const match = deviceId.match(/(\\d+)$/);
      if (match) {
        id = parseInt(match[1], 10);
      } else {
        // Use hash of string as id
        let hash = 0;
        for (let i = 0; i < deviceId.length; i++) {
          hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
          hash = hash & hash;
        }
        id = Math.abs(hash);
      }
    }

    const numValue = Number(normalizedValue);
    if (!Number.isFinite(numValue)) {
      return;
    }

    // Unpack array if necessary (though it should be a single value now)
    const finalValue = Array.isArray(numValue) ? numValue[0] : numValue;

    const logEntry = new LogEntry(Date.now(), id, finalValue);

    this.currentSession.addEntry(logEntry);
    this._notifySubscribers({ type: 'recorded', entry: logEntry });
  };

  /**
   * 記録されたデータを保存
   */
  RecordingService.prototype.saveRecordedData = function (entries) {
    if (!entries || entries.length === 0) {
      throw new Error('記録されたデータがありません');
    }

    // Determine base timestamp (relative start). Prefer recorded start time; fallback to first entry timestamp.
    let baseTs = Number.isFinite(this.recordingStartTimeMs) ? this.recordingStartTimeMs : null;
    if (!Number.isFinite(baseTs)) {
      const firstEntryTs = entries[0] && entries[0].timestamp instanceof Date
        ? entries[0].timestamp.getTime()
        : Number(entries[0] && entries[0].timestamp);
      baseTs = Number.isFinite(firstEntryTs) ? firstEntryTs : Date.now();
    }

    // Convert LogEntry objects to serializable format { id, value, ts }
    const serializableData = entries.map(entry => {
      const entryTs = entry.timestamp instanceof Date ? entry.timestamp.getTime() : Number(entry.timestamp);
      const ts = Number.isFinite(entryTs) ? Math.max(0, Math.round(entryTs - baseTs)) : 0;

      return {
        id: entry.id,
        value: entry.value,
        ts: ts
      };
    }).filter(item => item !== null);

    // Clear stored start time after exporting to avoid reuse across sessions
    this.recordingStartTimeMs = null;

    // Save via storage
    return this.logFileStorage.save(serializableData);
  };

  /**
   * 記録ステータスを取得
   */
  RecordingService.prototype.getRecordingStatus = function () {
    if (!this.currentSession || this.currentSession.isEnded()) {
      return {
        isRecording: false,
        recordCount: 0,
        startTime: null
      };
    }

    return {
      isRecording: true,
      recordCount: this.currentSession.getEntryCount(),
      startTime: this.currentSession.startedAt
    };
  };

  /**
   * 変更を購読
   */
  RecordingService.prototype.subscribe = function (callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  RecordingService.prototype.unsubscribe = function (callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  RecordingService.prototype._notifySubscribers = function (event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordingService;
  } else {
    window.RecordingService = RecordingService;
  }
})();

`,
  "src/usecases/ReplayService.js": `/**
 * ReplayService - UseCase Layer
 * ログ再生を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  const LogEntry = window.LogEntry || (typeof module !== 'undefined' && module.exports ? require('../domain/LogEntry') : null);

  function ReplayService(logFileStorage, deviceStateRepository) {
    this.logFileStorage = logFileStorage;
    this.deviceStateRepository = deviceStateRepository;
    this.frames = [];
    this.isPlaying = false;
    this.playbackStartTime = null;
    this.animationFrameId = null;
    this.subscribers = [];
    this.intervalMs = 200;
  }

  /**
   * ログデータを読み込む（JSONオブジェクトから）
   */
  ReplayService.prototype.loadLog = function(data) {
    try {
      const logArray = Array.isArray(data) ? data : (Array.isArray(data.records) ? data.records : null);
      
      if (!logArray) {
        throw new Error('Invalid log format');
      }

      this._parseLogArray(logArray);
      this._notifySubscribers({ type: 'logLoaded', framesCount: this.frames.length, intervalMs: this.intervalMs });
    } catch (e) {
      throw e;
    }
  };

  /**
   * ログファイルを読み込む
   */
  ReplayService.prototype.loadFile = function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const logArray = Array.isArray(data) ? data : (Array.isArray(data.records) ? data.records : null);
          
          if (!logArray) {
            reject(new Error('Invalid log format'));
            return;
          }

          this._parseLogArray(logArray);
          resolve({ framesCount: this.frames.length, intervalMs: this.intervalMs });
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  /**
   * ログ配列をパースしてフレームに変換
   */
  ReplayService.prototype._parseLogArray = function(arr) {
    const byTs = new Map(); // Map<timestamp, Map<deviceId, value>>
    const ids = new Set();

    // First pass: collect all device IDs and group by timestamp
    arr.forEach(r => {
      if (!r) return;
      const id = Number(r.id);
      const v = Number(r.value);
      const ts = Number(r.ts);
      if (!Number.isFinite(id) || !Number.isFinite(v) || !Number.isFinite(ts)) return;
      ids.add(id);
      if (!byTs.has(ts)) byTs.set(ts, new Map());
      byTs.get(ts).set(id, Math.max(0, Math.min(100, v)));
    });

    const sortedTs = Array.from(byTs.keys()).sort((a, b) => a - b);
    this.intervalMs = 200; // Fixed interval

    // Create sorted list of device IDs (up to 6 devices)
    const idList = Array.from(ids).sort((a, b) => a - b).slice(0, 6);

    // Normalize timestamps to start from 0 (relative time)
    const firstTs = sortedTs.length > 0 ? sortedTs[0] : 0;

    // Build frames with carry-forward values
    const lastVals = new Map();
    this.frames = sortedTs.map(ts => {
      const m = byTs.get(ts);
      idList.forEach(id => {
        if (m.has(id)) lastVals.set(id, m.get(id));
      });

      const values = [null, null, null, null, null, null];
      for (let i = 0; i < idList.length; i++) {
        const deviceId = idList[i];
        if (lastVals.has(deviceId)) {
          values[i] = lastVals.get(deviceId);
        }
      }

      return { ts: ts - firstTs, values, idList };
    });
  };

  /**
   * 再生を開始
   */
  ReplayService.prototype.play = function() {
    if (!this.frames.length) return;
    if (this.isPlaying) return;

    this.stop(); // Clear any existing playback
    this.isPlaying = true;
    this.playbackStartTime = Date.now();

    this._notifySubscribers({ type: 'playbackStarted' });

    // Use requestAnimationFrame for smooth playback
    const updateFrame = () => {
      if (!this.isPlaying || this.frames.length === 0) {
        this.animationFrameId = null;
        return;
      }

      const currentTime = Date.now() - this.playbackStartTime;

      // Find the frame that should be playing now
      let prevFrameIndex = -1;
      let nextFrameIndex = -1;

      for (let i = 0; i < this.frames.length; i++) {
        if (this.frames[i].ts <= currentTime) {
          prevFrameIndex = i;
        } else {
          nextFrameIndex = i;
          break;
        }
      }

      // Before first frame
      if (prevFrameIndex < 0) {
        if (this.frames.length > 0) {
          this._applyFrameValues(this.frames[0].values);
        }
        this.animationFrameId = requestAnimationFrame(updateFrame);
        return;
      }

      // Past last frame
      if (currentTime >= this.frames[this.frames.length - 1].ts) {
        this._resetAllValues();
        this.stop();
        return;
      }

      // Interpolate between frames
      const prevFrame = this.frames[prevFrameIndex];
      let interpolatedValues = prevFrame.values.slice();

      if (nextFrameIndex >= 0 && nextFrameIndex < this.frames.length) {
        const nextFrame = this.frames[nextFrameIndex];
        const prevTime = prevFrame.ts;
        const nextTime = nextFrame.ts;

        const t = nextTime > prevTime ? (currentTime - prevTime) / (nextTime - prevTime) : 0;
        const clampedT = Math.max(0, Math.min(1, t));

        for (let i = 0; i < 6; i++) {
          const prevVal = prevFrame.values[i];
          const nextVal = nextFrame.values[i];

          if (prevVal !== null && prevVal !== undefined && nextVal !== null && nextVal !== undefined) {
            interpolatedValues[i] = prevVal + (nextVal - prevVal) * clampedT;
          } else if (prevVal !== null && prevVal !== undefined) {
            interpolatedValues[i] = prevVal;
          } else if (nextVal !== null && nextVal !== undefined) {
            interpolatedValues[i] = nextVal;
          } else {
            interpolatedValues[i] = null;
          }
        }
      }

      this._applyFrameValues(interpolatedValues);
      this.animationFrameId = requestAnimationFrame(updateFrame);
    };

    this.animationFrameId = requestAnimationFrame(updateFrame);
  };

  /**
   * 再生を停止
   */
  ReplayService.prototype.stop = function() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isPlaying = false;
    this.playbackStartTime = null;
    this._resetAllValues();
    this._notifySubscribers({ type: 'playbackStopped' });
  };

  /**
   * フレームの値を適用
   */
  ReplayService.prototype._applyFrameValues = function(values) {
    for (let i = 0; i < 6; i++) {
      const deviceState = this.deviceStateRepository.getByIndex(i);
      if (deviceState) {
        const value = values[i];
        if (value !== null && value !== undefined) {
          deviceState.normalizedValue = value;
          deviceState.connected = true;
        } else {
          deviceState.normalizedValue = null;
          deviceState.connected = false;
        }
      }
    }
    this._notifySubscribers({ type: 'frameUpdated', values });
  };

  /**
   * すべての値をリセット
   */
  ReplayService.prototype._resetAllValues = function() {
    for (let i = 0; i < 6; i++) {
      const deviceState = this.deviceStateRepository.getByIndex(i);
      if (deviceState) {
        deviceState.normalizedValue = null;
        deviceState.actualValue = null;
        deviceState.connected = false;
      }
    }
    this._notifySubscribers({ type: 'valuesReset' });
  };

  /**
   * 変更を購読
   */
  ReplayService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  ReplayService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  ReplayService.prototype._notifySubscribers = function(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReplayService;
  } else {
    window.ReplayService = ReplayService;
  }
})();

`,
  "src/usecases/SettingsService.js": `/**
 * SettingsService - UseCase Layer
 * 範囲・単位更新を管理するUseCase
 * Domain Layerのみに依存し、外部実装には依存しない
 */
(function() {
  'use strict';

  function SettingsService(valueRangeRepository) {
    this.valueRangeRepository = valueRangeRepository;
    this.subscribers = [];
  }

  /**
   * 値の範囲を更新
   */
  SettingsService.prototype.updateRange = function(min, max, unit) {
    const valueRange = this.valueRangeRepository.get();
    const oldRange = valueRange.clone();
    
    valueRange.min = Number(min) || 0;
    valueRange.max = Number(max) || 100;
    valueRange.unit = String(unit || '%').trim() || '%';
    
    // Validation: ensure min < max
    if (valueRange.min >= valueRange.max) {
      valueRange.max = valueRange.min + 1;
    }
    
    // 変更があった場合のみ通知
    if (valueRange.min !== oldRange.min || 
        valueRange.max !== oldRange.max || 
        valueRange.unit !== oldRange.unit) {
      this._notifySubscribers(valueRange);
    }
  };

  /**
   * 値の範囲を取得
   */
  SettingsService.prototype.getRange = function() {
    return this.valueRangeRepository.get().clone();
  };

  /**
   * 変更を購読
   */
  SettingsService.prototype.subscribe = function(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
    }
  };

  /**
   * 購読を解除
   */
  SettingsService.prototype.unsubscribe = function(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  };

  /**
   * 購読者に通知
   */
  SettingsService.prototype._notifySubscribers = function(valueRange) {
    this.subscribers.forEach(callback => {
      try {
        callback(valueRange);
      } catch (e) {
        console.error('Error in subscriber callback:', e);
      }
    });
  };

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsService;
  } else {
    window.SettingsService = SettingsService;
  }
})();

`,
  "sw.js": `// Empty service worker to prevent 404 errors
// This file exists only to satisfy browser requests for service worker registration
// No actual service worker functionality is implemented

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// No fetch handler - all requests pass through normally

`,
  "testApp/test-bun-detection.js": `#!/usr/bin/env node
// コンパイル時の検出方法をテスト

console.log('=== Compilation Detection Tests ===');

// 通常のNode.js検出
console.log('1. require.main === module:', require.main === module);

// Bunの検出
console.log('2. typeof Bun !== "undefined":', typeof Bun !== 'undefined');

// process.pkgの検出（PKGによるコンパイル）
console.log('3. process.pkg:', process.pkg);

// import.meta.mainを使った検出（Bunのみ）
if (typeof import.meta !== 'undefined') {
  console.log('4. Bun.main:', Bun.main);
  console.log('5. import.meta.path:', import.meta.path);
}

// __filenameとBun.mainの比較
if (typeof Bun !== 'undefined' && Bun.main) {
  console.log('6. Bun.main === import.meta.path:', Bun.main === import.meta.path);
  console.log('7. Bun.main === __filename:', Bun.main === __filename);
}

// process.execPathがバイナリを指しているか
console.log('8. process.execPath:', process.execPath);
console.log('9. process.execPath includes ".exe" or compiled binary:',
  process.execPath.includes('.exe') ||
  process.execPath.includes('compiled') ||
  !process.execPath.includes('bun')
);

// 実行ファイルかどうかの判定
const isCompiledBinary = (
  typeof Bun !== 'undefined' &&
  Bun.main &&
  Bun.main.startsWith('/$bunfs/')
);

console.log('\\n=== Result ===');
console.log('Is Compiled Binary:', isCompiledBinary);
`,
  "testApp/test-bun-serve.js": `#!/usr/bin/env node
// Bun.serveを使ったシンプルなサーバーテスト

console.log('=== Bun.serve Test ===');
console.log('process.execPath:', process.execPath);
console.log('__dirname:', __dirname);
console.log('Bun.main:', typeof Bun !== 'undefined' ? Bun.main : 'N/A');

if (typeof Bun !== 'undefined' && Bun.serve) {
  console.log('\\nStarting Bun.serve...');

  const server = Bun.serve({
    port: 3000,
    hostname: '127.0.0.1',
    fetch(req) {
      return new Response('Hello from Bun.serve!\\n', {
        headers: { 'Content-Type': 'text/plain' }
      });
    },
  });

  console.log(\`Server running at http://\${server.hostname}:\${server.port}\`);
  console.log('Press Ctrl+C to stop');
} else {
  console.log('\\nBun.serve is not available. This must be run with Bun.');
}
`,
  "testApp/test-bunfs.js": `#!/usr/bin/env node
// $bunfsファイルシステムのテスト

const fs = require('fs');
const path = require('path');

console.log('=== Bun FileSystem Test ===\\n');

// 基本情報
console.log('1. Basic Information:');
console.log('   process.execPath:', process.execPath);
console.log('   __dirname:', __dirname);
console.log('   __filename:', __filename);

if (typeof Bun !== 'undefined') {
  console.log('   Bun.main:', Bun.main);
  console.log('   import.meta.path:', import.meta.path);
  console.log('   import.meta.dir:', import.meta.dir);
}

// コンパイル検出
const isCompiled = typeof Bun !== 'undefined' && Bun.main && Bun.main.startsWith('/$bunfs/');
console.log('\\n2. Compilation Detection:');
console.log('   Is Compiled:', isCompiled);

// 埋め込みファイルのリスト（Bun 1.x以降）
if (typeof Bun !== 'undefined' && Bun.embeddedFiles) {
  console.log('\\n3. Embedded Files:');
  console.log('   Bun.embeddedFiles:', Bun.embeddedFiles);
} else {
  console.log('\\n3. Embedded Files:');
  console.log('   Bun.embeddedFiles: Not available');
}

// ファイルの存在チェック
console.log('\\n4. File Existence Checks:');
console.log('   Current directory files:');
try {
  const files = fs.readdirSync(__dirname);
  files.forEach(file => {
    console.log('   -', file);
  });
} catch (error) {
  console.log('   Error reading directory:', error.message);
}

// process.cwdとの比較
console.log('\\n5. Working Directory:');
console.log('   process.cwd():', process.cwd());
console.log('   __dirname === process.cwd():', __dirname === process.cwd());

// パス解決のテスト
console.log('\\n6. Path Resolution:');
const testPath = path.join(__dirname, 'test.txt');
console.log('   path.join(__dirname, "test.txt"):', testPath);
console.log('   path.resolve("test.txt"):', path.resolve('test.txt'));

// 実行ファイルのディレクトリ
if (isCompiled) {
  const execDir = path.dirname(process.execPath);
  console.log('\\n7. Executable Directory (Compiled):');
  console.log('   path.dirname(process.execPath):', execDir);

  try {
    const files = fs.readdirSync(execDir);
    console.log('   Files in executable directory:');
    files.slice(0, 10).forEach(file => {
      console.log('   -', file);
    });
  } catch (error) {
    console.log('   Error:', error.message);
  }
}
`,
  "testApp/test-child-process.js": `#!/usr/bin/env node
// 子プロセスからの起動をテスト

const child_process = require('child_process');
const path = require('path');

console.log('=== Parent Process Information ===');
console.log('process.execPath:', process.execPath);
console.log('__dirname:', __dirname);

console.log('\\n=== Spawning Child Process ===');

// 子プロセスを起動
const childScript = path.join(__dirname, 'test-execpath.js');
console.log('Spawning:', childScript);

const child = child_process.spawn(
  process.execPath,
  [childScript],
  {
    stdio: 'inherit'
  }
);

child.on('exit', (code) => {
  console.log('\\nChild process exited with code:', code);
});

child.on('error', (error) => {
  console.error('Error spawning child:', error);
});
`,
  "testApp/test-execpath.js": `#!/usr/bin/env node
// process.execPath の挙動をテスト

console.log('=== Process Information ===');
console.log('process.execPath:', process.execPath);
console.log('process.argv[0]:', process.argv[0]);
console.log('process.argv[1]:', process.argv[1]);
console.log('__filename:', __filename);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('process.platform:', process.platform);

// Bunの特有のプロパティをチェック
if (typeof Bun !== 'undefined') {
  console.log('\\n=== Bun Specific ===');
  console.log('Bun.main:', Bun.main);
  console.log('Bun.argv:', Bun.argv);

  if (typeof import.meta !== 'undefined') {
    console.log('import.meta.path:', import.meta.path);
    console.log('import.meta.dir:', import.meta.dir);
    console.log('import.meta.file:', import.meta.file);
  }
}

// pkgによるコンパイル時のプロパティ
if (process.pkg) {
  console.log('\\n=== PKG Specific ===');
  console.log('process.pkg:', process.pkg);
}
`,
};

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

module.exports = {
  resources,
  getResource,
  getMimeType,
  listResources
};
