/**
 * 飞牛影视（fnOS）全能外部播放器调用插件 v4.3 (权威原生片名版)
 * 1. 彻底解决“首页.mkv”等 DOM 抓取错误：交由 Direct Stream 网关从 SQLite 底层数据库与 OpenList 原生返回 100% 精准影视/单集原名！
 * 2. 100% 同步 0ms 极速唤起：对标 OpenList 原生直出体验
 * 3. 独家 Direct Stream 网关（端口 5668）+ RFC 3986 安全重定向，兼容本地高码率原盘与云盘 STRM
 */
(function () {
    'use strict';

    console.log('%c[fnExternalPlayer] 飞牛影视外部播放器插件 v4.3 (Authoritative Title Edition) 运行中...', 'color: #00A1D6; font-weight: bold; font-size: 14px;');

    function getOS() {
        const u = navigator.userAgent;
        if (/windows|win32/i.test(u)) return 'windows';
        if (/macintosh|mac os x/i.test(u)) return 'macOS';
        if (/iphone|ipad|ipod/i.test(u)) return 'ios';
        if (/android/i.test(u)) return 'android';
        if (/linux/i.test(u)) return 'linux';
        return 'other';
    }

    function extractCurrentGuid() {
        const hash = window.location.hash || '';
        const hashMatch = hash.match(/([a-f0-9]{20,64}|[a-zA-Z0-9_-]{20,64})/i);
        if (hashMatch) return hashMatch[1];

        const pathMatch = window.location.pathname.match(/([a-f0-9]{20,64}|[a-zA-Z0-9_-]{20,64})/i);
        if (pathMatch) return pathMatch[1];

        return '';
    }

    function openProtocolSync(uri) {
        const a = document.createElement('a');
        a.href = uri;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            a.remove();
        }, 1000);
    }

    // 由服务端网关精准提供 100% 真实片名重定向
    function getInstantStreamUrl() {
        const guid = extractCurrentGuid();
        if (!guid) return null;
        return `${window.location.protocol}//${window.location.hostname}:5668/fnplay/${guid}`;
    }

    const Players = [
        {
            id: 'fn-btn-potplayer',
            name: 'PotPlayer',
            color: '#F6B73C',
            icon: '▶',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) {
                    showToast('请在电影或电视剧详情页点击');
                    return;
                }
                const potUrl = 'potplayer://' + streamUrl;
                console.log('[fnExternalPlayer] 极速调起 PotPlayer ->', potUrl);
                openProtocolSync(potUrl);
            }
        },
        {
            id: 'fn-btn-vlc',
            name: 'VLC',
            color: '#E85E00',
            icon: '🟧',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const os = getOS();
                let vlcUrl = `vlc://${streamUrl}`;
                if (os === 'android') {
                    vlcUrl = `intent:${streamUrl}#Intent;package=org.videolan.vlc;type=video/*;end`;
                } else if (os === 'ios') {
                    vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(streamUrl)}`;
                }
                console.log('[fnExternalPlayer] 极速调起 VLC ->', vlcUrl);
                openProtocolSync(vlcUrl);
            }
        },
        {
            id: 'fn-btn-iina',
            name: 'IINA',
            color: '#1A73E8',
            icon: '⚪',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const iinaUrl = `iina://weblink?url=${encodeURIComponent(streamUrl)}&new_window=1`;
                console.log('[fnExternalPlayer] 极速调起 IINA ->', iinaUrl);
                openProtocolSync(iinaUrl);
            }
        },
        {
            id: 'fn-btn-infuse',
            name: 'Infuse',
            color: '#FF5722',
            icon: '🔶',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const infuseUrl = `infuse://x-callback-url/play?url=${encodeURIComponent(streamUrl)}`;
                console.log('[fnExternalPlayer] 极速调起 Infuse ->', infuseUrl);
                openProtocolSync(infuseUrl);
            }
        },
        {
            id: 'fn-btn-mpv',
            name: 'MPV',
            color: '#7B1FA2',
            icon: '🟣',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const os = getOS();
                let mpvUrl = `mpv://${streamUrl}`;
                if (os === 'windows' || os === 'macOS') {
                    try {
                        const b64 = btoa(unescape(encodeURIComponent(streamUrl))).replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "");
                        mpvUrl = `mpv://play/${b64}`;
                    } catch (err) {}
                }
                console.log('[fnExternalPlayer] 极速调起 MPV ->', mpvUrl);
                openProtocolSync(mpvUrl);
            }
        },
        {
            id: 'fn-btn-dandan',
            name: '弹弹Play',
            color: '#00A1D6',
            icon: '📺',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const os = getOS();
                let ddUrl = `ddplay:${encodeURIComponent(streamUrl)}`;
                if (os === 'android') {
                    ddUrl = `intent:${encodeURI(streamUrl)}#Intent;package=com.xyoye.dandanplay;type=video/*;end`;
                }
                console.log('[fnExternalPlayer] 极速调起 弹弹Play ->', ddUrl);
                openProtocolSync(ddUrl);
            }
        },
        {
            id: 'fn-btn-nplayer',
            name: 'NPlayer',
            color: '#00897B',
            icon: '🟢',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const nUrl = getOS() === 'macOS' 
                    ? `nplayer-mac://weblink?url=${encodeURIComponent(streamUrl)}&new_window=1` 
                    : `nplayer-${streamUrl}`;
                console.log('[fnExternalPlayer] 极速调起 NPlayer ->', nUrl);
                openProtocolSync(nUrl);
            }
        },
        {
            id: 'fn-btn-stellar',
            name: '恒星',
            color: '#3949AB',
            icon: '🌟',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const stUrl = `stellar://play/${streamUrl}`;
                console.log('[fnExternalPlayer] 极速调起 恒星播放器 ->', stUrl);
                openProtocolSync(stUrl);
            }
        },
        {
            id: 'fn-btn-copy',
            name: '复制串流',
            color: '#43A047',
            icon: '📋',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                copyToClipboard(streamUrl, () => {
                    showToast('已复制直链到剪贴板！');
                });
            }
        }
    ];

    function copyToClipboard(text, onSuccess) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
        } else {
            fallbackCopy(text, onSuccess);
        }
    }

    function fallbackCopy(text, onSuccess) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            document.execCommand('copy');
            if (onSuccess) onSuccess();
        } catch (err) {}
        document.body.removeChild(ta);
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style.cssText = `
            position: fixed;
            top: 28px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(28, 28, 30, 0.95);
            color: #ffffff;
            padding: 10px 22px;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            font-size: 14px;
            font-weight: 500;
            z-index: 999999;
            transition: all 0.3s ease;
            pointer-events: none;
            border: 1px solid rgba(255,255,255,0.18);
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }

    function createPlayerBar() {
        const bar = document.createElement('div');
        bar.id = 'fn-external-player-bar';
        bar.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            margin: 14px 0 18px 0;
            padding: 10px 14px;
            background: rgba(30, 30, 35, 0.75);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
            z-index: 999;
            width: fit-content;
        `;

        const titleLabel = document.createElement('span');
        titleLabel.innerText = '外部播放器:';
        titleLabel.style.cssText = `
            color: rgba(255, 255, 255, 0.85);
            font-size: 13px;
            font-weight: 600;
            margin-right: 6px;
            user-select: none;
        `;
        bar.appendChild(titleLabel);

        Players.forEach(p => {
            const btn = document.createElement('button');
            btn.id = p.id;
            btn.innerHTML = `<span style="font-size:12px; margin-right:4px;">${p.icon}</span><span>${p.name}</span>`;
            btn.style.cssText = `
                background: ${p.color};
                color: #ffffff;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                transition: transform 0.15s ease, filter 0.15s ease;
                box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                user-select: none;
            `;
            btn.onmouseenter = () => {
                btn.style.filter = 'brightness(1.15)';
                btn.style.transform = 'translateY(-1px)';
            };
            btn.onmouseleave = () => {
                btn.style.filter = 'none';
                btn.style.transform = 'none';
            };
            btn.onclick = (e) => {
                e.stopPropagation();
                p.action(e);
            };
            bar.appendChild(btn);
        });

        return bar;
    }

    function findTargetContainer() {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], .semi-button, a'));
        for (const btn of buttons) {
            if (btn.id && btn.id.startsWith('fn-btn-')) continue;
            const txt = (btn.innerText || btn.textContent || '').trim();
            if ((txt.includes('继续播放') || txt === '播放' || txt.includes('立即播放')) && txt.length < 15) {
                let parent = btn.parentElement;
                while (parent && parent.children.length === 1 && parent !== document.body) {
                    parent = parent.parentElement;
                }
                return parent || btn.parentElement;
            }
        }

        const tags = Array.from(document.querySelectorAll('div, span, button'));
        for (const tag of tags) {
            const txt = (tag.innerText || tag.textContent || '').trim();
            if ((txt.includes('1080P') || txt.includes('4K') || txt.includes('720P') || txt.includes('SDR') || txt.includes('HDR')) && txt.length < 20) {
                if (tag.children.length === 0 && tag.parentElement) {
                    return tag.parentElement;
                }
            }
        }

        return null;
    }

    function tryInject() {
        const existing = document.getElementById('fn-external-player-bar');
        if (existing && document.body.contains(existing)) {
            return;
        }

        const target = findTargetContainer();
        if (target) {
            const bar = createPlayerBar();
            if (target.nextSibling) {
                target.parentNode.insertBefore(bar, target.nextSibling);
            } else {
                target.parentNode.appendChild(bar);
            }
        }
    }

    const observer = new MutationObserver(() => {
        tryInject();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    setInterval(tryInject, 800);
    window.addEventListener('load', tryInject);
    window.addEventListener('popstate', () => setTimeout(tryInject, 200));
    window.addEventListener('hashchange', () => setTimeout(tryInject, 200));
})();