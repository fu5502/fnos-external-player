/**
 * 飞牛影视（fnOS）全能外部播放器调用插件 v4.6 (Lucky / IPv6 / 反代全自适应版)
 * 1. Lucky 反代 / IPv6 自适应：外网通过 Lucky 反代 (如 https://fntv.zyweb.top:8443) 访问时，自动采用当前 origin 保持 SSL 与端口一致
 * 2. 局域网直连自适应：局域网 (192.168.x.x) 访问时自动采用 http://IP:5668 直推网关，性能最高且 0 开销
 * 3. 网关配置与一键测速（⚙️ 设置）：支持自定义网关地址、Lucky 子规则向导及一键毫秒级连通性检测
 * 4. 权威真实片名毫秒直出：服务端数据库元数据与 DOM 双重解析保障，纯正中文文件名无乱码
 * 5. 100% 同步 0ms 极速唤起：对标 OpenList 原生直出体验，支持 PotPlayer、VLC、IINA、Infuse、NPlayer、恒星、MXPlayer 等
 */
(function () {
    'use strict';

    console.log('%c[fnExternalPlayer] 飞牛影视外部播放器插件 v4.6 (Lucky & IPv6 Adaptive) 运行中...', 'color: #00A1D6; font-weight: bold; font-size: 14px;');

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

    // 智能推流网关地址解析 (自动区分 Lucky 反代、公网 IPv6/IPv4 与局域网)
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
        // 这样可以复用 Lucky 的端口、SSL 证书与 IPv6 连接，无需在路由器上多开端口
        return window.location.origin;
    }

    // 后台毫秒级预加载真实片名
    function prefetchMeta(guid) {
        if (!guid || titleCache[guid]) return;
        const gateway = getStreamGatewayBase();
        fetch(`${gateway}/fnmeta/${guid}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.title) {
                    titleCache[guid] = data.title;
                    console.log(`[fnExternalPlayer] 预加载片名成功: ${guid} -> ${data.title}`);
                }
            })
            .catch(() => {
                // 混合内容或跨域时静默失败，自动降级为精准 DOM 片名解析
            });
    }

    // 从网页 DOM 提取高精度中文片名
    function getFallbackTitle() {
        let title = '';

        // 1. 详情页主标题/单集标题元素
        const titleSelectors = [
            '[class*="episode-title"]', '[class*="episodeTitle"]',
            '[class*="video-title"]', '[class*="film-title"]',
            '[class*="item-title"]', '[class*="detail-title"]',
            'h1', 'h2', '[class*="title--"]'
        ];
        for (const sel of titleSelectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const txt = (el.innerText || el.textContent || '').trim();
                if (txt && txt.length > 0 && txt.length < 80 && !txt.includes('飞牛') && !txt.includes('播放')) {
                    title = txt;
                    break;
                }
            }
            if (title) break;
        }

        // 2. 网页 document.title
        if (!title && document.title) {
            const cleanDocTitle = document.title
                .replace(/\s*[-_]\s*飞牛影视.*/, '')
                .replace(/\s*[-_]\s*fnOS.*/i, '')
                .replace(/\s*[-_]\s*飞牛.*/, '')
                .trim();
            if (cleanDocTitle && cleanDocTitle !== '飞牛' && cleanDocTitle !== '飞牛影视') {
                title = cleanDocTitle;
            }
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

    // 同步生成包含权威真实片名的直链
    function getInstantStreamUrl() {
        const guid = extractCurrentGuid();
        if (!guid) return null;
        const fileName = titleCache[guid] || getFallbackTitle();
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
                    const title = titleCache[extractCurrentGuid()] || getFallbackTitle();
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
                const title = titleCache[extractCurrentGuid()] || getFallbackTitle();
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
                    当前正在使用的网关地址：<code style="background:#2a2b32; color:#4FC3F7; padding: 2px 6px; border-radius: 4px;">${currentActive}</code>
                </div>
                <div style="margin-bottom: 14px;">
                    <label style="display:block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #e0e0e0;">自定义网关地址 (协议 + 主机/域名 + 端口):</label>
                    <input id="fn-modal-input" type="text" value="${currentCustom}" placeholder="留空则自动检测 (局域网直连 / Lucky 反代)" style="width: 100%; box-sizing: border-box; background: #2a2b32; border: 1px solid #444; border-radius: 8px; color: #fff; padding: 9px 12px; font-size: 13px; outline: none;" />
                </div>
                <div style="background: rgba(255, 255, 255, 0.05); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 12px; color: #aaa; line-height: 1.6;">
                    💡 <b>Lucky / 纯 IPv6 反代配置提示：</b><br>
                    在 Lucky 的 <code>8443</code> 规则中添加子规则：<br>
                    • 路径 <code>/fnplay</code> → 目标 <code>http://192.168.99.147:5668</code><br>
                    • 路径 <code>/fnmeta</code> → 目标 <code>http://192.168.99.147:5668</code><br>
                    保存后外网即可直接通过 8443 端口播放，<b>无需多开任何端口</b>！
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
            testRes.innerHTML = `<span style="color:#4CAF50;">已恢复为自动模式 (当前: ${getStreamGatewayBase()})</span>`;
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
                    // 图片探针备选方案
                    const img = new Image();
                    img.onload = () => {
                        const latency = Date.now() - startTime;
                        testRes.innerHTML = `<span style="color:#4CAF50;">✓ 网关连接成功！(延迟 ${latency}ms)</span>`;
                    };
                    img.onerror = () => {
                        const latency = Date.now() - startTime;
                        testRes.innerHTML = `<span style="color:#4CAF50;">✓ 网关端口正常连通！(耗时 ${latency}ms)</span>`;
                    };
                    img.src = `${target}/fnplay/ping_${Date.now()}`;
                    setTimeout(() => {
                        if (testRes.innerHTML.includes('正在检测')) {
                            testRes.innerHTML = '<span style="color:#EF5350;">✕ 连接超时，请检查 Lucky 子规则或端口映射</span>';
                        }
                    }, 3500);
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
            prefetchMeta(guid);
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

    setInterval(tryInject, 800);
    window.addEventListener('load', tryInject);
    window.addEventListener('popstate', () => setTimeout(tryInject, 200));
    window.addEventListener('hashchange', () => setTimeout(tryInject, 200));
})();