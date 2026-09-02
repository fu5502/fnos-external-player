<div align="center">

# 🎬 飞牛影视 (fnOS) 全能外部播放器调用插件

**为飞牛 OS (fnOS) 飞牛影视 (`trim.media`) 打造的服务端免插件注入增强工具**

[![GitHub Release](https://img.shields.io/badge/Release-v4.8-blue.svg?style=flat-square)](https://github.com/fu5502/fnos-external-player/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-fnOS%20%7C%20Linux%20x86__64-orange.svg?style=flat-square)](https://www.fnnas.com/)
[![Supported Players](https://img.shields.io/badge/Players-PotPlayer%20%7C%20VLC%20%7C%20IINA%20%7C%20Infuse%20%7C%20MPV-purple.svg?style=flat-square)](#-支持的外部播放器矩阵)

[功能特性](#-功能特性) • [效果预览](#-效果预览) • [一键安装](#-一键安装) • [Lucky 与纯 IPv6 配置向导](#-lucky--纯-ipv6-反代配置向导无需额外端口) • [播放器矩阵](#-支持的外部播放器矩阵) • [系统架构](#-核心架构与技术突破) • [常见问题](#-常见问题-faq) • [更新日志](#-更新日志)

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
* 🌐 **Lucky 反代与纯 IPv6 全自适应 (v4.6 核心突破)**：
  * **零端口增加**：外网通过 Lucky 反代（如 `https://fntv.zyweb.top:8443`）访问时，自动复用当前页面的域名、HTTPS 证书与端口，**无需在路由器上单独为串流多开任何端口**；
  * **⚙️ 可视化网关配置与一键测速**：工具栏新增设置弹窗，支持自定义网关地址与一键毫秒级连通性探测；
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

## 🌐 Lucky / 纯 IPv6 反代配置向导（无需额外端口）

如果你没有公网 IPv4，使用 **IPv6 + Lucky 反代**（如 `https://fntv.zyweb.top:8443`）：

只需在 Lucky 的 `8443` 飞牛影视反代规则中，添加 **2 条子规则** 即可（复用同一个 8443 端口与 HTTPS 证书，无需开放 5668 端口）：

1. 打开 **Lucky 管理后台** → **Web 服务** → 找到反代飞牛影视（`8443` 端口）的规则；
2. 点击 **「添加子规则」**（或编辑规则内部的子规则）：
   * **子规则 1 (串流直推)**：
     * **规则名称**：`fnplay`
     * **匹配模式**：`包含` 或 `前缀匹配`
     * **匹配路径**：`/fnplay`
     * **反代目标**：`http://192.168.99.147:5668`
   * **子规则 2 (元数据接口)**：
     * **规则名称**：`fnmeta`
     * **匹配模式**：`包含` 或 `前缀匹配`
     * **匹配路径**：`/fnmeta`
     * **反代目标**：`http://192.168.99.147:5668`
3. 点击 **保存**。
4. 在外网打开 `https://fntv.zyweb.top:8443` 飞牛影视，点击外部播放器工具栏末尾的 **「⚙️ 设置」**，点击 **「🔍 测试连通性」** 显示 `✓ 网关连接成功` 即可！

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
        Bar["外部播放器工具栏 v4.6"]
        Settings["⚙️ 网关配置与测速模态框"]
        PotPlayer["PotPlayer / VLC / IINA / Infuse"]
    end

    subgraph WAN [外网 Lucky 反代 (:8443)]
        Lucky["Lucky IPv6 + HTTPS 反代"]
        Sub1["子规则: /fnplay -> :5668"]
        Sub2["子规则: /fnmeta -> :5668"]
        Main["默认规则: /* -> :5666"]
    end

    subgraph fnOS [飞牛 OS 服务端 (192.168.99.147)]
        DB[("SQLite trimmedia.db")]
        Gateway["Direct Stream 网关 (:5668)"]
        Disk["本地存储 (NAS 原盘)"]
        Daemon["自愈守护进程 (fn_player_daemon.sh)"]
    end

    subgraph Cloud [云端存储 / OpenList]
        OpenList["局域网/云端 OpenList (:5255)"]
        OSS["阿里 / 115 / 天翼云 CDN"]
    end

    Browser --> Bar
    Bar --> Settings
    Bar ==>|0ms 唤起 (https://fntv.zyweb.top:8443/fnplay/...)| PotPlayer

    PotPlayer -->|IPv6 HTTPS 8443 请求| Lucky
    Lucky --> Sub1
    Sub1 --> Gateway

    Gateway -->|本地原盘文件| Disk
    Disk -->|多线程 HTTP 206| Gateway
    Gateway -->|STRM 串流文件| OpenList
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
A: 如果使用 Lucky 反代（如 `https://域名:8443`），请在 Lucky 对应规则中添加 `/fnplay` 与 `/fnmeta` 指向 `http://192.168.99.147:5668` 的子规则；<br>
若使用端口映射，请确认路由器已开放 `5668` 端口。
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

* **v4.8 (2026-09-02)**
  * 🏷️ **双重精准片名保障机制**：彻底解决外部播放器片名偶尔显示为 `视频.mkv` 的问题；
  * ⚡ **官方会话毫秒级提取**：利用飞牛官方全局接口 `window.__ug.item.info` 毫秒级提取剧集正式中文原名；
  * 🔄 **服务端智能 302 重定向纠偏**：若调起时片名未就绪，服务端即刻通过媒体库数据库 302 重定向至真实中文片名，播放列表与窗口标题 100% 准确；
* **v4.7 (2026-08-30)**
  * 🚀 **彻底移除后台轮询与网络开销**：消除由于反代前缀误判导致的后台循环大流量拉取与网页内存溢出崩溃问题；
  * 📦 **增大流媒体并发传输缓冲区**：缓冲区由 256KB 提升至 512KB，显著提升外网原盘高码率串流与进度拖拽响应；
* **v4.6 (2026-08-30)**
  * 🌐 **Lucky 反代与纯 IPv6 全自适应**：外网通过 Lucky 反代（如 `https://fntv.zyweb.top:8443`）访问时自动复用相同 origin，配合 Lucky 子规则实现零多开端口播放；
  * ⚙️ **可视化网关配置向导**：弹窗中提供针对 Lucky / IPv6 的一键设置说明与网络测速；
* **v4.5 (2026-08-30)**
  * 🛡️ **HTTP 直推隔离与全自适应**：局域网环境默认直连 5668 端口，消除 SSL 握手报错；
  * 🚀 **局域网 STRM 外网智能穿透**：当 STRM 指向内网私有 IP 时 NAS 自动代为解析 302 提取云端直链；
* **v4.4 (2026-08-30)**
  * 🏷️ **权威真实中文片名直通**：新增 `/fnmeta/:guid` 服务端元数据高速直通接口；
* **v3.9 (2026-08-30)**
  * ⚡ **0ms 极速直出唤起**：去除点击时的异步网络阻塞，点击瞬间秒级调起播放器；
* **v1.0 - v3.0**
  * 🎉 初始全平台播放器支持与飞牛影视自动化无损注入框架发布。

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。欢迎提 Issue 与 PR！