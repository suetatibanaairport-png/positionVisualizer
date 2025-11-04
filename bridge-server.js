// WebSocket bridge: accepts state from any client and broadcasts to all others.
(function(){
  const http = require('http');
  const WebSocket = require('ws');

  let latest = { values: [20,45,75,45], names: [], icon: 'assets/icon.svg', svg: '', ts: Date.now() };

  const server = http.createServer((req, res) => {
    // Basic health + optional HTTP fallback for debugging
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && req.url === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latest));
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
          latest = { ...latest, ...data.payload, ts: Date.now() };
          broadcast({ type: 'state', payload: latest }, ws);
        }
      } catch(_) {}
    });
  });

  const PORT = Number(process.env.BRIDGE_PORT || 8123);
  const HOST = process.env.BRIDGE_HOST || '127.0.0.1';
  server.listen(PORT, HOST, () => {
    console.log(`bridge listening ws://${HOST}:${PORT}`);
  });
})();


