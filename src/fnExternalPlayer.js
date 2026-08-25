/**
 * 飞牛影视（fnOS）全能外部播放器调用插件 v3.8
 * 1. 独家 Direct Stream 网关服务（端口 5668），免 Token 鉴权、原生无损流秒开
 * 2. 完美兼容 STRM 云端流与本地大盘：通过网关标准 302 重定向传输完整云端签名，杜绝 Windows 命令行截断 & 导致地址错误
 * 3. 历史断点自动续播：自动同步飞牛上次观看进度。
 */
(function () {
    'use strict';

    console.log('%c[fnExternalPlayer] 飞牛影视外部播放器插件 v3.8 运行中 (Clean Gateway + 302 Redirection)...', 'color: #00A1D6; font-weight: bold; font-size: 14px;');

    function getOS() {
        const u = navigator.userAgent;
        if (/windows|win32/i.test(u)) return 'windows';
        if (/macintosh|mac os x/i.test(u)) return 'macOS';
        if (/iphone|ipad|ipod/i.test(u)) return 'ios';
        if (/android/i.test(u)) return 'android';
        if (/linux/i.test(u)) return 'linux';
        return 'other';
    }

    function getPageTitle() {
        const titleEl = document.querySelector('h1, h2, .film-title, [class*="title--"], [class*="name--"]');
        if (titleEl && titleEl.innerText.trim()) {
            return titleEl.innerText.trim();
        }
        return document.title ? document.title.replace(/ - 飞牛影视.*/, '').trim() : '飞牛视频';
    }

    function extractCurrentGuid() {
        const hash = window.location.hash || '';
        const hashMatch = hash.match(/([a-f0-9]{20,64}|[a-zA-Z0-9_-]{20,64})/i);
        if (hashMatch) return hashMatch[1];

        const pathMatch = window.location.pathname.match(/([a-f0-9]{20,64}|[a-zA-Z0-9_-]{20,64})/i);
        if (pathMatch) return pathMatch[1];

        return '';
    }

    function formatTime(seconds) {
        if (!seconds || seconds <= 0) return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [
            h.toString().padStart(2, '0'),
            m.toString().padStart(2, '0'),
            s.toString().padStart(2, '0')
        ].join(':');
    }

    function openProtocolUri(uri) {
        const a = document.createElement('a');
        a.href = uri;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            a.remove();
        }, 1000);
    }

    // 获取高可靠、极速直连的视频播放直链与断点历史时间
    async function getDirectStreamInfo() {
        const guid = extractCurrentGuid();
        if (!guid) {
            showToast('未能获取当前影视 ID，请确保在影视详情页');
            return null;
        }

        try {
            let mediaGuid = '';
            let title = getPageTitle();
            let position = 0;

            if (window.__ug && window.__ug.play) {
                try {
                    const infoRes = await window.__ug.play.info({ item_guid: guid });
                    if (infoRes && (infoRes.code === 0 || infoRes.data)) {
                        const info = infoRes.data || infoRes;
                        mediaGuid = info.media_guid;
                        if (info.item?.name || info.item?.title) {
                            title = info.item.name || info.item.title;
                        }
                        if (info.ts && info.ts > 0) {
                            position = Math.floor(info.ts);
                        }
                    }
                } catch (e) {}
            }

            const targetGuid = mediaGuid || guid;
            // 始终使用干净的网关地址，由服务端返回 302 重定向到完整带签名的云端 CDN / 本地流
            const streamUrl = `${window.location.protocol}//${window.location.hostname}:5668/fnplay/${targetGuid}/video.mkv`;

            return {
                streamUrl: streamUrl,
                title: title,
                position: position
            };
        } catch (err) {
            console.error('[fnExternalPlayer] 解析直链异常:', err);
            showToast('解析异常: ' + (err.message || err));
            return null;
        }
    }

    const Players = [
        {
            id: 'fn-btn-potplayer',
            name: 'PotPlayer',
            color: '#F6B73C',
            icon: '▶',
            action: async () => {
                showToast('正在唤起 PotPlayer...');
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                
                let potUrl = 'potplayer://' + encodeURI(info.streamUrl);
                if (info.position && info.position > 5) {
                    potUrl += ` /seek=${formatTime(info.position)}`;
                }

                console.log('[fnExternalPlayer] 唤醒 PotPlayer ->', potUrl);
                openProtocolUri(potUrl);
            }
        },
        {
            id: 'fn-btn-vlc',
            name: 'VLC',
            color: '#E85E00',
            icon: '🟧',
            action: async () => {
                showToast('正在调起 VLC...');
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                const os = getOS();
                let vlcUrl = `vlc://${encodeURI(info.streamUrl)}`;
                if (os === 'android') {
                    vlcUrl = `intent:${encodeURI(info.streamUrl)}#Intent;package=org.videolan.vlc;type=video/*;S.title=${encodeURIComponent(info.title)};end`;
                } else if (os === 'ios') {
                    vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(info.streamUrl)}`;
                }
                console.log('[fnExternalPlayer] 唤醒 VLC ->', vlcUrl);
                openProtocolUri(vlcUrl);
            }
        },
        {
            id: 'fn-btn-iina',
            name: 'IINA',
            color: '#1A73E8',
            icon: '⚪',
            action: async () => {
                showToast('正在调起 IINA...');
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                const iinaUrl = `iina://weblink?url=${encodeURIComponent(info.streamUrl)}&new_window=1`;
                console.log('[fnExternalPlayer] 唤醒 IINA ->', iinaUrl);
                openProtocolUri(iinaUrl);
            }
        },
        {
            id: 'fn-btn-infuse',
            name: 'Infuse',
            color: '#FF5722',
            icon: '🔶',
            action: async () => {
                showToast('正在调起 Infuse...');
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                const infuseUrl = `infuse://x-callback-url/play?url=${encodeURIComponent(info.streamUrl)}`;
                console.log('[fnExternalPlayer] 唤醒 Infuse ->', infuseUrl);
                openProtocolUri(infuseUrl);
            }
        },
        {
            id: 'fn-btn-mpv',
            name: 'MPV',
            color: '#7B1FA2',
            icon: '🟣',
            action: async () => {
                showToast('正在调起 MPV...');
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                const os = getOS();
                let mpvUrl = `mpv://${encodeURI(info.streamUrl)}`;
                if (os === 'windows' || os === 'macOS') {
                    try {
                        const b64 = btoa(info.streamUrl).replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "");
                        mpvUrl = `mpv://play/${b64}`;
                    } catch (e) {}
                }
                console.log('[fnExternalPlayer] 唤醒 MPV ->', mpvUrl);
                openProtocolUri(mpvUrl);
            }
        },
        {
            id: 'fn-btn-dandan',
            name: '弹弹Play',
            color: '#00A1D6',
            icon: '📺',
            action: async () => {
                showToast('正在调起 弹弹Play...');
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                const os = getOS();
                let ddUrl = `ddplay:${encodeURIComponent(info.streamUrl + '|filePath=' + info.title)}`;
                if (os === 'android') {
                    ddUrl = `intent:${encodeURI(info.streamUrl)}#Intent;package=com.xyoye.dandanplay;type=video/*;end`;
                }
                console.log('[fnExternalPlayer] 唤醒 弹弹Play ->', ddUrl);
                openProtocolUri(ddUrl);
            }
        },
        {
            id: 'fn-btn-nplayer',
            name: 'NPlayer',
            color: '#00897B',
            icon: '🟢',
            action: async () => {
                showToast('正在调起 NPlayer...');
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                const nUrl = getOS() === 'macOS' 
                    ? `nplayer-mac://weblink?url=${encodeURIComponent(info.streamUrl)}&new_window=1` 
                    : `nplayer-${encodeURI(info.streamUrl)}`;
                console.log('[fnExternalPlayer] 唤醒 NPlayer ->', nUrl);
                openProtocolUri(nUrl);
            }
        },
        {
            id: 'fn-btn-stellar',
            name: '恒星',
            color: '#3949AB',
            icon: '🌟',
            action: async () => {
                showToast('正在调起 恒星播放器...');
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                const stUrl = `stellar://play/${encodeURI(info.streamUrl)}`;
                console.log('[fnExternalPlayer] 唤醒 恒星播放器 ->', stUrl);
                openProtocolUri(stUrl);
            }
        },
        {
            id: 'fn-btn-copy',
            name: '复制串流',
            color: '#43A047',
            icon: '📋',
            action: async () => {
                const info = await getDirectStreamInfo();
                if (!info || !info.streamUrl) return;
                copyToClipboard(info.streamUrl, () => {
                    showToast('已复制原画直链到剪贴板！');
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