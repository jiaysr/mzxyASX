# mzxyASX

明珠轩辕自动化脚本的控制台（Electron 层）。

脚本本体在 [mzxyAutoScript](https://github.com/jiaysr/mzxyAutoScript)。控制台只负责界面、
脚本目录管理、进程启停和自身更新；脚本的安装与更新完全交给脚本目录里的
`deploy.installer`（git pull + 依赖 + adb），不再由控制台下载 code/env 发布包。

界面技术栈：Electron + Vue 3 + TypeScript + Element Plus，字体为小米 MiSans（可变字重，按 unicode-range 分块懒加载）。

主题定制只覆盖 Element Plus 的 CSS 变量（`src/renderer/src/styles/element.css`），
不改组件内部结构，升级 Element Plus 时不会冲突。暗色模式走官方的 `<html class="dark">` 约定。

## 目录布局

```
<root>\                       默认就是 mzxy.exe 所在目录（控制台自己的数据）
├─ app-config.json            控制台数据目录 + 用户选择的脚本目录
├─ data\                      控制台偏好（prefs.json）、引擎 pid
└─ profile\                   Chromium 缓存

<scriptDir>\                  用户在界面里选择的脚本目录，位置任意
├─ toolkit\                   Python 运行时 + Git + pip
│  ├─ python.exe
│  └─ Git\mingw64\bin\git.exe
├─ module\  tasks\  assets\   脚本代码（git 工作区）
├─ deploy\installer.py        git pull + pip + adb
└─ config\deploy.yaml         仓库地址、分支、WebuiPort、OCR 等
```

exe 目录不可写时（装到 Program Files），控制台数据退回 `%LOCALAPPDATA%\mzxy`。

脚本目录放在 `<root>\engine\` 时，安装器钩子会在控制台更新时顺带保留它；
放在其它位置则本来就不受安装器影响。无论放哪，删除脚本目录即卸载脚本。

## 脚本目录准备

1. 从 [mzxyAutoScript Releases](https://github.com/jiaysr/mzxyAutoScript/releases) 下载
   `mzxyAutoScript-easy-install-<ver>.zip`，解压到任意目录（含 Python + Git + deploy 安装器，
   代码和依赖首次启动时自动拉取）；或
2. `git clone -b dev https://github.com/jiaysr/mzxyAutoScript`，再补一份 `toolkit\`。

然后在控制台登录页或「设置 → 脚本服务」里选择该目录。目录校验三项：

- `toolkit\python.exe`
- `toolkit\Git\mingw64\bin\git.exe`（或 `toolkit\Git\cmd\git.exe`）
- `deploy\installer.py`

`config\deploy.yaml` 缺失时会由 `deploy.installer` 按模板自动生成。

## 开发

```bash
npm install
npm run dev          # electron-vite dev
npm run typecheck
npm run build        # 产物在 out/
```

开发模式下控制台数据在 `%LOCALAPPDATA%\mzxy`，脚本目录仍然手动选择。

## 发布

```bash
npm version patch              # 改版本号并打 tag
git push --follow-tags         # 触发 .github/workflows/release.yml
```

只走 CI，不要本地 `dist:publish`：同一个版本号打两次包，NSIS 产物 sha512 不同，
先发的那份 `latest.yml` 会和后覆盖的 exe 对不上，客户端报 `sha512 checksum mismatch`。
`dist:publish` 会先跑 `scripts/publish-guard.mjs`，远端已有同名 tag/Release 就拒绝。

CI 会产出并上传到 Release：

| 文件 | 用途 |
|---|---|
| `mzxy-Setup-<ver>.exe` | 安装包 |
| `mzxy-Setup-<ver>.exe.blockmap` | 差量索引（NSIS 上收益有限） |
| `latest.yml` | 版本清单，客户端读它判断有没有新版本 |

客户端固定读这个地址，永远不用改：

```
https://github.com/jiaysr/mzxyASX/releases/latest/download/latest.yml
```

## 更新机制

- **控制台**：electron-updater，启动 5 秒后检查，静默下载，重启生效。脚本在跑任务时
  只下载不安装（`quitAndInstall` 会强杀脚本）。
- **脚本**：启动脚本服务前执行 `deploy.installer`，由它 `git pull` 分支并补齐依赖；
  「更新」页也可以手动拉取（`/home/execute_update`）。分支、代理、pip 源都在
  `config/deploy.yaml` 里配置。
- 控制台不再有 `manifest.json` / `code-*.zip` / `env-*.zip` 这条下载链路，
  也不会把引擎放进 `engine\code\<ver>` 或 `engine\env\<id>`。

`deploy.installer` 默认 `KeepLocalChanges: false`，会 `reset --hard` 到远端分支。
脚本目录有未提交改动时，控制台启动前会弹出确认，可以选择「跳过更新直接启动」。

### 安装器保留目录

控制台数据在安装目录下（便携布局），NSIS 更新会先跑旧卸载器把整个 `$INSTDIR`
搬走再删。`build/installer-hooks.nsh` 在新安装器的 `.onInit` 里（早于旧卸载器）
把 `engine` / `data` / `profile` 同盘改名到 `..\.mzxy-keep`，装完再改回来；
中途失败留下的残留由 `src/main/portable-keep.ts` 在启动时合回。卸载仍然删干净。

### 实测：NSIS 的差量更新接近全量

v0.1.0 → v0.1.1 只改了版本号，实际下载 **106.5 MB / 111.6 MB**。

原因：blockmap 是对**压缩后的安装包**做分块，NSIS 用整体压缩，改动会让大量分块位移。
所以「UI 更新只下几百 KB」不成立，一次 UI 更新基本等于重下整个安装包。

对策：UI 更新频率低，100 MB 可以接受，先不优化；真要省流量得把 `app.asar`
单独发补丁。脚本更新不走安装包，由 git 增量拉取，改多少下多少。

## 开发模式下测更新

`electron-updater` 只在打包后工作。本地验证需要：

```bash
npm run dist        # 装 0.1.0
# 改版本号为 0.1.1，再 dist，装一遍
```

或者用 `forceDevUpdateConfig` 指向本地 `latest.yml`。

## 已验证的链路

| 环节 | 结果 |
|---|---|
| push main → CI（typecheck + build） | ✅ 通过 |
| push tag → Release workflow | ✅ 通过，单 Release 含 3 个资产 |
| `releases/latest/download/latest.yml` | ✅ 200 |
| 静默安装 → 自动检查更新 → 重启生效 | ✅ 通过 |
| 打包后默认目录 = exe 目录 | ✅ 便携版验证 |
| 脚本目录启动（installer + server + /test） | ✅ 0.3.1 本地验证（服务启动/日志/跳过 installer + OAS 包手动 installer） |
| 旧 code/env 发布包引擎 | 已移除支持，见迁移公告 |

## 已知待办

- 未做代码签名，首次运行会有 SmartScreen 提示
- 旧版 `engine\code|env` 发布包引擎不再维护：升级后提示准备完整脚本目录并重新选择
- 脚本仓库已回退到 git 更新方式；引擎安装包使用 OAS easy-install 改造版
  （`mzxy-install-v1.0.0`，4 个分卷），完整包脚本备份在 `backup/engine-pack-20261028`
