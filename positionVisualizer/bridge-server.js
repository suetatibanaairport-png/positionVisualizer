// WebSocket bridge: accepts state from any client and broadcasts to all others.
(function(){
  const http = require('http');
  const WebSocket = require('ws');
  const fs = require('fs');
  const path = require('path');
  const io = require('socket.io-client');

  let latest = { values: [null, null, null, null, null, null], names: [], icon: 'assets/icon.svg', svg: '', ts: Date.now() };

  // LeverAPI integration
  const LEVER_API_URL = process.env.LEVER_API_URL || 'http://127.0.0.1:5001';
  console.log('LeverAPI URL:', LEVER_API_URL);
  
  // Map device_id to index (lever1 -> 0, lever2 -> 1, etc.)
  function getDeviceIndex(deviceId) {
    if (!deviceId) return -1;
    // Try to extract number from device_id (lever1 -> 0, lever2 -> 1, etc.)
    const match = String(deviceId).match(/(\d+)$/);
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
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`${name}ディレクトリを作成しました`);
      }

      // 書き込み権限の確認
      try {
        fs.accessSync(dir, fs.constants.W_OK);
      } catch (accessErr) {
        console.warn(`${name}ディレクトリへの書き込み権限がありません:`, accessErr.message);
        throw accessErr;
      }

      return dir;
    } catch (err) {
      console.error(`${name}ディレクトリエラー:`, err.message);
      // エラー時の代替ディレクトリ（カレントディレクトリ）
      const altDir = path.join(process.cwd(), name);
      console.log(`代替${name}ディレクトリを作成します: ${altDir}`);
      try {
        fs.mkdirSync(altDir, { recursive: true });
        return altDir;
      } catch (e) {
        console.error(`代替${name}ディレクトリの作成に失敗しました:`, e.message);
        // 最終手段としてテンポラリディレクトリを使用
        const tmpDir = path.join(require('os').tmpdir(), name);
        console.warn(`テンポラリディレクトリを使用します: ${tmpDir}`);
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
})();

