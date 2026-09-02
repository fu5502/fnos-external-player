#!/bin/bash
set -e

echo "======================================================="
echo "   飞牛影视 (fnOS) 全能外部播放器调用系统 一键卸载脚本"
echo "======================================================="

# 确保以 root 权限执行
if [ "$EUID" -ne 0 ]; then
    echo "[-] 请使用 sudo 权限运行此脚本: sudo bash uninstall.sh"
    exit 1
fi

echo "[+] 1. 停止并注销 Direct Stream 串流后台服务..."
systemctl stop fn_stream_server 2>/dev/null || true
systemctl disable fn_stream_server 2>/dev/null || true
rm -f /etc/systemd/system/fn_stream_server.service
systemctl daemon-reload

echo "[+] 2. 清理系统持久化定时守护任务..."
crontab -l 2>/dev/null | grep -Fv "fn_player_daemon.sh" | crontab - || true

echo "[+] 3. 移除服务端核心程序与脚本..."
rm -f /usr/local/bin/fnExternalPlayer.js
rm -f /usr/local/bin/fn_stream_server.py
rm -f /usr/local/bin/fn_player_daemon.sh

echo "[+] 4. 恢复飞牛影视 Web 静态文件..."
rm -f /usr/local/apps/@appcenter/trim.media/static/static/fnExternalPlayer.js
rm -f /usr/trim/www/static/fnExternalPlayer.js

HTML1="/usr/local/apps/@appcenter/trim.media/static/index.html"
if [ -f "$HTML1" ]; then
    sed -i 's/<script src="\/v\/static\/fnExternalPlayer\.js[^"]*" defer><\/script>//g' "$HTML1" 2>/dev/null || true
fi

HTML2="/usr/trim/www/index.html"
if [ -f "$HTML2" ]; then
    sed -i 's/<script src="\/static\/fnExternalPlayer\.js[^"]*" defer><\/script>//g' "$HTML2" 2>/dev/null || true
fi

echo "======================================================="
echo "   [✓] 飞牛影视外部播放器插件已完全卸载干净！"
echo "   请在浏览器按 Ctrl + F5 刷新页面即可恢复官方默认状态。"
echo "======================================================="