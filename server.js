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
  if (pathname === '/test') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>WS Tester</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 2rem auto; }
    input, button { padding: 8px; margin: 4px 0; border-radius: 6px; border: 1px solid #ccc; }
    #log { border: 1px solid #ddd; border-radius: 6px; padding: 8px; height: 250px; overflow-y: auto; background: #fafafa; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Tester WebSocket</h1>
  <label>Room code: <input id="room" value="842913" /></label><br>
  <button id="connect">Conectar</button>
  <br><br>
  <input id="msg" placeholder="Escribe un mensaje..." style="width:80%" />
  <button id="send">Enviar</button>

  <h3>Log:</h3>
  <div id="log"></div>

  <script>
    let ws;
    const logBox = document.getElementById('log');
    const append = (txt) => {
      const p = document.createElement('div');
      p.textContent = new Date().toLocaleTimeString() + ' ' + txt;
      logBox.prepend(p);
    };

    document.getElementById('connect').onclick = () => {
      const code = document.getElementById('room').value;
      const url = 'wss://' + location.host + '/bridge?code=' + encodeURIComponent(code);
      ws = new WebSocket(url);
      ws.onopen = () => append('[OPEN] conectado a sala ' + code);
      ws.onmessage = (e) => append(e.data);
      ws.onerror = (e) => append('[ERROR]');
      ws.onclose = (e) => append('[CLOSE] ' + e.code + ' ' + (e.reason || ''));
    };

    document.getElementById('send').onclick = () => {
      if (!ws || ws.readyState !== 1) return append('⚠ No conectado');
      const text = document.getElementById('msg').value;
      const payload = { text };
      ws.send(JSON.stringify(payload));
      append('[OUT] ' + JSON.stringify(payload));
      document.getElementById('msg').value = '';
    };
  </script>
</body>
</html>`);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<h1>WS Bridge on Render ✅</h1><p>Visita <a href="/test">/test</a> para probar.</p>');
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

  ws.on('message', (data, isBinary) => {
    // convierte a string si no es binario
    const outgoing = isBinary ? data : data.toString();

    // retransmite a todos en la sala, excepto al emisor
    for (const c of set) {
      if (c !== ws && c.readyState === 1) {
        let outgoing = isBinary ? data : data.toString();
        try {
        // si es JSON válido, lo dejas tal cual (string)
            JSON.parse(outgoing);
        } catch {
        // si no es JSON, lo conviertes en JSON
            outgoing = JSON.stringify({ text: outgoing });
        }
        c.send(outgoing);
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