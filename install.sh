#!/bin/bash
set -e

echo "======================================================="
echo "   飞牛影视 (fnOS) 全能外部播放器调用系统 一键安装脚本"
echo "======================================================="

# 确保以 root 权限执行
if [ "$EUID" -ne 0 ]; then
    echo "[-] 请使用 sudo 权限运行此脚本: sudo bash install.sh"
    exit 1
fi

REPO_URL="https://raw.githubusercontent.com/fu5502/fnos-external-player/main"

echo "[+] 1. 下载核心服务与脚本..."
curl -sSL "${REPO_URL}/src/fnExternalPlayer.js" -o /usr/local/bin/fnExternalPlayer.js
curl -sSL "${REPO_URL}/src/fn_stream_server.py" -o /usr/local/bin/fn_stream_server.py
curl -sSL "${REPO_URL}/src/fn_player_daemon.sh" -o /usr/local/bin/fn_player_daemon.sh
curl -sSL "${REPO_URL}/src/fn_stream_server.service" -o /etc/systemd/system/fn_stream_server.service

chmod +x /usr/local/bin/fn_stream_server.py
chmod +x /usr/local/bin/fn_player_daemon.sh

echo "[+] 2. 配置并启动 Direct Stream 串流服务..."
systemctl daemon-reload
systemctl enable --now fn_stream_server
systemctl restart fn_stream_server

echo "[+] 3. 注入飞牛影视前端界面..."
mkdir -p /usr/local/apps/@appcenter/trim.media/static/static/
mkdir -p /usr/trim/www/static/

cp -f /usr/local/bin/fnExternalPlayer.js /usr/local/apps/@appcenter/trim.media/static/static/fnExternalPlayer.js
cp -f /usr/local/bin/fnExternalPlayer.js /usr/trim/www/static/fnExternalPlayer.js

# 导出 window.__ug
ASSET_JS=$(ls /usr/local/apps/@appcenter/trim.media/static/assets/*YegjoWFd.js 2>/dev/null | head -n 1 || true)
if [ -f "$ASSET_JS" ] && ! grep -q "window.__ug=" "$ASSET_JS"; then
    sed -i 's/var ug=new ic(/var ug=window.__ug=new ic(/g' "$ASSET_JS"
fi

# 注入 index.html
HTML1="/usr/local/apps/@appcenter/trim.media/static/index.html"
if [ -f "$HTML1" ]; then
    if grep -q "fnExternalPlayer.js" "$HTML1"; then
        sed -i 's/fnExternalPlayer\.js\?v=[0-9.]*/fnExternalPlayer.js?v=4.6/g' "$HTML1"
    else
        sed -i 's/<\/body>/<script src="\/v\/static\/fnExternalPlayer.js?v=4.6" defer><\/script><\/body>/g' "$HTML1"
    fi
fi

HTML2="/usr/trim/www/index.html"
if [ -f "$HTML2" ]; then
    if grep -q "fnExternalPlayer.js" "$HTML2"; then
        sed -i 's/fnExternalPlayer\.js\?v=[0-9.]*/fnExternalPlayer.js?v=4.6/g' "$HTML2"
    else
        sed -i 's/<\/body>/<script src="\/static\/fnExternalPlayer.js?v=4.6" defer><\/script><\/body>/g' "$HTML2"
    fi
fi

echo "[+] 4. 设置持久化定时维护任务 (防系统/应用更新重置)..."
CRON_JOB="* * * * * /bin/bash /usr/local/bin/fn_player_daemon.sh >/dev/null 2>&1"
(crontab -l 2>/dev/null | grep -Fv "fn_player_daemon.sh" ; echo "$CRON_JOB") | crontab -

echo "======================================================="
echo "   [✓] 飞牛影视外部播放器系统安装成功！"
echo "   请在浏览器按 Ctrl + F5 强制刷新飞牛影视页面体验。"
echo "======================================================="