import { app } from 'electron'
import { join } from 'node:path'

/**
 * 目录布局（三层物理隔离）
 *
 *   %LOCALAPPDATA%\mzxy\engine\env\<env_id>\   Python 运行时 + site-packages（更新单元：env）
 *   %LOCALAPPDATA%\mzxy\engine\code\<ver>\     脚本代码 module/tasks/assets（更新单元：code）
 *   %LOCALAPPDATA%\mzxy\engine\state.json      当前指针 {code_version, env_id, current}
 *   %LOCALAPPDATA%\mzxy\data\                  用户配置与日志，永不覆盖
 *
 * 为什么不用 Roaming：引擎 400MB 上下，Roaming 会在域环境里被同步。
 */
export function setupPaths(): void {
  const base = process.env.LOCALAPPDATA || app.getPath('appData')
  app.setPath('userData', join(base, 'mzxy'))
}

export const paths = {
  get root(): string {
    return app.getPath('userData')
  },
  get engine(): string {
    return join(this.root, 'engine')
  },
  get engineEnv(): string {
    return join(this.engine, 'env')
  },
  get engineCode(): string {
    return join(this.engine, 'code')
  },
  get engineState(): string {
    return join(this.engine, 'state.json')
  },
  get data(): string {
    return join(this.root, 'data')
  },
  get config(): string {
    return join(this.data, 'config')
  },
  get log(): string {
    return join(this.data, 'log')
  }
}
