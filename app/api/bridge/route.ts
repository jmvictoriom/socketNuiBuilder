export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const preferredRegion = ['iad1'];

type Client = { ws: WebSocket; code: string };
const rooms = new Map<string, Set<Client>>();

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code') ?? 'default';

  // @ts-ignore
  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0] as WebSocket;
  const server = pair[1] as WebSocket;

  // aceptar antes de listeners
  // @ts-ignore
  server.accept();

  const clientObj: Client = { ws: server, code };
  let set = rooms.get(code);
  if (!set) { set = new Set(); rooms.set(code, set); }
  set.add(clientObj);

  safeSend(server, JSON.stringify({ system: 'joined', count: set.size }));

  server.addEventListener('message', (evt: MessageEvent) => {
    const msg = evt.data;
    // intenta parsear si es string, si no, reenvía tal cual
    let payload: any = msg;
    if (typeof msg === 'string') {
      try { payload = JSON.parse(msg); } catch { /* deja string */ }
    }
    broadcast(code, payload, server);
  });

  const onClose = () => {
    const room = rooms.get(code);
    if (!room) return;
    room.delete(clientObj);
    if (room.size === 0) rooms.delete(code);
  };
  server.addEventListener('close', onClose);
  server.addEventListener('error', onClose);

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
    if (c.ws !== except && (c.ws as any).readyState === 1) safeSend(c.ws, data);
  }
}

function safeSend(ws: WebSocket, data: string | ArrayBuffer | Uint8Array) {
  try { (ws as any).send(data); } catch {}
}