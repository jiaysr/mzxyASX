import { dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'

/** 背景图上限，再大 base64 塞进渲染层会明显卡顿 */
const MAX_BYTES = 24 * 1024 * 1024

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif'
}

export const IMAGE_EXTENSIONS = Object.keys(MIME).map((e) => e.slice(1))

/**
 * 把本地图片读成 data URL。
 *
 * 不用 file:// 直接引用：渲染层是从 file:// 加载的，
 * 再引一个任意本地文件在不同 Electron 版本下行为不一致，
 * 转成 data URL 最稳，也不受 CSP 影响。
 */
export function readImage(file: string): string | null {
  try {
    if (!existsSync(file)) return null
    const ext = extname(file).toLowerCase()
    const mime = MIME[ext]
    if (!mime) return null
    if (statSync(file).size > MAX_BYTES) return null
    return `data:${mime};base64,${readFileSync(file).toString('base64')}`
  } catch {
    return null
  }
}

/** 弹文件选择框，选完直接读成 data URL */
export async function pickBackground(
  win: BrowserWindow | null
): Promise<{ path: string; dataUrl: string } | null> {
  const options = {
    title: '选择背景图片',
    properties: ['openFile' as const],
    filters: [{ name: '图片', extensions: IMAGE_EXTENSIONS }]
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths.length) return null

  const file = result.filePaths[0]
  const dataUrl = readImage(file)
  if (!dataUrl) throw new Error('这个文件读不了（格式不支持或超过 24MB）')
  return { path: file, dataUrl }
}
