export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export function GET() {
  // @ts-ignore
  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0] as WebSocket;
  const server = pair[1] as WebSocket;

  // @ts-ignore
  server.accept();

  server.addEventListener('message', (evt: MessageEvent) => {
    try {
      if (typeof evt.data === 'string') server.send(evt.data);
      else server.send(evt.data as any);
    } catch {}
  });

  return new Response(null, {
    status: 101,
    // @ts-ignore
    webSocket: client,
  });
}