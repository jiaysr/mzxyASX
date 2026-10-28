<!-- kind: ui -->
# 脚本引擎改为独立脚本目录

从这个版本开始，控制台不再下载、安装或更新引擎，回到脚本自身的 git 更新方式：

- 控制台只负责选择脚本目录、执行 `deploy.installer`、启动/停止 `server.py`
- 脚本的更新是 `git pull` + 依赖安装，和原版 OASX 一致
- 旧的 `engine\code\<ver>` / `engine\env\<id>` 发布包引擎不再维护
- 脚本仓库已回退到 git 更新方式，不再产出 code/env 发布包

## 升级后要做的

1. 从 mzxyAutoScript Releases 下载 `mzxyAutoScript-easy-install-<ver>.zip` 并解压
   （或 `git clone -b dev` 后补 `toolkit\`）
2. 放在任意目录（放在安装目录的 `engine\` 下也可以，更新时会保留）
3. 在登录页或「设置 → 脚本服务」里选择该目录
4. 点「启动脚本服务」，首次会执行 `deploy.installer` 初始化 git 并安装依赖

## 注意事项

- 脚本目录有未提交改动时，启动前会提示；`deploy.installer` 默认会 `reset --hard`
- 「更新设置 → 启动前更新脚本」可以关闭每次启动的 git pull
- 控制台自身的更新不受影响，脚本目录在安装目录外时完全不会被安装器碰到
