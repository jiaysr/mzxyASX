import { BrowserWindow, net } from 'electron'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync, readdirSync, statSync } from 'node:fs'
import { once } from 'node:events'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import extract from 'extract-zip'
import { paths } from './paths'
import type { EngineInstallEvent } from '../shared/types'

/** 引擎更新清单，由脚本仓库的 CI 生成 */
export interface EngineManifest {
  channel: string
  api_version: number
  built_at?: string
  code: { version: string; url: string; sha256: string; size: number }
  env: { id: string; url: string; sha256: string; size: number }
}

export interface EngineStateFile {
  code_version: string
  env_id: string
  current: string
  channel: string
  api_version: number
  installed_at: string
}

/**
 * 默认清单地址（脚本仓库的 dev-latest 预发布）
 *
 * 本地联调用 MZXY_ENGINE_MANIFEST 覆盖成 http://127.0.0.1:PORT/manifest.json
 */
const DEFAULT_MANIFEST = 'https://github.com/jiaysr/mzxyAutoScript/releases/download/dev-latest/manifest.json'

let win: BrowserWindow | null = null

function send(event: EngineInstallEvent): void {
  if (win && !win.isDestroyed()) win.webContents.send('engine:event', event)
}

export function manifestUrl(): string {
  return (process.env.MZXY_ENGINE_MANIFEST || '').trim() || DEFAULT_MANIFEST
}

export function readState(): EngineStateFile | null {
  try {
    if (!existsSync(paths.engineState)) return null
    const data = JSON.parse(readFileSync(paths.engineState, 'utf-8')) as EngineStateFile
    return data?.current ? data : null
  } catch {
    return null
  }
}

function writeState(state: EngineStateFile): void {
  mkdirSync(paths.engine, { recursive: true })
  writeFileSync(paths.engineState, JSON.stringify(state, null, 2), 'utf-8')
}

