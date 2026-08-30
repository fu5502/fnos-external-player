<div align="center">

# 🎬 飞牛影视 (fnOS) 全能外部播放器调用插件

**为飞牛 OS (fnOS) 飞牛影视 (`trim.media`) 打造的服务端免插件注入增强工具**

[![GitHub Release](https://img.shields.io/badge/Release-v4.5-blue.svg?style=flat-square)](https://github.com/fu5502/fnos-external-player/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-fnOS%20%7C%20Linux%20x86__64-orange.svg?style=flat-square)](https://www.fnnas.com/)
[![Supported Players](https://img.shields.io/badge/Players-PotPlayer%20%7C%20VLC%20%7C%20IINA%20%7C%20Infuse%20%7C%20MPV-purple.svg?style=flat-square)](#-支持的外部播放器矩阵)

[功能特性](#-功能特性) • [效果预览](#-效果预览) • [一键安装](#-一键安装) • [外网与公网访问](#-公网外网与远程访问说明) • [播放器矩阵](#-支持的外部播放器矩阵) • [系统架构](#-核心架构与技术突破) • [常见问题](#-常见问题-faq) • [更新日志](#-更新日志)

</div>

---

## 💡 为什么需要本插件？

飞牛影视官方 Web 播放器受制于浏览器环境限制：
* ❌ 遇到 **4K HDR / 杜比视界 (Dolby Vision) / TrueHD 7.1 / DTS-HD / VC-1** 等高规格原盘格式时，容易触发服务端 CPU 软解转码，导致 NAS 瞬间满载发热甚至卡死；
* ❌ 网页端无法发挥 PC / Mac 独立显卡的强大 GPU 硬件解码、超分辨率 (Super Resolution) 与渲染着色器能力；
* ❌ 对于挂载自 **OpenList / AList / 阿里云盘 / 115 / 天翼云盘** 的 `.strm` 虚拟串流，传统方式可能存在鉴权排队、参数截断或播放失败。

**本插件彻底解决以上痛点！** 客户端零侵入（免浏览器油猴插件/扩展），只需服务端一次性注入，即可在任意浏览器中一键调起本地专业播放器，享受**0% CPU 占用、原汁原味 4K 蓝光画质秒播**体验！

---

## 📸 效果预览

![飞牛影视外部播放器效果预览](docs/preview.png)

> **极简质感**：工具栏自动适配飞牛影视暗黑主题与毛玻璃特效，无缝嵌入电影、电视剧及单集详情页。

---

## 🌟 功能特性

* ⚡ **OpenList / AList 级别极致秒播**：
  * **0 毫秒即时响应**：去除传统点击时的异步网络延迟，点击按钮瞬间（0ms）直接触发系统协议唤起播放器，体验与在 OpenList / AList 网页中秒开完全一致；
  * **0.07 秒极速 302 直连**：全面兼容 Alist / OpenList / 天翼云盘 / 115 / 夸克 / 阿里云盘 生成的 `.strm` 文件，毫秒级 302 重定向到顶级 CDN 直链，跑满千兆宽带秒开；
* 🌐 **公网外网与局域网全自适应 (v4.5 新增)**：
  * **HTTP 直推隔离机制**：外部播放器协议统一生成 HTTP 直连串流，彻底消除在外网通过 HTTPS 域名访问飞牛网页时因协议继承导致的 PotPlayer/VLC 报 SSL 握手失败问题；
  * **⚙️ 可视化网关配置与毫秒级测速**：工具栏新增设置弹窗，支持自定义公网/外网网关地址、DDNS 与端口映射，并提供一键连通性探测与延迟诊断；
  * **局域网 STRM 外网智能穿透**：当 STRM 指向内网私有 IP（如局域网 OpenList `192.168.x.x`）时，NAS 后端会自动向 OpenList 提取公网云盘 CDN 直链，外网 5G 远程也能流畅播放；
* 🏷️ **权威真实中文片名识别（`/fnmeta` 毫秒级直通）**：
  * 服务端直连 SQLite 数据库与底层存储，精准提取电影、电视剧、分集及番外篇的原生真实中文文件名；
  * PotPlayer / VLC 播放列表和窗口标题栏 **100% 精准展示纯中文原名**（如 `冷库01：捉迷藏.rmvb`、`誓言.mp4`、`权力的游戏 - S01E02 - 第 2 集.mkv`），彻底杜绝 `%E9%...` 乱码与占位符；
* 🔥 **多线程并发推流网关（端口 `5668`）**：
  * 专为高规格 4K 原盘设计的多线程并发推流架构，瞬时响应 PotPlayer 针对音轨、字幕、索引发起的 10~20 个并行 Range 探测请求，**0% 转码 CPU 占用，拖动进度条毫秒级响应**；
* ⏱ **历史观影进度断点续播**：
  * 自动同步飞牛影视原生观影历史记录，调起播放器时自动附带 `/seek=hh:mm:ss`，从上次停顿的精确秒数无缝续播；
* 🛡 **系统与应用升级防失效**：
  * 配备 systemd 服务常驻守护与 Cron 定时自愈校验，fnOS 系统更新或飞牛影视升级后自动恢复注入，无需反复手动配置；
* 🖥 **客户端完全免配置**：
  * 纯服务端静态资源无损注入，PC、Mac、手机、平板浏览器访问飞牛影视均可直接呈现外部播放器工具栏。

---

## 🚀 一键安装

SSH 登录你的 **fnOS 终端**（或控制台），以 `sudo` 运行以下命令即可全自动安装：

```bash
curl -fsSL https://raw.githubusercontent.com/fu5502/fnos-external-player/main/install.sh | sudo bash
```

安装完成后，打开浏览器访问飞牛影视，按 `Ctrl + F5` 强制刷新页面即可看到外部播放器工具栏！

---

## 🌐 公网/外网与远程访问说明

如果你在公网（如通过 DDNS、域名或内网穿透）访问飞牛影视：
1. **端口放行**：请确保路由器或防火墙已放行/转发 **`5668` 端口**（例如将外网 `5668` 转发到 NAS 的 `5668` 端口）；
2. **自定义网关**：点击播放栏末尾的 **「⚙️ 设置」** 按钮，可输入你的公网网关地址（例如 `http://fntv.yourdomain.com:5668`），点击 **「🔍 测试连通性」** 即可瞬间确认网络是否通畅并自动保存；
3. **播放体验**：保存后点击 PotPlayer / VLC 即可直接远程以原始码率或云盘直链极速秒开！

---

## 📺 支持的外部播放器矩阵

| 播放器 | 操作系统支持 | 协议格式 | 功能特性 |
| :--- | :--- | :--- | :--- |
| **PotPlayer** | Windows | `potplayer://` | 0ms 同步直出、原盘秒播、中文片名、断点续播 |
| **VLC Media Player** | Windows / macOS / iOS / Android / Linux | `vlc://` / `intent:` | 全平台通用、开源稳定、安卓 Intent 原生调用 |
| **IINA** | macOS | `iina://weblink` | macOS 原生现代 UI、HDR 硬件解码优化 |
| **Infuse** | macOS / iOS / Apple TV | `infuse://` | 苹果生态海报墙与顶级杜比视界解码 |
| **MX Player** | Android | `intent:` | 安卓平台经典播放器，支持硬件加速 |
| **KMPlayer** | Windows / Android / iOS | `kmplayer://` | 经典高清播放器 |
| **弹弹play** | Windows / Android / iOS | `ddplay:` | 自动匹配弹幕库、追番体验极佳 |
| **NPlayer** | iOS / Android / macOS | `nplayer-` | 移动端顶级局域网/网络串流播放器 |
| **恒星播放器** | Windows / macOS / Android / iOS | `stellar://` | 帧率翻倍、AI 超分、插帧画质增强 |
| **复制串流直链** | 全平台 | 纯文本直链 | 一键复制高速串流 URL 至剪贴板，支持导入任意播放器 |

---

## 🏗️ 核心架构与技术突破

```mermaid
flowchart TD
    subgraph 客户端 [浏览器与本地播放器]
        Browser["飞牛影视 Web 界面"]
        Bar["外部播放器工具栏 v4.5"]
        Settings["⚙️ 网关配置与测速模态框"]
        PotPlayer["PotPlayer / VLC / IINA / Infuse"]
    end

    subgraph fnOS [飞牛 OS 服务端 (192.168.x.x)]
        DB[("SQLite trimmedia.db")]
        Gateway["Direct Stream 网关 (:5668)"]
        MetaAPI["元数据接口 (/fnmeta)"]
        StreamAPI["推流接口 (/fnplay)"]
        Disk["本地存储 (NAS 原盘)"]
        Daemon["自愈守护进程 (fn_player_daemon.sh)"]
    end

    subgraph Cloud [云端存储 / OpenList]
        OpenList["局域网/云端 OpenList (:5255)"]
        OSS["阿里 / 115 / 天翼云 CDN"]
    end

    Browser --> Bar
    Bar --> Settings
    Bar -.->|后台预加载 5ms| MetaAPI
    MetaAPI -->|极速查询片名| DB
    Bar ==>|0ms 同步协议唤起| PotPlayer

    PotPlayer -->|HTTP Range 探测请求| StreamAPI
    StreamAPI -->|本地原盘文件| Disk
    Disk -->|多线程 HTTP 206| PotPlayer
    StreamAPI -->|STRM 串流文件| OpenList
    OpenList -->|提取 CDN 直链| OSS
    OSS -->|302 RFC 3986 直连| PotPlayer

    Daemon -.->|定时巡检与自愈| Gateway
```

---

## ❓ 常见问题 (FAQ)

<details>
<summary><b>Q1: 为什么点击播放器没有任何反应？</b></summary>
A: 请确保您的电脑/设备上已安装对应的播放器。如果是 Windows 系统的 PotPlayer，请确认安装时已勾选“关联协议”或以管理员权限运行过一次。
</details>

<details>
<summary><b>Q2: 外网远程访问时点击 PotPlayer 提示无法播放？</b></summary>
A: 1. 请确认路由器已开放并将 `5668` 端口映射到 NAS；<br>
2. 在飞牛影视页面点击工具栏右侧的「⚙️ 设置」，输入公网网关地址（如 `http://你的域名:5668`），并点击「测试连通性」验证。
</details>

<details>
<summary><b>Q3: 为什么 .strm 文件在 PotPlayer 中播放速度飞快？</b></summary>
A: 本插件服务端网关采用了与 OpenList 同源的高性能 302 重定向架构，直接将播放器引导至云盘官方顶级 CDN，且在 302 头中执行 RFC 3986 编码，免去一切鉴权排队。
</details>

<details>
<summary><b>Q4: 飞牛 OS 升级或应用更新后插件会失效吗？</b></summary>
A: 不会。系统内置了自动守护进程 `fn_player_daemon.sh`，每分钟检测一次系统完整性，如有更新将自动完成热修补。
</details>

---

## 📝 更新日志

* **v4.5 (2026-08-30)**
  * 🌐 **公网/外网全自适应**：播放器默认采用 HTTP 直连 5668 端口，彻底解决在外网通过 HTTPS 域名访问飞牛网页时因协议继承导致的 PotPlayer/VLC 报 SSL 握手失败问题；
  * ⚙️ **外网网关配置面板**：新增可视化设置弹窗，支持自定义外网网关地址、端口映射及一键毫秒级测速与连通性检测；
  * 🚀 **局域网 STRM 外网智能穿透**：当 STRM 指向内网私有 IP（如局域网 OpenList `192.168.x.x`）时，NAS 后端会自动向 OpenList 提取公网云盘 CDN 直链，外网 5G 远程也能流畅播放；
* **v4.4 (2026-08-30)**
  * 🏷️ **权威真实中文片名直通**：新增 `/fnmeta/:guid` 服务端数据库元数据高速直通接口，彻底解决 PotPlayer 标题乱码或无法获取剧集真实名称的问题；
  * 🔠 **纯正中文原名呈现**：支持原生中文字符（如 `冷库01：捉迷藏.rmvb`）无转义展示；
* **v3.9 (2026-08-30)**
  * ⚡ **0ms 极速直出唤起**：去除点击时的异步网络阻塞，点击瞬间秒级调起播放器；
  * 🔀 **多线程并发推流网关**：切换至多线程并发流媒体传输架构，完美承载 PotPlayer 多路并发 Range 请求；
  * 🛡️ **RFC 3986 特殊字符编码**：修复带有 `[` `]` 特殊字符的 STRM 链接在 302 重定向时的报错；
* **v1.0 - v3.0**
  * 🎉 初始全平台播放器支持与飞牛影视自动化无损注入框架发布。

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。欢迎提 Issue 与 PR！