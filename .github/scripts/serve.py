# Serves the built sample apps (samples/site/<app>/ or samples/site-wasm/<app>/) on 127.0.0.1:<port>, with the headers a
# multi-threaded WebAssembly build needs (COOP/COEP) when --isolated is given, and the MIME type of
# .wasm files. For this repository's suite; the Workspace's plugin serves an app from its own container.
#   python3 serve.py <folder> <port> [--isolated]
import functools, http.server, sys

folder, port = sys.argv[1], int(sys.argv[2])
isolated = '--isolated' in sys.argv[3:]

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.mjs': 'text/javascript'}

    def end_headers(self):
        if isolated:
            self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
            self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.log_date_time_string(), fmt % args))

server = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=folder))
print(f'serving {folder} at http://127.0.0.1:{port}/ (cross-origin isolated: {isolated})', flush=True)
server.serve_forever()
