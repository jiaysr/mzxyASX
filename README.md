# mzxyASX

明珠轩辕自动化脚本的控制台（Electron 层）。

脚本本体在 [mzxyAutoScript](https://github.com/jiaysr/mzxyAutoScript)，本仓库只负责界面、进程管理与自更新。

## 目录布局（三层物理隔离）

```
%LOCALAPPDATA%\mzxy\
├─ engine\                    引擎（由脚本仓库 Release 提供，可整体替换）
│  ├─ env\<env_id>\           Python 运行时 + site-packages + OCR 模型（更新单元：env）
│  ├─ code\<version>\         module / tasks / assets（更新单元：code）
│  └─ state.json              当前指针 { code_version, env_id, current, channel }
└─ data\                      用户配置与日志，更新永不覆盖
   ├─ config\
   └─ log\
```

安装目录（`%LOCALAPPDATA%\Programs\mzxy`）只放 Electron 本体，**不可写**。
引擎必须放在 `userData` 下，否则 UI 更新时会被正在运行的 `python.exe` 锁住。

## 开发

```bash
npm install
npm run dev          # electron-vite dev
npm run typecheck
npm run build        # 产物在 out/
```

## 发布

```bash
npm version patch              # 改版本号并打 tag
git push --follow-tags         # 触发 .github/workflows/release.yml
```

CI 会产出并上传到 Release：

| 文件 | 用途 |
|---|---|
| `mzxy-Setup-<ver>.exe` | 安装包 |
| `mzxy-Setup-<ver>.exe.blockmap` | 差量索引，用户只下改动的部分 |
| `latest.yml` | 版本清单，客户端读它判断有没有新版本 |

客户端固定读这个地址，永远不用改：

```
https://github.com/jiaysr/mzxyASX/releases/latest/download/latest.yml
```

## 更新机制

- **应用层（本窗口）**：electron-updater，启动 5 秒后检查，静默下载，重启生效
- **代码层**：脚本仓库的 `code-<ver>.zip`，几 MB，重启后切换目录
- **依赖层**：脚本仓库的 `env-<env_id>.zip`，几百 MB，只有 `requirements.txt` 变了才下

引擎在跑任务时，UI 更新只下载不安装（`quitAndInstall` 会强杀脚本）。

## 开发模式下测更新

`electron-updater` 只在打包后工作。本地验证需要：

```bash
npm run dist        # 装 0.1.0
# 改版本号为 0.1.1，再 dist，装一遍
```

或者用 `forceDevUpdateConfig` 指向本地 `latest.yml`。
