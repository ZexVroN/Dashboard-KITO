"""Jalankan dashboard lokal: python tools/serve_local.py [--port 8000]."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        parser.exit(1, f'Server tidak dapat dijalankan: {error}\nCoba --port 8001.\n')
    with server:
        print(f'Buka http://localhost:{server.server_port} untuk dashboard lokal.', flush=True)
        print('Tekan Ctrl+C untuk berhenti. Tidak memerlukan koneksi internet.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
