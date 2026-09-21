#!/usr/bin/env python3
"""
飞牛影视（fnOS）Direct Stream 高性能串流网关 v5.2 (云盘预签名直链保护版)
- 保护云盘 HMAC 预签名参数：严禁二次编解码 query 字符串，确保 S3 / OSS / 天翼云盘等 302 直链绝不报 403 Forbidden
- 智能片名纠偏：当收到 视频.mkv / video.mkv 等占位请求时，即时 302 重定向至真实中文片名，确保 PotPlayer 标题栏 100% 准确
- 严格路由隔离与高并发 HTTP 206 流式传输（0% CPU 占用）
- STRM 毫秒级 302 直连云盘顶级 CDN
"""
import os, sys, sqlite3, mimetypes, urllib.parse, urllib.request, json, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB_PATH = '/usr/local/apps/@appdata/trim.media/database/trimmedia.db'
STRM_TARGET_CACHE = {}  # { strm_url: (resolved_url, expire_time) }

def get_accurate_title(guid, file_path=None):
    # 优先查数据库中的真实片名或剧集名
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT filename, title, season_number, episode_number FROM item WHERE guid = ?", (guid,))
        r = c.fetchone()
        if r:
            filename, title, season_num, ep_num = r
            if filename and filename.strip():
                conn.close()
                return filename.strip()
            if title and season_num is not None and ep_num is not None:
                s_str = f"S{int(season_num):02d}E{int(ep_num):02d}"
                conn.close()
                return f"{title} - {s_str}.mkv"
            if title:
                conn.close()
                return f"{title}.mkv"
        conn.close()
    except Exception:
        pass

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

        # 0. 检查是否为 Season 或 TV（剧集/季页面穿透：自动寻轨该季最近观看集或第 1 集）
        c.execute("SELECT type, parent_guid FROM item WHERE guid = ?", (guid,))
        r_type = c.fetchone()
        if r_type and r_type[0] in ('Season', 'TV'):
            season_guid = guid
            if r_type[0] == 'TV':
                c.execute("SELECT guid FROM item WHERE parent_guid = ? ORDER BY season_number ASC LIMIT 1", (guid,))
                s_row = c.fetchone()
                if s_row:
                    season_guid = s_row[0]

            # 优先查找该季中最近播放过的单集
            c.execute("""
                SELECT ep.guid, ep.path
                FROM item ep
                JOIN item_user_play p ON ep.guid = p.item_guid
                WHERE ep.parent_guid = ?
                ORDER BY p.update_time DESC LIMIT 1
            """, (season_guid,))
            ep_row = c.fetchone()

            # 若未播放过，默认取该季第 1 集
            if not ep_row or not ep_row[1] or not os.path.exists(ep_row[1]):
                c.execute("""
                    SELECT guid, path
                    FROM item
                    WHERE parent_guid = ?
                    ORDER BY sort_num ASC, filename ASC, episode_number ASC
                    LIMIT 1
                """, (season_guid,))
                ep_row = c.fetchone()

            if ep_row:
                target_ep_guid = ep_row[0]
                if ep_row[1] and os.path.exists(ep_row[1]):
                    conn.close()
                    return ep_row[1], target_ep_guid
                c.execute("SELECT path FROM item_media WHERE item_guid = ? ORDER BY sort_num ASC, size DESC LIMIT 1", (target_ep_guid,))
                im_row = c.fetchone()
                if im_row and im_row[0] and os.path.exists(im_row[0]):
                    conn.close()
                    return im_row[0], target_ep_guid

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
    except Exception:
        pass
    return None, None

def is_private_host(hostname):
    if not hostname or hostname in ('localhost', '127.0.0.1', '::1'):
        return True
    if hostname.startswith(('192.168.', '10.')):
        return True
    if hostname.startswith('172.'):
        try:
            sec = int(hostname.split('.')[1])
            if 16 <= sec <= 31:
                return True
        except Exception:
            pass
    return False

def safe_quote_url(url):
    try:
        parts = urllib.parse.urlsplit(url)
        # 仅对 path 中的非 ASCII 字符进行编码，绝不修改 query 字符串！
        # 很多网盘（天翼云、阿里云、115、S3、OSS）使用 HMAC 预签名链接，query 包含特定编码的 Signature / Token，
        # 任何对 query 的 unquote 或重新 quote 都会破坏签名 (SignatureDoesNotMatch -> 403 Forbidden)。
        quoted_path = urllib.parse.quote(urllib.parse.unquote(parts.path), safe='/:@')
        return urllib.parse.urlunsplit((parts.scheme, parts.netloc, quoted_path, parts.query, parts.fragment))
    except Exception:
        return url

