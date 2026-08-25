#!/usr/bin/env python3
import os, sys, sqlite3, mimetypes, urllib.parse, time, json
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests

DB_PATH = '/usr/local/apps/@appdata/trim.media/database/trimmedia.db'

# 内存缓存已解析的最终云端直链 { file_path: (resolved_url, expire_time) }
strm_cache = {}

def get_media_info(guid):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT path, item_guid FROM item_media WHERE guid = ?", (guid,))
        r = c.fetchone()
        if r and r[0] and os.path.exists(r[0]):
            conn.close()
            return r[0], r[1]
        c.execute("SELECT path, item_guid FROM item_media WHERE item_guid = ? ORDER BY sort_num ASC, size DESC", (guid,))
        r = c.fetchone()
        if r and r[0] and os.path.exists(r[0]):
            conn.close()
            return r[0], r[1]
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")
    return None, None

def resolve_strm_target(file_path):
    now = time.time()
    if file_path in strm_cache:
        cached_url, expire = strm_cache[file_path]
        if now < expire:
            return cached_url

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            strm_url = f.read().strip()

        if strm_url.startswith(('http://', 'https://')):
            try:
                r = requests.get(strm_url, allow_redirects=False, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
                if r.status_code in (301, 302, 303, 307, 308) and r.headers.get('Location'):
                    final_url = r.headers.get('Location')
                else:
                    final_url = strm_url
            except Exception:
                final_url = strm_url
            
            strm_cache[file_path] = (final_url, now + 7200) # 缓存2小时
            return final_url
        elif os.path.exists(strm_url):
            return strm_url
    except Exception as e:
        print(f"Resolve error: {e}")

    return None

class StreamHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_HEAD(self):
        self.handle_request(send_body=False)

    def do_GET(self):
        self.handle_request(send_body=True)

    def handle_request(self, send_body=True):
        parsed = urllib.parse.urlparse(self.path)
        parts = [p for p in parsed.path.split('/') if p]
        
        if not parts:
            self.send_error(404)
            return

        # 1. 前端直链解析 API: /fnresolve/{guid}
        if parts[0] == 'fnresolve' and len(parts) >= 2:
            guid = parts[1]
            file_path, item_guid = get_media_info(guid)
            if not file_path:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'code': -1, 'msg': 'Not found'}).encode('utf-8'))
                return

            if file_path.lower().endswith('.strm'):
                final_url = resolve_strm_target(file_path)
                data = {'code': 0, 'url': final_url, 'type': 'strm', 'file': os.path.basename(file_path)}
            else:
                host = self.headers.get("Host", "127.0.0.1:5668")
                local_url = f"http://{host}/fnplay/{guid}/video.mp4"
                data = {'code': 0, 'url': local_url, 'type': 'local', 'file': os.path.basename(file_path)}

            resp_bytes = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp_bytes)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if send_body:
                self.wfile.write(resp_bytes)
            return

        # 2. 媒体流服务: /fnplay/{guid}/...
        if parts[0] == 'fnplay' and len(parts) >= 2:
            guid = parts[1]
            file_path, item_guid = get_media_info(guid)
            if not file_path or not os.path.exists(file_path):
                self.send_error(404, "Media file not found on disk")
                return

            if file_path.lower().endswith('.strm'):
                target_url = resolve_strm_target(file_path)
                if target_url and target_url.startswith(('http://', 'https://')):
                    self.send_response(302)
                    self.send_header('Location', target_url)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    return
                elif target_url and os.path.exists(target_url):
                    file_path = target_url

            try:
                file_size = os.path.getsize(file_path)
                content_type, _ = mimetypes.guess_type(file_path)
                if not content_type or not content_type.startswith('video/'):
                    content_type = 'video/mp4'

                range_header = self.headers.get('Range')
                if range_header:
                    range_match = range_header.replace('bytes=', '').strip()
                    range_parts = range_match.split('-')
                    start = int(range_parts[0]) if range_parts[0] else 0
                    end = int(range_parts[1]) if len(range_parts) > 1 and range_parts[1] else file_size - 1
                    if start >= file_size or end >= file_size:
                        self.send_response(416)
                        self.send_header('Content-Range', f'bytes */{file_size}')
                        self.end_headers()
                        return
                    length = end - start + 1
                    self.send_response(206)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                    self.send_header('Content-Length', str(length))
                    self.send_header('Accept-Ranges', 'bytes')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()

                    if send_body:
                        with open(file_path, 'rb') as f:
                            f.seek(start)
                            remaining = length
                            while remaining > 0:
                                chunk_size = min(remaining, 128 * 1024)
                                data = f.read(chunk_size)
                                if not data:
                                    break
                                self.wfile.write(data)
                                remaining -= len(data)
                else:
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(file_size))
                    self.send_header('Accept-Ranges', 'bytes')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()

                    if send_body:
                        with open(file_path, 'rb') as f:
                            while True:
                                data = f.read(128 * 1024)
                                if not data:
                                    break
                                self.wfile.write(data)
            except Exception:
                pass
            return

        self.send_error(404)

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 5668), StreamHandler)
    print("fnplay stream server listening on 0.0.0.0:5668...")
    server.serve_forever()