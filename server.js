import http from 'http';
import { WebSocketServer } from 'ws';
import { parse as parseUrl } from 'url';

// --- HTTP server (salud + página mínima) ---
const server = http.createServer((req, res) => {
  const { pathname } = parseUrl(req.url);
  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
    <meta charset="utf-8"/>
    <title>WS Bridge</title>
    <h1>WS Bridge on Render ✅</h1>
    <p>Endpoint WS: <code>wss://TU-SERVICIO.onrender.com/bridge?code=842913</code></p>
    <script>
      // tester básico en el navegador
      const code = '842913';
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/bridge?code=' + encodeURIComponent(code));
      ws.onopen    = () => { console.log('[OPEN]'); ws.send(JSON.stringify({ hello:'world', ts: Date.now(), code })); };
      ws.onmessage = (e) => console.log('[IN]', e.data);
      ws.onerror   = (e) => console.log('[ERROR]', e);
      ws.onclose   = (e) => console.log('[CLOSE]', e.code, e.reason || '(no reason)');
    </script>
  `);
});

// --- WS server ---
const wss = new WebSocketServer({ noServer: true });

// Salas por código: Map<string, Set<WebSocket>>
const rooms = new Map();
// Conjunto de todos los sockets para heartbeat
const allClients = new Set();

// Handshake WS solo en /bridge
server.on('upgrade', (req, socket, head) => {
  const { pathname } = parseUrl(req.url);
  if (pathname !== '/bridge') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws, req) => {
  const { query } = parseUrl(req.url, true);
  const code = (query.code || 'default').toString();

  // Estado conexión (keep-alive)
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Sala
  let set = rooms.get(code);
  if (!set) { set = new Set(); rooms.set(code, set); }
  set.add(ws);
  allClients.add(ws);

  // Presencia simple
  safeSend(ws, JSON.stringify({ system: 'joined', count: set.size, code }));

  ws.on('message', (data) => {
    // retransmite a todos de la sala menos al emisor
    for (const c of set) {
      if (c !== ws && c.readyState === 1) {
        safeSend(c, data);
      }
    }
  });

  const cleanup = () => {
    try {
      set.delete(ws);
      allClients.delete(ws);
      if (set.size === 0) rooms.delete(code);
    } catch {}
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

// Heartbeat para mantener viva la conexión y limpiar zombies
const interval = setInterval(() => {
  for (const ws of allClients) {
    if (ws.readyState !== 1) { allClients.delete(ws); continue; }
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} allClients.delete(ws); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30000);

process.on('SIGTERM', () => { clearInterval(interval); server.close(() => process.exit(0)); });

// Arranque
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('WS Bridge listening on :' + PORT);
});

// Helper
function safeSend(ws, data) {
  try { ws.send(data); } catch {}
}