export const runtime = 'edge';
export const dynamic = 'force-dynamic';
// opcional pero recomendado: fija región del deploy que viste en logs (iad1)
export const preferredRegion = ['iad1'];

export function GET(req: Request) {
  // @ts-ignore
  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0] as WebSocket;  // se devuelve al navegador
  const server = pair[1] as WebSocket;  // se maneja aquí

  // ¡clave!: aceptar antes de escuchar
  // @ts-ignore
  server.accept();

  server.addEventListener('message', (evt: MessageEvent) => {
    try {
      // eco simple, si es string reenvía tal cual, si es binario igual
      server.send(typeof evt.data === 'string' ? evt.data : evt.data);
    } catch (e) {
      try { server.send(JSON.stringify({ error: String(e) })); } catch {}
    }
  });

  server.addEventListener('close', () => {
    // nada
  });
  server.addEventListener('error', () => {
    // nada
  });

  return new Response(null, {
    status: 101,
    // @ts-ignore
    webSocket: client,
  });
}