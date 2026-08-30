#!/usr/bin/env python3
"""
飞牛影视（fnOS）Direct Stream 高性能串流网关 v4.7 (零内存开销极速版)
- 严密路由隔离：绝对禁止向元数据探测请求返回视频流
- 专为 PotPlayer / VLC 优化的大并发高吞吐 Range 206 流式传输
- RFC 3986 特殊字符安全编码与 STRM 毫秒级 302 直连
"""
import os, sys, sqlite3, mimetypes, urllib.parse, urllib.request, json
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB_PATH = '/usr/local/apps/@appdata/trim.media/database/trimmedia.db'

def get_accurate_title(guid, file_path=None):
    if not file_path:
        file_path, _ = get_media_info(guid)
    if not file_path:
        return "视频.mkv"

    if file_path.lower().endswith('.strm'):
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                strm_url = f.read().strip()
            if strm_url:
                parsed = urllib.parse.urlsplit(strm_url)
                name = os.path.basename(urllib.parse.unquote(parsed.path))
                if name:
                    return name
        except Exception:
            pass

    base = os.path.basename(file_path)
    if base.lower().endswith('.strm'):
        base = os.path.splitext(base)[0] + '.mkv'
    return base

def get_media_info(guid):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # 1. 优先查 item
        c.execute("SELECT path FROM item WHERE guid = ?", (guid,))
        r = c.fetchone()
        if r and r[0] and os.path.exists(r[0]):
            conn.close()
            return r[0], guid

        # 2. 查 item_media by guid
        c.execute("SELECT path, item_guid FROM item_media WHERE guid = ?", (guid,))
        r = c.fetchone()
        if r and r[0] and os.path.exists(r[0]):
            conn.close()
            return r[0], r[1]

        # 3. 查 item_media by item_guid
        c.execute("SELECT path, item_guid FROM item_media WHERE item_guid = ? ORDER BY sort_num ASC, size DESC", (guid,))
        r = c.fetchone()
        if r and r[0] and os.path.exists(r[0]):
            conn.close()
            return r[0], r[1]

        conn.close()
    except Exception as e:
        pass
    return None, None

def safe_quote_url(url):
    parts = urllib.parse.urlsplit(url)
    quoted_path = urllib.parse.quote(urllib.parse.unquote(parts.path), safe='/:')
    quoted_query = urllib.parse.quote(urllib.parse.unquote(parts.query), safe='=&/:?%+') if parts.query else ''
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, quoted_path, quoted_query, parts.fragment))

def resolve_strm_target(strm_url):
    is_private_ip = any(strm_url.startswith(f'http://{prefix}') or strm_url.startswith(f'https://{prefix}') 
                        for prefix in ['192.168.', '10.', '127.', 'localhost', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'])
    if is_private_ip:
        try:
            req = urllib.request.Request(strm_url, headers={'User-Agent': 'Mozilla/5.0'})
            class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
                def http_error_302(self, req, fp, code, msg, headers):
                    return headers
                http_error_301 = http_error_302
                http_error_303 = http_error_302
                http_error_307 = http_error_302
                http_error_308 = http_error_302
            opener = urllib.request.build_opener(NoRedirectHandler)
            res = opener.open(req, timeout=1.5)
            if hasattr(res, 'get'):
                loc = res.get('Location')
                if loc:
                    return loc
        except Exception as e:
            pass
    return strm_url

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

        # 0. 连通性检测接口 (/fnplay/ping 或 /ping)
        if 'ping' in parts[0] or (len(parts) > 1 and 'ping' in parts[-1]):
            resp = b'{"status":"ok","server":"fn_stream_server v4.7"}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if send_body:
                self.wfile.write(resp)
            return

        # 1. 严格判断是否为元数据查询 (/fnmeta)
        is_meta = any(p == 'fnmeta' for p in parts)
        guid = None
        for p in parts:
            if len(p) in (32, 36) or (len(p) >= 20 and not p.endswith(('.mkv', '.mp4', '.rmvb', '.avi', '.ts', '.flv', '.mov')) and p not in ('fnplay', 'fnmeta', 'v')):
                guid = p
                break

        if is_meta and guid:
            file_path, _ = get_media_info(guid)
            title = get_accurate_title(guid, file_path)
            resp = json.dumps({"code": 0, "guid": guid, "title": title}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if send_body:
                self.wfile.write(resp)
            return

        # 2. 视频流直推 (/fnplay/{guid}/filename)
        if guid:
            file_path, item_guid = get_media_info(guid)
            if not file_path or not os.path.exists(file_path):
                self.send_error(404, f"Media file not found on disk: guid={guid}")
                return

            # 如果是 .strm 文件：安全 302 重定向到云盘 CDN 直链
            if file_path.lower().endswith('.strm'):
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        strm_url = f.read().strip()
                    if strm_url.startswith(('http://', 'https://', 'ftp://', 'smb://')):
                        target_url = resolve_strm_target(strm_url)
                        encoded_url = safe_quote_url(target_url)
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
                    pass

            # 本地文件高速并发流式传输
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
                                chunk_size = min(remaining, 512 * 1024)
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
                                data = f.read(512 * 1024)
                                if not data:
                                    break
                                self.wfile.write(data)
            except Exception:
                pass
            return

        self.send_error(404, "Invalid request path")

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', 5668), StreamHandler)
    print("fnplay stream server listening on 0.0.0.0:5668...", flush=True)
    server.serve_forever()