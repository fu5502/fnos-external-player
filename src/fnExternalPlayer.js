/**
 * 飞牛影视（fnOS）全能外部播放器调用插件 v5.2.3 (剧集季页穿透与全场景支持版)
 * 1. 剧集季页全支持：电视剧详情页/季页面自动挂载外部播放器，支持带副标题按钮匹配
 * 2. 季对象智能寻轨：季页面点击自动起播该季第 1 集或最近观看单集，044 错误彻底消除
 * 3. 严格详情页守卫：仅在电影/剧集播放详情页挂载组件，主页、媒体库列表等自动清理不显示
 * 4. 保护云盘预签名参数：直连云盘顶级 CDN，绝不篡改 HMAC 签名参数，0% 转码原画秒播
 * 5. 官方 API 本地免流预取：通过 window.__ug.item.info 毫秒级提取真实中文片名与文件名
 * 6. 服务端智能 302 重定向纠偏：若调起时片名未就绪，服务端即刻 302 重定向至真实中文片名
 * 7. 紧凑单行防换行排版：尺寸缩小适配各种分辨率，禁止换行，视觉高度与按钮对齐
 * 8. Lucky 反代 / IPv6 / 局域网全自适应：外网自动复用当前域名与 HTTPS 端口，局域网直连 5668 网关
 */
(function () {
    'use strict';

    console.log('%c[fnExternalPlayer] 飞牛影视外部播放器插件 v5.2.3 (TV Season Supported Edition) 运行中...', 'color: #00A1D6; font-weight: bold; font-size: 14px;');

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
        // 严格匹配 32 位的十六进制媒体 GUID
        const hashMatch = hash.match(/([a-f0-9]{32})/i);
        if (hashMatch) return hashMatch[1];

        const pathMatch = window.location.pathname.match(/([a-f0-9]{32})/i);
        if (pathMatch) return pathMatch[1];

        return '';
    }

    // 判断当前是否处于电影或电视剧详情/播放页面
    function isMediaDetailPage() {
        const hash = (window.location.hash || '').toLowerCase();
        const path = (window.location.pathname || '').toLowerCase();

        // 1. 明确排除主页、列表页、设置、搜索等非媒体详情路由
        if (!hash || hash === '#' || hash === '#/' || hash.startsWith('#/home') || hash.startsWith('#/index')) {
            if (!path.includes('/movie/') && !path.includes('/tv/') && !path.includes('/detail/') && !path.includes('/episode/')) {
                return false;
            }
        }
        if (hash.startsWith('#/library') || hash.startsWith('#/favorite') || hash.startsWith('#/collection') || hash.startsWith('#/setting') || hash.startsWith('#/search') || hash.startsWith('#/channel')) {
            return false;
        }

        // 2. 必须具备合法的 32 位十六进制媒体 GUID
        const guid = extractCurrentGuid();
        if (!guid || !/^[a-f0-9]{32}$/i.test(guid)) {
            return false;
        }

        return true;
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
            display: inline-flex;
            flex-wrap: nowrap;
            white-space: nowrap;
            align-items: center;
            gap: 5px;
            margin: 6px 0;
            padding: 4px 8px;
            background: rgba(28, 28, 33, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 6px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
            z-index: 999;
            width: fit-content;
            max-width: 100%;
            overflow-x: auto;
            scrollbar-width: none;
            box-sizing: border-box;
        `;

        const titleLabel = document.createElement('span');
        titleLabel.innerText = '外部播放:';
        titleLabel.style.cssText = `
            color: rgba(255, 255, 255, 0.85);
            font-size: 12px;
            font-weight: 500;
            margin-right: 2px;
            user-select: none;
            white-space: nowrap;
            flex-shrink: 0;
        `;
        bar.appendChild(titleLabel);

        Players.forEach(p => {
            const btn = document.createElement('button');
            btn.id = p.id;
            btn.innerHTML = `<span style="font-size:11px; margin-right:3px;">${p.icon}</span><span>${p.name}</span>`;
            btn.style.cssText = `
                background: ${p.color};
                color: #ffffff;
                border: none;
                border-radius: 4px;
                padding: 3px 7px;
                font-size: 12px;
                font-weight: 500;
                line-height: 1.35;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                transition: transform 0.12s ease, filter 0.12s ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.25);
                user-select: none;
                white-space: nowrap;
                flex-shrink: 0;
                box-sizing: border-box;
            `;
            btn.onmouseenter = () => {
                btn.style.filter = 'brightness(1.18)';
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
        // 1. 优先寻找影视详情页主播放按钮组（支持电影/单集主按钮，以及剧集季页面带副标题的“播放 第 1 集”等按钮）
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], .semi-button, a'));
        for (const btn of buttons) {
            if (btn.id && btn.id.startsWith('fn-btn-')) continue;
            const txt = (btn.innerText || btn.textContent || '').trim();
            const aria = (btn.getAttribute('aria-label') || '').trim();

            const isPlayText = (
                txt === '播放' || txt === '继续播放' || txt === '立即播放' ||
                txt.startsWith('播放') || txt.startsWith('继续播放') || txt.startsWith('立即播放') ||
                txt.includes('继续播放') || txt.includes('立即播放') ||
                /^第\s*\d+\s*[集期话卷部]/.test(txt) ||
                aria === '播放' || aria === '继续播放' || aria.includes('播放')
            );

            if (isPlayText && txt.length < 30 && !txt.includes('设置') && !txt.includes('列表') && !txt.includes('偏好')) {
                let parent = btn.parentElement;
                while (parent && parent.children.length === 1 && parent !== document.body) {
                    parent = parent.parentElement;
                }
                return parent || btn.parentElement;
            }
        }

        // 2. 备选：查找影视规格标签（严格全等匹配 1080P、4K、SDR 等独立徽章，绝不误伤如 CCTV4K 等频道/标题名称）
        const tags = Array.from(document.querySelectorAll('div, span, button'));
        const specBadges = ['1080P', '4K', '720P', '2160P', 'SDR', 'HDR', 'HDR10', 'DOLBY', '杜比视界'];
        for (const tag of tags) {
            const txt = (tag.innerText || tag.textContent || '').trim().toUpperCase();
            if (specBadges.includes(txt)) {
                if (tag.children.length === 0 && tag.parentElement) {
                    return tag.parentElement;
                }
            }
        }

        return null;
    }

    function tryInject() {
        const existing = document.getElementById('fn-external-player-bar');

        // 核心守卫：若非电影/电视剧详情播放页，必须立刻彻底从页面 DOM 移除，绝不在首页残留
        if (!isMediaDetailPage()) {
            if (existing) {
                existing.remove();
            }
            return;
        }

        const guid = extractCurrentGuid();
        if (!guid) {
            if (existing) {
                existing.remove();
            }
            return;
        }

        fetchTitleViaUG(guid);

        // 如果页面上已有组件且对应当前影片，避免重复创建
        if (existing && document.body.contains(existing)) {
            if (existing.dataset.guid === guid) {
                return;
            }
            // 单页应用切换了不同的影视，移除旧组件重新挂载
            existing.remove();
        }

        const target = findTargetContainer();
        if (target) {
            const bar = createPlayerBar();
            bar.dataset.guid = guid;
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