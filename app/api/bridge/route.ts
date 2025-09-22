export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Client = {
  ws: WebSocket;
  code: string;
};

const rooms = new Map<string, Set<Client>>();

/**
 * Protocolo mínimo:
 * 1) Conecta a wss://.../api/bridge?code=842913
 * 2) Envía JSON plano, ej: { "kind":"note", "text":"hola" }
 * 3) El server reenvía ese JSON a los demás clientes en la misma sala (code)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code') || 'default';

  // Vercel Edge: WebSocket upgrade estilo standard
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected websocket', { status: 426 });
  }

  // @ts-ignore - WebSocketPair está disponible en Edge Runtime
  const { 0: client, 1: server } = new (globalThis as any).WebSocketPair();
  const ws = server as WebSocket;

  (ws as any).accept();

  const clientObj: Client = { ws, code };
  let set = rooms.get(code);
  if (!set) {
    set = new Set();
    rooms.set(code, set);
  }
  set.add(clientObj);

  // avisa presencia simple
  broadcast(code, { system: 'joined', count: set.size }, ws);

  ws.addEventListener('message', (event: MessageEvent) => {
    try {
      const payload = typeof event.data === 'string'
        ? JSON.parse(event.data)
        : event.data; // si llega binario, lo reenvía tal cual

      // reenvía a todos menos al emisor
      broadcast(code, payload, ws);
    } catch {
      // si no es JSON, reenvía la cadena tal cual
      broadcast(code, event.data, ws);
    }
  });

  ws.addEventListener('close', () => {
    cleanup(clientObj);
  });
  ws.addEventListener('error', () => {
    cleanup(clientObj);
  });

  return new Response(null, {
    status: 101,
    // @ts-ignore
    webSocket: client
  });
}

function broadcast(code: string, payload: any, except?: WebSocket) {
  const set = rooms.get(code);
  if (!set) return;
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const c of set) {
    if (c.ws !== except && (c.ws as any).readyState === 1) {
      try { c.ws.send(data); } catch {}
    }
  }
}

function cleanup(client: Client) {
  const set = rooms.get(client.code);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) rooms.delete(client.code);
}