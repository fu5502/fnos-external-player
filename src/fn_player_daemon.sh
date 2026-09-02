#!/bin/bash
# 飞牛影视第三方播放器注入维护守护进程 v4.8

# 1. 确保 window.__ug 被导出
ASSET_JS=$(ls /usr/local/apps/@appcenter/trim.media/static/assets/*YegjoWFd.js 2>/dev/null | head -n 1)
if [ -f "$ASSET_JS" ]; then
    if ! grep -q "window.__ug=" "$ASSET_JS"; then
        sed -i 's/var ug=new ic(/var ug=window.__ug=new ic(/g' "$ASSET_JS"
    fi
fi

# 2. 确保 index.html 注入
HTML1="/usr/local/apps/@appcenter/trim.media/static/index.html"
if [ -f "$HTML1" ]; then
    if grep -q "fnExternalPlayer.js" "$HTML1"; then
        sed -i 's/fnExternalPlayer\.js\?v=[0-9.]*/fnExternalPlayer.js?v=4.8/g' "$HTML1"
    else
        sed -i 's/<\/body>/<script src="\/v\/static\/fnExternalPlayer.js?v=4.8" defer><\/script><\/body>/g' "$HTML1"
    fi
fi

HTML2="/usr/trim/www/index.html"
if [ -f "$HTML2" ]; then
    if grep -q "fnExternalPlayer.js" "$HTML2"; then
        sed -i 's/fnExternalPlayer\.js\?v=[0-9.]*/fnExternalPlayer.js?v=4.8/g' "$HTML2"
    else
        sed -i 's/<\/body>/<script src="\/static\/fnExternalPlayer.js?v=4.8" defer><\/script><\/body>/g' "$HTML2"
    fi
fi

# 3. 确保前端文件同步
if [ -f "/usr/local/bin/fnExternalPlayer.js" ]; then
    cp -f /usr/local/bin/fnExternalPlayer.js /usr/local/apps/@appcenter/trim.media/static/static/fnExternalPlayer.js 2>/dev/null
    cp -f /usr/local/bin/fnExternalPlayer.js /usr/trim/www/static/fnExternalPlayer.js 2>/dev/null
fi

# 4. 确保 fn_stream_server 正在运行
if ! systemctl is-active --quiet fn_stream_server; then
    systemctl restart fn_stream_server
fi