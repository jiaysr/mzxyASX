import { app } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from './paths'
import type { EngineStatus } from '../shared/types'

/** engine/state.json 的结构，由更新器写入 */
interface EngineStateFile {
  code_version?: string
  env_id?: string
  current?: string
  channel?: string
}

/**
 * 引擎进程管理。
 *
 * 这一版只做「目录约定 + 生命周期 + 健康检查」，
 * 真正的 Python 引擎包由脚本仓库的 CI 产出（code-<ver>.zip / env-<env_id>.zip），
 * 落地后这里的 start() 不需要改。
 */
class EngineManager {
  private child: ChildProcess | null = null
  private port: number | null = null

  isBusy(): boolean {
    return this.child !== null
  }

  private readState(): EngineStateFile {
    try {
      if (!existsSync(paths.engineState)) return {}
      return JSON.parse(readFileSync(paths.engineState, 'utf-8')) as EngineStateFile
    } catch {
      return {}
    }
  }

  private resolvePython(envId: string | undefined): string | null {
    if (!envId) return null
    const candidates = [
      join(paths.engineEnv, envId, 'python.exe'),
      join(paths.engineEnv, envId, 'pythonw.exe')
    ]
    return candidates.find((p) => existsSync(p)) ?? null
  }

  private resolveCode(version: string | undefined): string | null {
    if (!version) return null
    const dir = join(paths.engineCode, version)
    return existsSync(dir) ? dir : null
  }

  status(): EngineStatus {
    const state = this.readState()
    const pythonPath = this.resolvePython(state.env_id)
    const codePath = this.resolveCode(state.current ?? state.code_version)
    const installed = Boolean(pythonPath && codePath)

    let message = '引擎未安装'
    if (installed) message = this.child ? '运行中' : '已停止'

    return {
      installed,
      running: this.child !== null,
      codeVersion: state.current ?? state.code_version ?? null,
      envId: state.env_id ?? null,
      channel: state.channel ?? null,
      pid: this.child?.pid ?? null,
      port: this.port,
      pythonPath,
      codePath,
      engineRoot: paths.engine,
      message
    }
  }

  async start(): Promise<{ ok: boolean; message: string; port?: number }> {
    if (this.child) return { ok: false, message: '引擎已在运行' }

    const status = this.status()
    if (!status.installed || !status.pythonPath || !status.codePath) {
      return {
        ok: false,
        message: '引擎尚未安装：请先构建 code / env 包并放到 engine 目录'
      }
    }

    const port = await pickFreePort()
    mkdirSync(paths.data, { recursive: true })

    const child = spawn(status.pythonPath, ['server.py', '-p', String(port)], {
      cwd: status.codePath,
      env: {
        ...process.env,
        MZXY_DATA_DIR: paths.data,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout?.on('data', (d) => console.log('[engine]', String(d).trimEnd()))
    child.stderr?.on('data', (d) => console.error('[engine]', String(d).trimEnd()))
    child.on('exit', (code) => {
      console.log(`[engine] 退出，code=${code}`)
      this.child = null
      this.port = null
    })

    this.child = child
    this.port = port

    const alive = await waitHealthy(port, 30_000)
    if (!alive) {
      this.stop()
      return { ok: false, message: '引擎启动超时（30 秒内 /test 未就绪）' }
    }
    return { ok: true, message: '引擎已启动', port }
  }

  stop(): void {
    const pid = this.child?.pid
    this.child = null
    this.port = null
    if (!pid) return
    try {
      // Windows 上必须杀进程树：python 会再拉 OCR 服务等子进程
      spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true })
    } catch {
      /* ignore */
    }
  }
}

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

async function waitHealthy(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await ping(port)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function ping(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    const res = await fetch(`http://127.0.0.1:${port}/test`, { signal: ctrl.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

export const engine = new EngineManager()

// app 退出时确保子进程一起收掉（before-quit 里也会再调一次）
app.on('will-quit', () => engine.stop())
