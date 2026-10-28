import { existsSync, readdirSync, renameSync, rmdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 兜底恢复安装器「搬走再搬回」的便携目录。
 *
 * 更新时 build/installer-hooks.nsh 会把 engine/data/profile 改名到
 * <安装目录>\..\.mzxy-keep，装完改回来。断电、安装中断、恢复时文件被占用
 * 都会留下这个目录，这里在启动早期把它合回 rootDir。
 *
 * 只做同盘 rename，不复制；目标已存在的项不动（可能是更新的数据），
 * 并保留残留目录，避免误删用户数据。
 */
const KEEP_PREFIX = '.mzxy-keep'
const ITEMS = ['engine', 'data', 'profile'] as const

export function restorePortableKeep(root: string): void {
  const parent = dirname(root)
  let leftovers: string[]
  try {
    leftovers = readdirSync(parent, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith(KEEP_PREFIX))
      .map((e) => e.name)
  } catch {
    return
  }
  for (const name of leftovers) restoreOne(join(parent, name), root)
}

function restoreOne(keepDir: string, root: string): void {
  const blocked: string[] = []
  for (const item of ITEMS) {
    const from = join(keepDir, item)
    if (!existsSync(from)) continue
    const to = join(root, item)
    if (existsSync(to)) {
      blocked.push(item)
      continue
    }
    try {
      renameSync(from, to)
      console.log(`[portable] 已恢复 ${item}：${from} → ${to}`)
    } catch (e) {
      blocked.push(item)
      console.warn(`[portable] 恢复 ${item} 失败`, e)
    }
  }
  if (blocked.length > 0) {
    console.warn(`[portable] ${keepDir} 里的 ${blocked.join('、')} 未能恢复，保留该目录`)
    return
  }
  try {
    rmdirSync(keepDir)
  } catch {
    /* 非空或被占用：留给下次启动 */
  }
}
