import { app } from 'electron'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Announcement, AnnouncementKind } from '../shared/types'

/**
 * 公告来自随应用打包的 markdown 文件：`resources/announcements/*.md`
 *
 * 用文件名前缀控制顺序（`01-usage.md`、`02-xxx.md`），
 * 标题取文件里的第一个 `# ` 一级标题，没有就用文件名。
 * 想发新公告直接加文件，不用改代码。
 *
 * 文件第一行可以写 `<!-- kind: ui -->` 标明类型（界面更新 / 脚本更新 / 公告），
 * 不写就是普通公告。这行会被剥掉，不会渲染到正文里。
 */
function announcementsDir(): string {
  return join(app.getAppPath(), 'resources', 'announcements')
}

const KINDS: AnnouncementKind[] = ['ui', 'script', 'notice']

/** 从正文里取出 kind 标记，返回 [类型, 去掉标记的正文] */
function splitKind(raw: string): [AnnouncementKind, string] {
  const match = /^\s*<!--\s*kind\s*:\s*(\w+)\s*-->\s*\r?\n?/i.exec(raw)
  if (!match) return ['notice', raw]
  const kind = match[1].toLowerCase() as AnnouncementKind
  return [KINDS.includes(kind) ? kind : 'notice', raw.slice(match[0].length)]
}

export function listAnnouncements(): Announcement[] {
  const dir = announcementsDir()
  if (!existsSync(dir)) return []

  const items: Announcement[] = []
  for (const file of readdirSync(dir)) {
    if (!file.toLowerCase().endsWith('.md')) continue
    try {
      const [kind, content] = splitKind(readFileSync(join(dir, file), 'utf-8'))
      const id = file.replace(/\.md$/i, '')
      const title = /^#\s+(.+)$/m.exec(content)?.[1]?.trim() || id
      items.push({ id, title, content, kind })
    } catch {
      // 单个文件读失败不影响其它公告
    }
  }
  return items.sort((a, b) => a.id.localeCompare(b.id))
}
