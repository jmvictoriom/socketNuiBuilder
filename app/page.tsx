'use client';
import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const [code, setCode] = useState('842913');
  const [log, setLog] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = () => {
    wsRef.current?.close();
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/bridge?code=${code}`);
    ws.onopen = () => push(`CONNECTED room ${code}`);
    ws.onmessage = (e) => push(`IN  ${e.data}`);
    ws.onclose = () => push('CLOSED');
    ws.onerror = () => push('ERROR');
    wsRef.current = ws;
  };

  const push = (s: string) => setLog(prev => [`${new Date().toLocaleTimeString()} ${s}`, ...prev]);

  const sendJson = () => {
    wsRef.current?.send(JSON.stringify({ kind:'note', text:'hola desde web', ts: Date.now() }));
  };

  useEffect(() => () => wsRef.current?.close(), []);

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">WS Bridge (Edge)</h1>
      <div className="flex gap-2 mb-2">
        <input className="border rounded px-2 py-1 flex-1" value={code} onChange={e=>setCode(e.target.value)} />
        <button className="bg-black text-white px-3 py-1 rounded" onClick={connect}>Conectar</button>
        <button className="border px-3 py-1 rounded" onClick={sendJson}>Enviar JSON</button>
      </div>
      <pre className="border rounded p-3 h-80 overflow-auto text-sm whitespace-pre-wrap">{log.join('\n')}</pre>
      <p className="mt-3 text-gray-500">Abre dos pestañas con el mismo code para probar.</p>
    </main>
  );
}