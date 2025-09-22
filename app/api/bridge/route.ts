export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Client = { ws: WebSocket; code: string };
const rooms = new Map<string, Set<Client>>();

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code') ?? 'default';

  // Crea el par y acepta el lado del servidor
  // @ts-ignore - WebSocketPair está disponible en Edge Runtime
  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0] as WebSocket;
  const server = pair[1] as WebSocket;

  // Aceptar el WS del lado del servidor (clave del handshake)
  (server as any).accept();

  const clientObj: Client = { ws: server, code };

  let set = rooms.get(code);
  if (!set) { set = new Set(); rooms.set(code, set); }
  set.add(clientObj);

  // Presencia simple
  broadcast(code, { system: 'joined', count: set.size }, server);

  server.addEventListener('message', (event: MessageEvent) => {
    try {
      const payload = typeof event.data === 'string'
        ? JSON.parse(event.data)
        : event.data;
      broadcast(code, payload, server); // reenvía a todos menos emisor
    } catch {
      broadcast(code, event.data, server);
    }
  });

  const onClose = () => {
    const room = rooms.get(code);
    if (!room) return;
    room.delete(clientObj);
    if (room.size === 0) rooms.delete(code);
  };
  server.addEventListener('close', onClose);
  server.addEventListener('error', onClose);

  // Devuelve el lado del cliente al navegador (upgrade 101)
  return new Response(null, {
    status: 101,
    // @ts-ignore
    webSocket: client,
  });
}

function broadcast(code: string, payload: any, except?: WebSocket) {
  const set = rooms.get(code);
  if (!set) return;
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const c of set) {
    // 1 === WebSocket.OPEN
    if (c.ws !== except && (c.ws as any).readyState === 1) {
      try { c.ws.send(data); } catch {}
    }
  }
}