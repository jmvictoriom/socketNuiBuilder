# Vercel WS Bridge (Edge)

Puente WebSocket sin auth, por "sala" = `code`.

## Deploy

1. `npm i`
2. `vercel` (o conecta repo en Vercel y deploy automático)

## Probar en web
- Abre el `https://tu-deploy.vercel.app/`
- Conéctate con un `code` y envía JSON. En otra pestaña usa el mismo code y verás el mensaje.

## Cliente iOS/macOS (WebSocket nativo)
Ejemplo Swift (URLSessionWebSocketTask):

```swift
import Foundation

final class WSClient: NSObject {
    private var task: URLSessionWebSocketTask?
    private let code: String
    private let url: URL

    init(baseURL: String, code: String) {
        self.code = code
        self.url = URL(string: "\(baseURL)/api/bridge?code=\(code)")!
    }

    func connect() {
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
        self.task = session.webSocketTask(with: url)
        self.task?.resume()
        receive()
    }

    func send(json: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: json) else { return }
        task?.send(.data(data)) { error in
            if let error = error { print("send error:", error) }
        }
    }

    private func receive() {
        task?.receive { [weak self] result in
            switch result {
            case .failure(let err):
                print("recv error:", err)
            case .success(let message):
                switch message {
                case .data(let d):
                    if let obj = try? JSONSerialization.jsonObject(with: d) {
                        print("JSON IN >", obj)
                    } else {
                        print("BIN IN >", d.count, "bytes")
                    }
                case .string(let s):
                    print("STR IN >", s)
                @unknown default: break
                }
            }
            self?.receive()
        }
    }

    func disconnect() {
        task?.cancel(with: .goingAway, reason: nil)
    }
}

extension WSClient: URLSessionDelegate {}