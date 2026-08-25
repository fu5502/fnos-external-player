#!/bin/bash
set -e

echo "[-] 正在卸载飞牛影视外部播放器插件..."

systemctl stop fn_stream_server 2>/dev/null || true
systemctl disable fn_stream_server 2>/dev/null || true
rm -f /etc/systemd/system/fn_stream_server.service
systemctl daemon-reload

rm -f /usr/local/bin/fnExternalPlayer.js
rm -f /usr/local/bin/fn_stream_server.py
rm -f /usr/local/bin/fn_player_daemon.sh

rm -f /usr/local/apps/@appcenter/trim.media/static/static/fnExternalPlayer.js
rm -f /usr/trim/www/static/fnExternalPlayer.js

# 清除 crontab
crontab -l 2>/dev/null | grep -Fv "fn_player_daemon.sh" | crontab - || true

# 恢复 index.html
sed -i 's/<script src="\/v\/static\/fnExternalPlayer.js.*defer><\/script>//g' /usr/local/apps/@appcenter/trim.media/static/index.html 2>/dev/null || true
sed -i 's/<script src="\/static\/fnExternalPlayer.js.*defer><\/script>//g' /usr/trim/www/index.html 2>/dev/null || true

echo "[✓] 卸载完成！"
