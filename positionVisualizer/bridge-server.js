// WebSocket bridge: accepts state from any client and broadcasts to all others.
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { io } from 'socket.io-client';
import { fileURLToPath } from 'url';

// ESM環境では__dirnameが使えないので代替手段を使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let latest = {
  values: [null, null, null, null, null, null],
  deviceIds: [null, null, null, null, null, null],  // デバイスIDを追跡
  names: [],
  icon: 'assets/icon.svg',
  svg: '',
  ts: Date.now()
};

// LeverAPI integration
const LEVER_API_URL = process.env.LEVER_API_URL || 'http://127.0.0.1:5001';
console.log('LeverAPI URL:', LEVER_API_URL);

// デバイスID → インデックスの動的マッピング
const deviceIdToIndex = new Map();
const indexToDeviceId = new Map();
let nextAvailableIndex = 0;

/**
 * デバイスIDに対応するインデックスを取得または割り当て
 * @param {string} deviceId デバイスID
 * @returns {number} インデックス（0-5）、失敗時は-1
 */
function getOrAssignDeviceIndex(deviceId) {
  if (!deviceId) return -1;

  // 既にマッピングがあればそれを返す
  if (deviceIdToIndex.has(deviceId)) {
    return deviceIdToIndex.get(deviceId);
  }

  // 新しいインデックスを割り当て（最大6台まで）
  if (nextAvailableIndex < 6) {
    const index = nextAvailableIndex++;
    deviceIdToIndex.set(deviceId, index);
    indexToDeviceId.set(index, deviceId);
    console.log(`[bridge] Assigned device ${deviceId} to index ${index}`);
    return index;
  }

  console.log(`[bridge] Device limit reached, cannot assign ${deviceId}`);
  return -1; // 上限に達した
}

/**
 * デバイス値を更新
 * @param {string} deviceId デバイスID
 * @param {number} value 値
 * @returns {boolean} 更新成功したか
 */
function updateDeviceValue(deviceId, value) {
  const index = getOrAssignDeviceIndex(deviceId);
  if (index < 0 || index >= 6) return false;
  if (typeof value !== 'number') return false;

  latest.values[index] = value;
  latest.deviceIds[index] = deviceId;
  return true;
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

        console.log(`[bridge] device_update: device_id=${device_id}, value=${valueData.value}`);

        if (updateDeviceValue(device_id, valueData.value)) {
          latest.ts = Date.now();
          const index = deviceIdToIndex.get(device_id);
          console.log(`[bridge] Broadcasting update: index=${index}, deviceId=${device_id}, value=${valueData.value}`);
          broadcast({ type: 'state', payload: latest });
        } else {
          console.log(`[bridge] device_update: failed to update device ${device_id}`);
        }
      } catch (error) {
        console.error('Error processing device_update:', error);
      }
    });

    // Subscribe to devices_update events (batch updates)
    leverApiSocket.on('devices_update', (data) => {
      try {
        if (data.updates && typeof data.updates === 'object') {
          let hasChanges = false;

          Object.keys(data.updates).forEach(deviceId => {
            const valueData = data.updates[deviceId];
            if (valueData && updateDeviceValue(deviceId, valueData.value)) {
              hasChanges = true;
            }
          });

          if (hasChanges) {
            latest.ts = Date.now();
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
          let hasChanges = false;

          Object.keys(data).forEach(deviceId => {
            const valueData = data[deviceId];
            if (valueData && updateDeviceValue(deviceId, valueData.value)) {
              hasChanges = true;
            }
          });

          if (hasChanges) {
            latest.ts = Date.now();
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
// ログディレクトリとJSONディレクトリの作成を行わない
console.log('ログとJSONファイルの保存を無効化して実行します');

// メモリ内にログを一時的に保存する変数
const memoryLogs = {};

const server = http.createServer((req, res) => {
  // Basic health + optional HTTP fallback for debugging
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET' && req.url === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(latest));
    return;
  }

  // Log saving endpoint (インメモリ保存)
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

        const filename = data.filename || `meter-log-${Date.now()}.json`;
        // メモリ内に保存
        memoryLogs[filename] = data.records;

        console.log(`Log saved in memory: ${filename}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filename: filename }));

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

// WebSocketServerの作成（圧縮を有効化してパフォーマンスを最適化）
const wss = new WebSocketServer({
  server,
  // perMessageDeflate圧縮を有効化（帯域幅を20-40%削減）
  perMessageDeflate: {
    // zlibの圧縮レベル（0-9）
    // レベル3: 圧縮速度とサイズのバランスが最適
    zlibDeflateOptions: {
      level: 3 // 0=圧縮なし, 9=最高圧縮（遅い）
    },
    // 128バイト未満のメッセージは圧縮しない（オーバーヘッド削減）
    threshold: 128
  }
});

function broadcast(obj, exclude) {
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
        const index = getOrAssignDeviceIndex(data.device_id);
        if (index >= 0 && index < 6) {
          const value = data.data.value;
          if (typeof value === 'number') {
            latest.values[index] = value;
            latest.deviceIds[index] = data.device_id;  // デバイスIDを保存
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
  console.log(`bridge listening ws://${HOST}:${PORT}`);
});

// エラーハンドリングの強化
server.on('error', (err) => {
  console.error('WebSocketサーバーエラー:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`ポート ${PORT} は既に使用されています。別のポートを試します...`);
    server.close();
    const newPort = PORT + 1;
    server.listen(newPort, HOST, () => {
      console.log(`代替ポート ${newPort} で起動しました: ws://${HOST}:${newPort}`);
      console.log(`環境変数 BRIDGE_PORT=${newPort} を設定することで、このポートを永続的に使用できます`);
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
