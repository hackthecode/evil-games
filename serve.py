# Локален сървър за портала без кеширане (винаги най-новите файлове при разработка).
# Употреба: python3 serve.py [порт]
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
