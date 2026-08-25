# 飞牛影视 (fnOS) 全能外部播放器调用插件 🚀

为 **飞牛 OS (fnOS) 飞牛影视 (`trim.media`)** 打造的服务端免插件注入工具。支持一键唤起 **PotPlayer、VLC、IINA、Infuse、MPV、弹弹Play、NPlayer、恒星播放器** 等全套主流播放器，支持 4K 蓝光原画无损秒播、OpenList / AList / STRM 极速预解析与历史进度断点续播！

---

## 📸 效果预览

![飞牛影视外部播放器效果预览](docs/preview.png)

---

## 🌟 特性一览

* 🎬 **全主流播放器支持**：支持 `PotPlayer`、`VLC`、`IINA`、`Infuse`、`MPV`、`弹弹Play`、`NPlayer`、`恒星播放器`，并支持一键复制串流地址；
* ⚡ **OpenList / AList 级别极致秒播体验**：
  * **0 毫秒同步即时响应**：去除点击时的异步网络延迟，点击按钮瞬间（0ms）直接触发协议唤起，与在 OpenList / AList 网页中点击播放体验完全一致！
  * **0.07 秒极速 302 直连**：对于 Alist / OpenList / 天翼云盘 / 115 / 夸克 / 阿里云盘 生成的 `.strm` 文件，毫秒级 302 重定向到原生直链，直接与网盘/OpenList 建立原生高速直连，**跑满千兆宽带秒开**！
* 🔥 **多线程并发推流网关（端口 `5668`）**：采用多线程高并发架构，针对 PotPlayer 打开 4K 蓝光影片时的 10~20 个分块探测请求瞬间并行响应，**0% 转码 CPU 占用，毫秒级拖动快进**；
* ⏱ **历史进度自动续播**：自动同步你在飞牛影视上次的观影历史，调起播放器时自动附带 `/seek=hh:mm:ss` 从断点处无缝续播；
* 🛡 **系统升级防失效**：配置 systemd 常驻守护及 Cron 定时校验，fnOS 或飞牛影视升级后自动恢复注入，无需重新配置；
* 🖥 **客户端零侵入**：纯服务端免浏览器油猴插件/扩展，手机、平板、电脑浏览器访问飞牛影视均可直接显示外部播放器按钮组。

---

## 🚀 一键安装

SSH 登录你的 **fnOS 终端**（或控制台），以 `sudo` 运行以下命令：

```bash
curl -sSL https://raw.githubusercontent.com/fu5502/fnos-external-player/main/install.sh | sudo bash
```

安装完成后，在电脑或手机浏览器中打开飞牛影视，按 **`Ctrl + F5`**（强制刷新）进入任意电影或电视剧详情页，即可看到外部播放器工具栏！

---

## 🗑️ 一键卸载

如果需要卸载或还原，直接在终端执行：

```bash
curl -sSL https://raw.githubusercontent.com/fu5502/fnos-external-player/main/uninstall.sh | sudo bash
```

---

## 🛠 系统架构

```text
[ 浏览器 (飞牛影视 Web) ]
       │ (点击 ▶ PotPlayer / VLC / IINA / Infuse)
       ▼ (0ms 同步即时触发)
[ fnExternalPlayer.js (前端注入) ] ── (自动提取历史断点 /seek=00:18:45)
       │
       ▼
[ Direct Stream 多线程网关服务 (:5668) ] ── (查询 trimmedia.db 定位底层文件)
       ├─ 本地原盘 (MP4/MKV/ISO) ───► HTTP 206 多线程并行直推 ───► 播放器 GPU 硬解
       └─ 网盘虚拟串流 (.strm) ─────► 0.07s 极速 302 ──────────► OpenList / 云端 CDN 原生秒开
```

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。欢迎 Star、Fork 与提交 PR！