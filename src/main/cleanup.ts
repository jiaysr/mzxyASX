import { existsSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { paths } from './paths'
import { readState } from './engine-updater'

/**
 * 递归统计目录大小。
 *
 * 一律用 fs/promises：引擎目录有一万多个小文件，
 * 同步遍历会把主进程卡住，界面直接假死。
 */
export async function dirSize(dir: string): Promise<number> {
  let total = 0
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        total += await dirSize(full)
      } else {
        try {
          total += (await stat(full)).size
        } catch {
          /* 文件刚好被删，忽略 */
        }
      }
    }
  } catch {
    /* 目录不存在，返回已统计的部分 */
  }
  return total
}

/**
 * 删掉除当前版本外的所有 code / env 目录。
 *
 * 安装引擎时会自动清理，但删除可能因文件被占用失败，
 * 这里给用户一个手动入口（界面上的「清理旧版本」）。
 */
export async function cleanupOldVersions(): Promise<{
  ok: boolean
  message: string
  freedBytes: number
}> {
  const state = readState()
  if (!state) return { ok: false, message: '引擎还没安装，没有可清理的内容', freedBytes: 0 }

  const targets: Array<[string, string]> = [
    [paths.engineCode, state.current],
    [paths.engineEnv, state.env_id]
  ]

  let freed = 0
  const failed: string[] = []
  for (const [dir, keep] of targets) {
    if (!existsSync(dir)) continue
    let entries: Dirent[] = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === keep) continue
      const full = join(dir, entry.name)
      const size = await dirSize(full)
      try {
        await rm(full, { recursive: true, force: true })
        freed += size
      } catch {
        failed.push(entry.name)
      }
    }
  }

  const mb = (freed / 1024 / 1024).toFixed(0)
  if (failed.length) {
    return {
      ok: false,
      message: `释放 ${mb} MB，但 ${failed.join('、')} 删不掉（可能被占用，关闭引擎后重试）`,
      freedBytes: freed
    }
  }
  return { ok: true, message: `已释放 ${mb} MB`, freedBytes: freed }
}
