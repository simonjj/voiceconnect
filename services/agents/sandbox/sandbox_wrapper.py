#!/usr/bin/env python3
"""
Tiny HTTP wrapper that runs inside an ACA Sandbox and exposes Copilot CLI over HTTP.

Deployed via `aca sandbox fs write` and started via `aca sandbox exec`, then exposed
publicly via `aca sandbox port add --anonymous`. The corresponding agent (running in
an Azure Container Apps Express environment, which forbids Managed Identity) calls
this endpoint directly via plain HTTPS — no aca CLI auth required.

Protocol:
  POST /run  {"prompt": "..."}  ->  raw NDJSON stdout from
      copilot -p "$PROMPT" --allow-all-tools --output-format json
"""
import http.server
import json
import os
import subprocess
import sys
import tempfile


COPILOT_TIMEOUT_SEC = int(os.environ.get("COPILOT_TIMEOUT_SEC", "180"))


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes = b"", content_type: str = "text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/health"):
            self._send(200, b'{"status":"ok"}', "application/json")
            return
        self._send(404, b"not found")

    def do_POST(self):
        if self.path != "/run":
            self._send(404, b"not found")
            return
        n = int(self.headers.get("content-length", "0") or "0")
        raw = self.rfile.read(n).decode("utf-8", errors="replace") if n else "{}"
        try:
            data = json.loads(raw)
            prompt = data.get("prompt", "")
            model = data.get("model", "") or ""
        except Exception:
            self._send(400, b'{"type":"error","content":"invalid json"}', "application/x-ndjson")
            return
        if not isinstance(prompt, str) or not prompt.strip():
            self._send(400, b'{"type":"error","content":"empty prompt"}', "application/x-ndjson")
            return

        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as tf:
            tf.write(prompt)
            prompt_path = tf.name
        try:
            model_arg = ""
            if isinstance(model, str) and model.strip():
                # Whitelist: only allow safe characters in model name (no shell metachars).
                m = model.strip()
                if all(c.isalnum() or c in "-._:" for c in m):
                    model_arg = f" --model {m}"
            shell_cmd = (
                f'P=$(cat {prompt_path}); '
                f'copilot -p "$P" --allow-all-tools --output-format json{model_arg}'
            )
            try:
                r = subprocess.run(
                    ["bash", "-lc", shell_cmd],
                    capture_output=True,
                    timeout=COPILOT_TIMEOUT_SEC,
                )
            except subprocess.TimeoutExpired:
                self._send(
                    504,
                    b'{"type":"error","content":"copilot timeout"}',
                    "application/x-ndjson",
                )
                return

            body = r.stdout or b""
            if r.returncode != 0 and not body:
                msg = (r.stderr or b"").decode("utf-8", errors="replace")[:500]
                payload = json.dumps({"type": "error", "content": f"copilot rc={r.returncode}: {msg}"}).encode("utf-8") + b"\n"
                self._send(500, payload, "application/x-ndjson")
                return
            self._send(200, body, "application/x-ndjson")
        finally:
            try:
                os.unlink(prompt_path)
            except Exception:
                pass

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(os.environ.get("WRAPPER_PORT", "8080"))
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    sys.stderr.write(f"sandbox-wrapper listening on 0.0.0.0:{port}\n")
    server.serve_forever()


if __name__ == "__main__":
    main()
