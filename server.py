# viewer_server.py
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse
import os
import shutil
import hashlib

class COOPCORPHandler(SimpleHTTPRequestHandler):
    # Class-level storage shared across all instances
    file_cache = {}
    
    def serve_viewer(self, parsed_path):
        try:
            query_params = urllib.parse.parse_qs(parsed_path.query)
            file_path = query_params.get('file', [None])[0]
            
            with open('index.html', 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            if file_path and os.path.exists(file_path):
                # Create a direct file URL
                file_url = self.register_file(file_path)
                html_content = html_content.replace('{{PLY_DATA}}', file_url)
                
                file_size = os.path.getsize(file_path)
                print(f" Direct file URL: {file_url} -> {file_path} ({file_size/1024/1024:.1f} MB)")
                print(f" Cache size: {len(self.file_cache)} files")
            else:
                html_content = html_content.replace('{{PLY_DATA}}', '')
            
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(html_content.encode('utf-8'))
            
        except Exception as e:
            print(f" Error in serve_viewer: {e}")
            self.send_error(500, f"Error: {str(e)}")
    
    def register_file(self, file_path):
        """Register file and return a serving URL"""
        file_id = hashlib.md5(file_path.encode()).hexdigest()[:12]
        self.file_cache[file_id] = file_path
        return f"/serve/{file_id}"
    
    def serve_file(self, parsed_path):
        """Serve file directly - no encoding, just stream bytes"""
        try:
            path_parts = parsed_path.path.split('/')
            if len(path_parts) >= 3:
                file_id = path_parts[2]
                file_path = self.file_cache.get(file_id)
                
                print(f"🔍 Looking up file_id: {file_id}")
                print(f"📁 Available files in cache: {list(self.file_cache.keys())}")
                
                if file_path and os.path.exists(file_path):
                    file_size = os.path.getsize(file_path)
                    print(f"📦 Streaming file: {file_path} ({file_size} bytes)")
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/octet-stream')
                    self.send_header('Content-Length', str(file_size))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    # Stream file directly
                    with open(file_path, 'rb') as f:
                        shutil.copyfileobj(f, self.wfile)
                    return
                else:
                    print(f" File not found in cache: {file_id}")
                    print(f" File path exists: {os.path.exists(file_path) if file_path else 'No path'}")
            
            self.send_error(404, f"File not found. Cache has {len(self.file_cache)} files: {list(self.file_cache.keys())}")
            
        except Exception as e:
            print(f" Error serving file: {e}")
            self.send_error(500, f"Error: {str(e)}")
    
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        print(f" Request: {self.path}")
        
        if parsed_path.path == '/viewer':
            self.serve_viewer(parsed_path)
        elif parsed_path.path.startswith('/serve/'):
            self.serve_file(parsed_path)
        else:
            super().do_GET()

def start_viewer_server(port=9001):
    print("✅ Serving with COOP/COEP headers...")
    print("🌐 Viewer available at: http://0.0.0.0:9001/viewer")
    server = HTTPServer(('0.0.0.0', port), COOPCORPHandler)
    server.serve_forever()

if __name__ == '__main__':
    start_viewer_server()