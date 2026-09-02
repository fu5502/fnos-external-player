/**
 * 飞牛影视（fnOS）全能外部播放器调用插件 v4.8 (双重精准片名保障版)
 * 1. 官方 API 本地免流预取：通过 window.__ug.item.info 毫秒级提取真实中文片名与文件名
 * 2. 服务端智能 302 重定向纠偏：若调起时片名未就绪，服务端即刻 302 重定向至真实中文片名，PotPlayer 标题栏 100% 准确
 * 3. 零多余网络开销：不拉取任何视频流数据，网页 CPU 与内存保持极致清爽
 * 4. Lucky 反代 / IPv6 / 局域网全自适应：外网自动复用当前域名与 HTTPS 端口，局域网直连 5668 网关
 */
(function () {
    'use strict';

    console.log('%c[fnExternalPlayer] 飞牛影视外部播放器插件 v4.8 (Accurate Title Edition) 运行中...', 'color: #00A1D6; font-weight: bold; font-size: 14px;');

    const titleCache = {};

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

    function isPrivateHost(hostname) {
        if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
        if (/^192\.168\./.test(hostname) || /^10\./.test(hostname) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
        return false;
    }

    // 智能推流网关地址解析
    function getStreamGatewayBase() {
        const custom = localStorage.getItem('fn_stream_gateway_url');
        if (custom && custom.trim()) {
            return custom.trim().replace(/\/+$/, '');
        }

        // 1. 局域网访问 (如 http://192.168.99.147:5666) -> 默认使用内网直推网关 5668
        if (isPrivateHost(window.location.hostname)) {
            return `http://${window.location.hostname}:5668`;
        }

        // 2. 外网通过域名 / Lucky 反代 / IPv6 (如 https://fntv.zyweb.top:8443) -> 默认使用当前页面的 origin
        return window.location.origin;
    }

    // 毫秒级从官方已登录会话中预取真实片名 (仅几十字节 JSON，零多余开销)
    function fetchTitleViaUG(guid) {
        if (!guid || titleCache[guid]) return;
        try {
            if (window.__ug && window.__ug.item && window.__ug.item.info) {
                window.__ug.item.info({ guid: guid }).then(res => {
                    if (res && res.data) {
                        const d = res.data;
                        let real = d.filename || '';
                        if (!real && d.title) {
                            if (d.season_number && d.episode_number) {
                                const s = String(d.season_number).padStart(2, '0');
                                const e = String(d.episode_number).padStart(2, '0');
                                real = `${d.title} - S${s}E${e}.mkv`;
                            } else {
                                real = `${d.title}.mkv`;
                            }
                        }
                        if (real) {
                            titleCache[guid] = real.replace(/[\\/:*?"<>|\r\n\t]/g, '_');
                            console.log(`[fnExternalPlayer] 成功获取真实片名: ${guid} -> ${titleCache[guid]}`);
                        }
                    }
                }).catch(() => {});
            }
        } catch (e) {}
    }

    // 从网页 DOM 提取高精度中文片名
    function getDOMMediaTitle() {
        let title = '';

        const titleSelectors = [
            '[class*="episode-title"]', '[class*="episodeTitle"]',
            '[class*="video-title"]', '[class*="film-title"]',
            '[class*="item-title"]', '[class*="detail-title"]',
            'h1', 'h2', 'h3', '[class*="title--"]'
        ];
        for (const sel of titleSelectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const txt = (el.innerText || el.textContent || '').trim();
                if (txt && txt.length > 0 && txt.length < 80 && !txt.includes('飞牛') && !txt.includes('播放') && !txt.includes('选集')) {
                    title = txt;
                    break;
                }
            }
            if (title) break;
        }

        if (title) {
            title = title.replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
            if (!title.toLowerCase().endsWith('.mkv') && !title.toLowerCase().endsWith('.mp4') && !title.toLowerCase().endsWith('.rmvb')) {
                title += '.mkv';
            }
            return title;
        }
        return '视频.mkv';
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

    // 同步极速生成直链
    function getInstantStreamUrl() {
        const guid = extractCurrentGuid();
        if (!guid) return null;
        const fileName = titleCache[guid] || getDOMMediaTitle();
        const gateway = getStreamGatewayBase();
        return `${gateway}/fnplay/${guid}/${fileName}`;
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
                    const guid = extractCurrentGuid();
                    const title = titleCache[guid] || getDOMMediaTitle();
                    vlcUrl = `intent:${streamUrl}#Intent;package=org.videolan.vlc;type=video/*;S.title=${title};end`;
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
            icon: '🔻',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const infuseUrl = `infuse://x-callback-url/play?url=${encodeURIComponent(streamUrl)}`;
                console.log('[fnExternalPlayer] 极速调起 Infuse ->', infuseUrl);
                openProtocolSync(infuseUrl);
            }
        },
        {
            id: 'fn-btn-mxplayer',
            name: 'MXPlayer',
            color: '#00838F',
            icon: '⚡',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const guid = extractCurrentGuid();
                const title = titleCache[guid] || getDOMMediaTitle();
                const mxUrl = `intent:${streamUrl}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;S.title=${title};end`;
                console.log('[fnExternalPlayer] 极速调起 MXPlayer ->', mxUrl);
                openProtocolSync(mxUrl);
            }
        },
        {
            id: 'fn-btn-kmplayer',
            name: 'KMP',
            color: '#8E24AA',
            icon: '🟣',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const kmUrl = `kmplayer://${streamUrl}`;
                console.log('[fnExternalPlayer] 极速调起 KMPlayer ->', kmUrl);
                openProtocolSync(kmUrl);
            }
        },
        {
            id: 'fn-btn-ddplay',
            name: '弹弹play',
            color: '#D81B60',
            icon: '🌸',
            action: (e) => {
                const streamUrl = getInstantStreamUrl();
                if (!streamUrl) return;
                const ddUrl = `ddplay:${encodeURIComponent(streamUrl)}`;
                console.log('[fnExternalPlayer] 极速调起 弹弹play ->', ddUrl);
                openProtocolSync(ddUrl);
            }
        },
        {
            id: 'fn-btn-nplayer',
            name: 'NPlayer',
            color: '#00897B',
            icon: '🔷',
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
        },
        {
            id: 'fn-btn-settings',
            name: '设置',
            color: '#546E7A',
            icon: '⚙️',
            action: (e) => {
                showSettingsModal();
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

    // 显示网关配置与测速弹窗
    function showSettingsModal() {
        const oldModal = document.getElementById('fn-stream-settings-modal');
        if (oldModal) oldModal.remove();

        const currentCustom = localStorage.getItem('fn_stream_gateway_url') || '';
        const currentActive = getStreamGatewayBase();

        const modal = document.createElement('div');
        modal.id = 'fn-stream-settings-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: #1c1d22; border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; padding: 24px 28px; width: 480px; max-width: 92vw; color: #fff; box-shadow: 0 16px 36px rgba(0,0,0,0.6);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
                    <h3 style="margin:0; font-size: 17px; font-weight: 600;">⚙️ 外部播放器串流网关配置</h3>
                    <button id="fn-modal-close" style="background:none; border:none; color:#aaa; font-size: 20px; cursor:pointer; padding:0;">✕</button>
                </div>
                <div style="font-size: 13px; color: #bbb; line-height: 1.5; margin-bottom: 14px;">
                    当前使用的网关地址：<code style="background:#2a2b32; color:#4FC3F7; padding: 2px 6px; border-radius: 4px;">${currentActive}</code>
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display:block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #e0e0e0;">自定义网关地址 (留空则自动检测):</label>
                    <input id="fn-modal-input" type="text" value="${currentCustom}" placeholder="留空则自动检测 (局域网直连 / Lucky 反代)" style="width: 100%; box-sizing: border-box; background: #2a2b32; border: 1px solid #444; border-radius: 8px; color: #fff; padding: 9px 12px; font-size: 13px; outline: none;" />
                </div>
                <div id="fn-modal-test-res" style="font-size: 12px; min-height: 20px; margin-bottom: 14px;"></div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="fn-modal-test" style="background: #37474F; color: #fff; border: 1px solid #546E7A; border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer;">🔍 测试连通性</button>
                    <button id="fn-modal-reset" style="background: transparent; color: #aaa; border: 1px solid #444; border-radius: 6px; padding: 7px 12px; font-size: 13px; cursor: pointer;">清空/自动</button>
                    <button id="fn-modal-save" style="background: #1A73E8; color: #fff; border: none; border-radius: 6px; padding: 7px 18px; font-size: 13px; font-weight: 500; cursor: pointer;">保存设置</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#fn-modal-close');
        const saveBtn = modal.querySelector('#fn-modal-save');
        const resetBtn = modal.querySelector('#fn-modal-reset');
        const testBtn = modal.querySelector('#fn-modal-test');
        const input = modal.querySelector('#fn-modal-input');
        const testRes = modal.querySelector('#fn-modal-test-res');

        closeBtn.onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        resetBtn.onclick = () => {
            input.value = '';
            localStorage.removeItem('fn_stream_gateway_url');
            testRes.innerHTML = `<span style="color:#4CAF50;">已恢复为自动模式</span>`;
        };

        saveBtn.onclick = () => {
            const val = input.value.trim().replace(/\/+$/, '');
            if (val) {
                localStorage.setItem('fn_stream_gateway_url', val);
            } else {
                localStorage.removeItem('fn_stream_gateway_url');
            }
            showToast('网关地址已更新保存！');
            modal.remove();
        };

        testBtn.onclick = () => {
            const target = input.value.trim().replace(/\/+$/, '') || getStreamGatewayBase();
            testRes.innerHTML = '<span style="color:#FFB74D;">正在检测连接...</span>';
            const startTime = Date.now();
            
            fetch(`${target}/fnplay/ping_${Date.now()}`, { mode: 'no-cors' })
                .then(() => {
                    const latency = Date.now() - startTime;
                    testRes.innerHTML = `<span style="color:#4CAF50;">✓ 网关连接成功！响应延迟: ${latency}ms</span>`;
                })
                .catch(() => {
                    testRes.innerHTML = '<span style="color:#EF5350;">✕ 连接失败，请检查网络</span>';
                });
        };
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
        const guid = extractCurrentGuid();
        if (guid) {
            fetchTitleViaUG(guid);
        }

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

    setInterval(tryInject, 1000);
    window.addEventListener('load', tryInject);
    window.addEventListener('popstate', () => setTimeout(tryInject, 200));
    window.addEventListener('hashchange', () => setTimeout(tryInject, 200));
})();