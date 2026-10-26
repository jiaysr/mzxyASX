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
| `mzxy-Setup-<ver>.exe.blockmap` | 差量索引（见下方实测：NSIS 上收益有限） |
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

### 实测：NSIS 的差量更新接近全量

v0.1.0 → v0.1.1 只改了版本号，实际下载 **106.5 MB / 111.6 MB**。

原因：blockmap 是对**压缩后的安装包**做分块，NSIS 用整体压缩，改动会让大量分块位移。
所以「UI 更新只下几百 KB」不成立，一次 UI 更新基本等于重下整个安装包。

对策：
- UI 更新频率低（一周一两次），100 MB 可以接受，先不优化
- 真要省流量，得把变化频繁的部分（`app.asar`）单独发补丁，不走安装包
- 引擎层的 `code` 包不走安装包，是纯 zip，那部分仍然是「改多少下多少」

## 开发模式下测更新

`electron-updater` 只在打包后工作。本地验证需要：

```bash
npm run dist        # 装 0.1.0
# 改版本号为 0.1.1，再 dist，装一遍
```

或者用 `forceDevUpdateConfig` 指向本地 `latest.yml`。

## 已验证的链路（2026-10-26）

| 环节 | 结果 |
|---|---|
| push main → CI（typecheck + build） | ✅ 通过 |
| push tag v0.1.1 → Release workflow | ✅ 通过，单 Release 含 3 个资产 |
| `releases/latest/download/latest.yml` | ✅ 200，指向 0.1.1 |
| 静默安装 0.1.0 | ✅ 注册表 DisplayVersion=0.1.0 |
| 启动 0.1.0 → 自动检查更新 | ✅ 拉 blockmap + 下载 0.1.1 |
| 关闭应用 → 自动安装 | ✅ 注册表变 0.1.1，exe 文件版本 0.1.1 |
| 启动 0.1.1 | ✅ 正常常驻 |

## 已知待办

- 两个 `v0.1.0` 的 Release 是早期 `--publish always` 造成的重复（资产被拆散），需手动删除
- 引擎包（`code` / `env`）的下载与切换逻辑尚未接上，等脚本仓库的打包流水线
- 未做代码签名，首次运行会有 SmartScreen 提示