def resolve_strm_target(strm_url):
    now = time.time()
    cached = STRM_TARGET_CACHE.get(strm_url)
    if cached and cached[1] > now:
        return cached[0]

    is_private_ip = any(strm_url.startswith(f'http://{prefix}') or strm_url.startswith(f'https://{prefix}')
                        for prefix in ['192.168.', '10.', '127.', 'localhost', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'])
    target_url = strm_url
    if is_private_ip:
        try:
            # 采用 Range: bytes=0-0 探测 302 重定向，避免误触发全量下载导致几秒甚至几十秒阻塞
            req = urllib.request.Request(strm_url, headers={'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-0'})
            class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
                def http_error_302(self, req, fp, code, msg, headers):
                    return headers
                http_error_301 = http_error_302
                http_error_303 = http_error_302
                http_error_307 = http_error_302
                http_error_308 = http_error_302
            opener = urllib.request.build_opener(NoRedirectHandler)
            with opener.open(req, timeout=3.0) as res:
                loc = res.get('Location') if hasattr(res, 'get') else getattr(res, 'headers', {}).get('Location')
                if loc:
                    target_url = urllib.parse.urljoin(strm_url, loc)
        except Exception:
            pass

    # 缓存 10 分钟 (600秒)，高并发多线程下毫秒级直接命中
    STRM_TARGET_CACHE[strm_url] = (target_url, now + 600)
    return target_url

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
            resp = b'{"status":"ok","server":"fn_stream_server v4.8"}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if send_body:
                self.wfile.write(resp)
            return

        # 1. 元数据查询接口 (/fnmeta/{guid})
        is_meta = any(p == 'fnmeta' for p in parts)
        guid = None
        for p in parts:
            if len(p) in (32, 36) or (len(p) >= 20 and not p.endswith(('.mkv', '.mp4', '.rmvb', '.avi', '.ts', '.flv', '.mov')) and p not in ('fnplay', 'fnmeta', 'v')):
                guid = p
                break

        if is_meta and guid:
            file_path, item_guid = get_media_info(guid)
            title = get_accurate_title(item_guid or guid, file_path)
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

            accurate_title = get_accurate_title(item_guid or guid, file_path)
            req_filename = urllib.parse.unquote(parts[-1]) if len(parts) > 1 else ''

            # 智能纠偏：如果客户端传入的是 "视频.mkv"、"video.mkv"、"play" 或无文件名
            # 立即 302 重定向到真实文件名 URL，PotPlayer 收到重定向后会自动将播放列表与标题栏更新为真实片名！
            if req_filename in ('视频.mkv', 'video.mkv', 'play', '') or not req_filename.endswith(('.mkv', '.mp4', '.rmvb', '.avi', '.ts', '.flv', '.mov', '.iso')):
                redirect_url = f"/fnplay/{guid}/{urllib.parse.quote(accurate_title)}"
                self.send_response(302)
                self.send_header('Location', redirect_url)
                self.send_header('Content-Length', '0')
                self.send_header('Connection', 'close')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                return

            # 如果是 .strm 文件：
            if file_path.lower().endswith('.strm'):
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        strm_url = f.read().strip()
                    if strm_url.startswith(('http://', 'https://', 'ftp://', 'smb://')):
                        target_url = resolve_strm_target(strm_url)
                        target_parsed = urllib.parse.urlsplit(target_url)

                        # 1. 若最终目标是内网私有 IP（例如 OpenList 192.168.99.3:5255 本地中继模式）：
                        #    若 302 重定向给客户端，OpenList /d 路由会因拒绝 HEAD 请求返回 403 Forbidden（PotPlayer 报错）；
                        #    且外网环境下客户端无法访问内网 IP。
                        #    因此：由 5668 网关代为无损中继推流，完美响应 HEAD 探测与 HTTP 206 断点续传！
                        if is_private_host(target_parsed.hostname):
                            self.proxy_remote_stream(target_url, accurate_title, send_body=send_body)
                            return

                        # 2. 若目标是公网云盘顶级 CDN（例如天翼云 ctyunxs.cn、阿里云 OSS、115）：
                        #    直接 302 重定向，享受千兆 CDN 直出与 0% NAS 负载！
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
                except Exception:
                    pass

            # 本地文件高速并发流式传输
            try:
                file_size = os.path.getsize(file_path)
                content_type, _ = mimetypes.guess_type(file_path)
                if not content_type or not content_type.startswith('video/'):
                    content_type = 'video/mp4'

                quoted_title = urllib.parse.quote(accurate_title)
                disposition = f'inline; filename="{quoted_title}"; filename*=UTF-8\'\'{quoted_title}'

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
                    self.send_header('Content-Disposition', disposition)
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
                    self.send_header('Content-Disposition', disposition)
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

    def proxy_remote_stream(self, remote_url, accurate_title, send_body=True):
        try:
            req_headers = {'User-Agent': 'Mozilla/5.0'}
            range_header = self.headers.get('Range')
            if range_header:
                req_headers['Range'] = range_header
            elif not send_body: # HEAD 请求探针
                req_headers['Range'] = 'bytes=0-0'

            req = urllib.request.Request(remote_url, headers=req_headers)
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                resp_headers = resp.headers
                content_range = resp_headers.get('Content-Range')
                content_length = resp_headers.get('Content-Length')
                content_type = resp_headers.get('Content-Type') or 'video/mp4'

                quoted_title = urllib.parse.quote(accurate_title)
                disposition = f'inline; filename="{quoted_title}"; filename*=UTF-8\'\'{quoted_title}'

                if not send_body and not range_header and content_range:
                    # 响应播放器的 HEAD 探测请求
                    total_size = content_range.split('/')[-1] if '/' in content_range else content_length
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(total_size))
                    self.send_header('Accept-Ranges', 'bytes')
                    self.send_header('Content-Disposition', disposition)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    return

                # GET 带有 Range 或普通 GET
                status_code = resp.status
                self.send_response(status_code)
                if content_range:
                    self.send_header('Content-Range', content_range)
                if content_length:
                    self.send_header('Content-Length', content_length)
                self.send_header('Content-Type', content_type)
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Disposition', disposition)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()

                if send_body:
                    # 64KB 极速小块推流，首包延迟趋近于 0，秒级起播
                    while True:
                        chunk = resp.read(64 * 1024)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            sys.stderr.write(f"Proxy error on path {self.path} (Range: {self.headers.get('Range')}): {e}\n")
            sys.stderr.flush()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', 5668), StreamHandler)
    print("fnplay stream server listening on 0.0.0.0:5668...", flush=True)
    server.serve_forever()