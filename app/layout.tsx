export const metadata = { title: 'WS Bridge', description: 'Edge WebSocket bridge' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'ui-sans-serif, system-ui' }}>{children}</body>
    </html>
  );
}