#!/usr/bin/env python3
import os, sys, sqlite3, mimetypes, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB_PATH = '/usr/local/apps/@appdata/trim.media/database/trimmedia.db'

def get_media_info(guid):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        real_name = None
        # 1. 优先从 item 表获取准确的标题或文件名
        c.execute("SELECT title, filename, path FROM item WHERE guid = ?", (guid,))
        r = c.fetchone()
        if r:
            title, filename, path = r
            candidate = title if (title and title.strip()) else filename
            if candidate:
                real_name = os.path.splitext(candidate)[0]

        # 2. 查 item_media by guid
        c.execute("SELECT path, item_guid FROM item_media WHERE guid = ?", (guid,))
        r = c.fetchone()
        if r and r[0] and os.path.exists(r[0]):
            conn.close()
            return r[0], r[1], real_name

        # 3. 查 item_media by item_guid
        c.execute("SELECT path, item_guid FROM item_media WHERE item_guid = ? ORDER BY sort_num ASC, size DESC", (guid,))
        r = c.fetchone()
        if r and r[0] and os.path.exists(r[0]):
            conn.close()
            return r[0], r[1], real_name

        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")
    return None, None, None

def safe_quote_url(url):
    parts = urllib.parse.urlsplit(url)
    quoted_path = urllib.parse.quote(urllib.parse.unquote(parts.path), safe='/:')
    quoted_query = urllib.parse.quote(urllib.parse.unquote(parts.query), safe='=&/:?%+') if parts.query else ''
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, quoted_path, quoted_query, parts.fragment))

class StreamHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Content-Length', '0')
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

        if parts[0] == 'fnplay' and len(parts) >= 2:
            guid = parts[1]
            file_path, item_guid, real_name = get_media_info(guid)
            if not file_path or not os.path.exists(file_path):
                self.send_error(404, "Media file not found on disk")
                return

            # 如果请求没有携带具体文件名（如 /fnplay/{guid}/），自动 302 重定向到带真实片名的 URL
            if len(parts) == 2 and not file_path.lower().endswith('.strm'):
                display_name = real_name or os.path.splitext(os.path.basename(file_path))[0] or "video"
                ext = os.path.splitext(file_path)[1] or ".mkv"
                target_url = f"/fnplay/{guid}/{urllib.parse.quote(display_name + ext)}"
                self.send_response(302)
                self.send_header('Location', target_url)
                self.send_header('Content-Length', '0')
                self.send_header('Connection', 'close')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                return

            # 如果是 .strm 文件：安全 URL 编码后即时 302 重定向到 OpenList 原生链接！
            if file_path.lower().endswith('.strm'):
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        strm_url = f.read().strip()
                    if strm_url.startswith(('http://', 'https://', 'ftp://', 'smb://')):
                        encoded_url = safe_quote_url(strm_url)
                        self.send_response(302)
                        self.send_header('Location', encoded_url)
                        self.send_header('Content-Length', '0')
                        self.send_header('Connection', 'close')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        return
                    elif os.path.exists(strm_url):
                        file_path = strm_url
                except Exception as e:
                    print(f"Error reading strm: {e}")

            # 本地文件多线程高速并发 HTTP 206 流式传输
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
                        self.send_header('Content-Length', '0')
                        self.send_header('Connection', 'close')
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
                                chunk_size = min(remaining, 256 * 1024)
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
                                data = f.read(256 * 1024)
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
    server = ThreadingHTTPServer(('0.0.0.0', 5668), StreamHandler)
    print("fnplay stream server listening on 0.0.0.0:5668...")
    server.serve_forever()