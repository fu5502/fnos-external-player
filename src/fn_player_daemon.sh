#!/bin/bash
# 飞牛影视第三方播放器注入维护守护进程 v4.9

# 1. 确保 window.__ug 被导出 (动态匹配 new ic(，兼容所有版本打包 hash)
ASSET_JS=$(grep -l "new ic(" /usr/local/apps/@appcenter/trim.media/static/assets/*.js 2>/dev/null | head -n 1 || true)
if [ -n "$ASSET_JS" ] && [ -f "$ASSET_JS" ]; then
    if ! grep -q "window.__ug=" "$ASSET_JS"; then
        sed -i 's/var ug=new ic(/var ug=window.__ug=new ic(/g' "$ASSET_JS"
    fi
fi

# 2. 确保 index.html 注入
HTML1="/usr/local/apps/@appcenter/trim.media/static/index.html"
if [ -f "$HTML1" ]; then
    if grep -q "fnExternalPlayer.js" "$HTML1"; then
        sed -i 's/fnExternalPlayer\.js\?v=[0-9.]*/fnExternalPlayer.js?v=4.9/g' "$HTML1"
    else
        sed -i 's/<\/body>/<script src="\/v\/static\/fnExternalPlayer.js?v=4.9" defer><\/script><\/body>/g' "$HTML1"
    fi
fi

HTML2="/usr/trim/www/index.html"
if [ -f "$HTML2" ]; then
    if grep -q "fnExternalPlayer.js" "$HTML2"; then
        sed -i 's/fnExternalPlayer\.js\?v=[0-9.]*/fnExternalPlayer.js?v=4.9/g' "$HTML2"
    else
        sed -i 's/<\/body>/<script src="\/static\/fnExternalPlayer.js?v=4.9" defer><\/script><\/body>/g' "$HTML2"
    fi
fi

# 3. 确保前端文件同步 (先建立目录防止静默失败)
mkdir -p /usr/local/apps/@appcenter/trim.media/static/static/
mkdir -p /usr/trim/www/static/

if [ -f "/usr/local/bin/fnExternalPlayer.js" ]; then
    cp -f /usr/local/bin/fnExternalPlayer.js /usr/local/apps/@appcenter/trim.media/static/static/fnExternalPlayer.js 2>/dev/null
    cp -f /usr/local/bin/fnExternalPlayer.js /usr/trim/www/static/fnExternalPlayer.js 2>/dev/null
fi

# 4. 确保 fn_stream_server 正在运行
if ! systemctl is-active --quiet fn_stream_server; then
    systemctl restart fn_stream_server
fi