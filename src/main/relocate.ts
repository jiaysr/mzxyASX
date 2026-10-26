import { existsSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { paths, saveConfig } from './paths'
import { clearConfig } from './settings'
import { readState } from './engine-updater'

/**
 * 递归统计目录大小。
 *
 * 一律用 fs/promises：引擎目录有一万多个小文件，
 * 同步遍历 + 同步删除会把主进程卡住几十秒，界面直接假死。
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
 * 搬一个目录：同盘 rename（瞬时），跨盘「复制到 .migrating 再改名」。
 *
 * 复制先写临时名：中途被打断不会留下一个看着可用、实际残缺的目录，
 * 下次重试删掉 .migrating 就能重来。
 */
async function moveDir(from: string, to: string): Promise<'renamed' | 'copied'> {
  if (!existsSync(from)) return 'renamed'
  if (existsSync(to)) throw new Error(`目标已存在，不会覆盖：${to}`)

  await mkdir(join(to, '..'), { recursive: true })
  try {
    await rename(from, to)
    return 'renamed'
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
  }

  const tmp = `${to}.migrating`
  await rm(tmp, { recursive: true, force: true })
  await cp(from, tmp, { recursive: true })
  await rename(tmp, to)
  return 'copied'
}

/**
 * 把引擎和数据迁到新根目录。
 *
 * 顺序很重要：**先复制、再写配置、最后才删旧目录**。
 * 配置写成功新位置就生效；旧目录删不掉只是占空间，不影响功能。
 */
export async function relocateRoot(newRoot: string): Promise<{ ok: boolean; message: string }> {
  const target = resolve(newRoot)
  const old = resolve(paths.root)

  if (target === old) return { ok: true, message: '目录没有变化' }
  if (target.startsWith(old + '\\') || old.startsWith(target + '\\')) {
    return { ok: false, message: '新目录不能是当前目录的上级或下级' }
  }
  if (existsSync(join(target, 'engine')) || existsSync(join(target, 'data'))) {
    return { ok: false, message: '新目录里已经有 engine 或 data，换个空目录' }
  }

  const moved: string[] = []
  try {
    await mkdir(target, { recursive: true })
    for (const name of ['engine', 'data']) {
      const from = join(old, name)
      if (!existsSync(from)) continue
      await moveDir(from, join(target, name))
      moved.push(name)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `迁移失败：${msg}（原目录未删除，数据仍在 ${old}）` }
  }

  // 配置一旦写成功，新位置就生效了
  saveConfig({ rootDir: target })

  // 旧目录能删就删，删不掉只提示，不影响使用
  const leftovers: string[] = []
  for (const name of ['engine', 'data']) {
    const from = join(old, name)
    if (!existsSync(from)) continue
    try {
      await rm(from, { recursive: true, force: true })
    } catch {
      leftovers.push(from)
    }
  }

  const head = moved.length
    ? `已迁移 ${moved.join('、')} 到 ${target}`
    : `已切换到 ${target}（新目录暂无数据）`
  return {
    ok: true,
    message: leftovers.length
      ? `${head}；旧目录有文件被占用没删掉，可稍后手动删除：${leftovers.join('、')}`
      : `${head}，即将重启`
  }
}

/**
 * 删掉除当前版本外的所有 code / env 目录。
 * 安装时也会自动清理，但删除可能因文件被占用失败，这里给用户一个手动入口。
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

/**
 * 卸载脚本：删掉 engine 与 data，并清掉 app-config.json。
 *
 * 目标是「删目录即卸载」——删完这里，磁盘上不留任何脚本相关的东西。
 * 用户配置和日志在 data 里，会一起删，所以调用方必须先确认。
 */
export async function uninstallEngine(): Promise<{
  ok: boolean
  message: string
  freedBytes: number
}> {
  // 防呆：目录不对就中止，别把整个盘或当前目录当脚本目录删了
  const root = resolve(paths.root)
  if (!root || /^[a-zA-Z]:\\?$/.test(root) || root === resolve('/')) {
    return { ok: false, message: `脚本目录异常，已中止卸载：${root}`, freedBytes: 0 }
  }

  let freed = 0
  freed += await dirSize(paths.engine)
  freed += await dirSize(paths.data)

  try {
    await rm(paths.engine, { recursive: true, force: true })
    await rm(paths.data, { recursive: true, force: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `删除失败：${msg}`, freedBytes: freed }
  }

  clearConfig()
  const mb = (freed / 1024 / 1024).toFixed(0)
  return {
    ok: true,
    message: `已卸载脚本，释放 ${mb} MB。整个目录可直接删除，不会留残余`,
    freedBytes: freed
  }
}