function resolveUrl(base: string, rel: string): string {
  if (/^https?:\/\//i.test(rel)) return rel
  return new URL(rel, base).toString()
}

async function fetchManifest(): Promise<EngineManifest> {
  const url = manifestUrl()
  // 用 net.fetch 而不是全局 fetch：前者走 Chromium 网络栈，跟随系统代理
  const res = await net.fetch(url, { cache: 'no-store' })
  if (res.status === 404) {
    throw new Error(
      `还没发布过引擎包（404）。先让脚本仓库跑一次 Engine Pack 流水线，` +
        `或本地联调时用 MZXY_ENGINE_MANIFEST 指向本地 manifest.json。\n${url}`
    )
  }
  if (!res.ok) throw new Error(`清单请求失败 HTTP ${res.status}：${url}`)
  const manifest = (await res.json()) as EngineManifest
  if (!manifest?.code?.version || !manifest?.env?.id) {
    throw new Error('清单格式不正确，缺少 code.version 或 env.id')
  }
  return manifest
}

function sha256File(path: string): string {
  const hash = createHash('sha256')
  hash.update(readFileSync(path))
  return hash.digest('hex')
}

async function download(
  url: string,
  dest: string,
  expectSha: string,
  target: 'env' | 'code'
): Promise<void> {
  mkdirSync(join(dest, '..'), { recursive: true })
  const res = await net.fetch(url)
  if (!res.ok || !res.body) throw new Error(`下载失败 HTTP ${res.status}：${url}`)

  const total = Number(res.headers.get('content-length') || 0)
  let received = 0
  let lastTick = 0

  const file = createWriteStream(dest)
  // @ts-expect-error Readable.fromWeb 的类型定义与 Electron 的 body 不完全一致
  const stream = Readable.fromWeb(res.body)
  stream.on('data', (chunk: Buffer) => {
    received += chunk.length
    const now = Date.now()
    if (now - lastTick > 200 || received === total) {
      lastTick = now
      send({
        type: 'download',
        target,
        percent: total ? Math.round((received / total) * 100) : 0,
        received,
        total
      })
    }
  })
  stream.pipe(file)
  await once(file, 'finish')

  const actual = sha256File(dest)
  if (expectSha && actual !== expectSha) {
    rmSync(dest, { force: true })
    throw new Error(`${target} 包校验失败（sha256 不一致），已删除`)
  }
}

async function extractZip(zipPath: string, targetDir: string, target: 'env' | 'code'): Promise<void> {
  mkdirSync(targetDir, { recursive: true })
  let done = 0
  await extract(zipPath, {
    dir: targetDir,
    onEntry: () => {
      done += 1
      if (done % 200 === 0) send({ type: 'extract', target, percent: 0 })
    }
  })
}

/** 下载 → 校验 → 解压到独立目录 → 再 rename 到位，避免半成品被当成可用 */
async function fetchAndUnpack(
  url: string,
  sha256: string,
  finalDir: string,
  target: 'env' | 'code'
): Promise<void> {
  const tmpRoot = join(paths.engine, '.tmp')
  const tmpDir = join(tmpRoot, `${target}-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
  const zipPath = join(tmpDir, 'pack.zip')

  try {
    await download(url, zipPath, sha256, target)
    const unpacked = join(tmpDir, 'unpacked')
    await extractZip(zipPath, unpacked, target)

    if (existsSync(finalDir)) rmSync(finalDir, { recursive: true, force: true })
    mkdirSync(join(finalDir, '..'), { recursive: true })
    renameSync(unpacked, finalDir)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => {
      try {
        return statSync(join(dir, name)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

/** 只留当前版本和上一版，其余删掉 */
function prune(dir: string, keep: string[]): void {
  for (const name of listDirs(dir)) {
    if (!keep.includes(name)) {
      rmSync(join(dir, name), { recursive: true, force: true })
    }
  }
}

/**
 * 检查并按需安装 / 更新引擎
 *
 * @param force 忽略本地状态，强制按清单重装（用于「重新安装引擎」）
 */
export async function installEngine(
  getWindow: () => BrowserWindow | null,
  force = false
): Promise<{ ok: boolean; message: string }> {
  win = getWindow()
  try {
    send({ type: 'checking' })
    const manifest = await fetchManifest()
    const state = readState()

    const envDir = join(paths.engineEnv, manifest.env.id)
    const codeDir = join(paths.engineCode, manifest.code.version)

    const needEnv = force || !state || state.env_id !== manifest.env.id || !existsSync(envDir)
    const needCode =
      force ||
      !state ||
      state.channel !== manifest.channel ||
      state.current !== manifest.code.version ||
      !existsSync(codeDir)

    if (!needEnv && !needCode) {
      send({ type: 'uptodate', codeVersion: state!.current })
      return { ok: true, message: '引擎已是最新' }
    }

    send({
      type: 'plan',
      needEnv,
      needCode,
      envSize: manifest.env.size,
      codeSize: manifest.code.size
    })

    if (needEnv) {
      await fetchAndUnpack(
        resolveUrl(manifestUrl(), manifest.env.url),
        manifest.env.sha256,
        envDir,
        'env'
      )
    }

    if (needCode) {
      await fetchAndUnpack(
        resolveUrl(manifestUrl(), manifest.code.url),
        manifest.code.sha256,
        codeDir,
        'code'
      )
    }

    const next: EngineStateFile = {
      code_version: manifest.code.version,
      env_id: manifest.env.id,
      current: manifest.code.version,
      channel: manifest.channel,
      api_version: manifest.api_version,
      installed_at: new Date().toISOString()
    }
    writeState(next)

    // 清理旧版本失败（文件被占用）不该让整个安装报错
    try {
      prune(paths.engineEnv, [manifest.env.id])
      prune(paths.engineCode, [manifest.code.version])
    } catch (e) {
      console.warn('[engine] 清理旧版本失败', e)
    }

    send({ type: 'done', codeVersion: next.code_version, envId: next.env_id })
    return { ok: true, message: `引擎已就绪：${next.code_version}` }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    send({ type: 'error', message })
    return { ok: false, message }
  }
}
