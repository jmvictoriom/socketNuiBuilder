# WS Bridge (Render)

Servidor WebSocket con “salas” por `code`. Listo para Render.

## Despliegue en Render

1. Crea un repo con estos archivos y súbelo a GitHub.
2. En **Render Dashboard** → **New** → **Web Service**.
3. Conecta el repo.
4. Configura:
   - **Environment**: Node
   - **Build Command**: `npm ci`  (o `npm install`)
   - **Start Command**: `npm start`
   - **Region**: la más cercana a tus usuarios (EU si estás en España).
5. Deploy.

### Probar
- Abre la URL de tu servicio (p. ej. `[https://tu-servicio.onrender.com/test](https://socketnuibuilder.onrender.com/test)`).
- En consola verás logs del tester inline, o abre dos pestañas y usa la sala por defecto (`842913`).
- Cliente WebSocket:
  ```js
  const code = '842913';
  const ws = new WebSocket(`wss://${location.host}/bridge?code=${encodeURIComponent(code)}`);
  ws.onopen    = () => ws.send(JSON.stringify({ hello:'world', ts: Date.now() }));
  ws.onmessage = (e) => console.log('IN', e.data);
