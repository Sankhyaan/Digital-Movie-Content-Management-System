#!/usr/bin/env python3
"""
CineVerse Local Embedding Service
Provides fast sentence embeddings via HTTP on localhost using all-MiniLM-L6-v2.
"""
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from sentence_transformers import SentenceTransformer

PORT = 5002

print(f"Loading local embedding model 'all-MiniLM-L6-v2'...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print(f"Model loaded successfully. Dimension: {model.get_sentence_embedding_dimension()}")

class EmbeddingHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'model': 'all-MiniLM-L6-v2'}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/embed':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                texts = data.get('texts', [])
                if isinstance(texts, str):
                    texts = [texts]
                embeddings = model.encode(texts, normalize_embeddings=True).tolist()
                response = {'success': True, 'embeddings': embeddings}
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress routine logging
        return

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), EmbeddingHandler)
    print(f"Embedding server running at http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping embedding server...")
        server.server_close()
