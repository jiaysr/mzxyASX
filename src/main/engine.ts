import { app } from 'electron'
import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { get as httpGet } from 'node:http'
import { dirname, join, resolve, sep } from 'node:path'
import { paths } from './paths'
import { getConfig } from './settings'
import type { ActionResult, DeployFile, EngineLogEvent, EngineStatus } from '../shared/types'

/**
 * 脚本进程管理（OASX 模式）。
 *
 * 控制台不下载、不安装、不更新引擎，只负责：
 *   1. 校验用户选择的脚本目录
 *   2. 启动前执行 `deploy.installer`（git pull + 依赖）
 *   3. 启动 `server.py`，从日志里的 `[Port]` 读实际端口
 *
 * 数据目录不注入 MZXY_DATA_DIR：配置和日志留在脚本目录里，和原版 OASX 一致。
 */
interface PidRecord {
  pid: number
  port: number | null
  scriptDir: string
  startedAt: string
}

export interface ScriptInfo {
  dir: string
  valid: boolean
  missing: string[]
  python: string | null
  git: string | null
  branch: string | null
  commit: string | null
  dirty: boolean
  hasGit: boolean
}

function pidFile(): string {
  return join(paths.data, 'engine.pid')
}

function writePidFile(record: PidRecord): void {
  try {
    mkdirSync(paths.data, { recursive: true })
    writeFileSync(pidFile(), JSON.stringify(record), 'utf-8')
  } catch {
    /* 写不进去不影响运行 */
  }
}

function clearPidFile(): void {
  try {
    rmSync(pidFile(), { force: true })
  } catch {
    /* ignore */
  }
}

/** 行缓冲：子进程输出可能一条日志拆成多个 chunk */
function lineSplitter(onLine: (line: string) => void): (chunk: Buffer) => void {
  let buffer = ''
  return (chunk) => {
    buffer += chunk.toString('utf-8')
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, '')
      buffer = buffer.slice(index + 1)
      if (line) onLine(line)
      index = buffer.indexOf('\n')
    }
    // 长时间没有换行的输出（比如 pip 进度条）也别把内存撑爆
    if (buffer.length > 8192) {
      onLine(buffer)
      buffer = ''
    }
  }
}

/**
 * 把脚本目录写进 embeddable Python 的 `python310._pth`。
 *
 * 完整包如果在 CI 里用 embeddable Python 组装，toolkit 根目录会带 `._pth`；
 * 一旦存在，sys.path 就完全由它决定，`server.py` 所在目录不再自动加入，
 * `from module...` 会直接 ModuleNotFoundError。原版完整安装的 toolkit 没有
 * 这个文件，所以只在存在时才动。
 */
function ensureSysPath(pythonPath: string, scriptDir: string): void {
  const pth = join(dirname(pythonPath), 'python310._pth')
  if (!existsSync(pth)) return
  try {
    const lines = readFileSync(pth, 'utf-8')
      .split(/\r?\n/)
      .map((line) => line.trim())
    if (lines.includes(scriptDir)) return
    writeFileSync(pth, [...lines.filter(Boolean), scriptDir, ''].join('\n'), 'utf-8')
  } catch (e) {
    console.warn('[engine] 更新 python310._pth 失败', e)
  }
}

function execText(
  file: string,
  args: string[],
  cwd: string,
  timeout = 8000
): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { cwd, timeout, windowsHide: true, encoding: 'utf-8' },
      (err, stdout, stderr) => {
        resolve({ ok: !err, out: `${stdout ?? ''}${stderr ? `\n${stderr}` : ''}` })
      }
    )
  })
}

/**
 * easy-install 包放在脚本目录根部的 bootstrap 文件。
 *
 * 它们不在 git 仓库里，git init 后会一直是未跟踪状态；如果算进 dirty，
 * 每次启动都会误报「有未提交改动」。只忽略这几个固定文件名。
 */
const BOOTSTRAP_FILES = new Set([
  'console.bat',
  'oas-backend.bat',
  'oas-server.bat',
  'README-easy-install.txt',
  'mzxy.exe',
  'oas.exe'
])

function isBootstrapUntracked(line: string): boolean {
  const match = /^\?\?\s+(.+)$/.exec(line.trim())
  if (!match) return false
  let path = match[1].trim()
  if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1)
  path = path.replace(/^\.\//, '')
  return BOOTSTRAP_FILES.has(path)
}

/**
 * Git for Windows 的 HTTPS helper（git-remote-https.exe）在这个包的
 * mingw64/bin 下，直接调 mingw64/bin/git.exe 时需要 GIT_EXEC_PATH 指过去，
 * 否则更新器的 git fetch/pull 会报 "git: 'remote-https' is not a git command"。
 */
function gitExecPath(dir: string): string | undefined {
  const path = join(dir, 'toolkit', 'Git', 'mingw64', 'bin')
  return existsSync(path) ? path : undefined
}

/** 控制台安装目录（exe 所在目录）；开发模式是 electron.exe 的目录 */
function uiInstallDir(): string {
  try {
    return dirname(app.getPath('exe'))
  } catch {
    return ''
  }
}

function isInsideDir(child: string, parent: string): boolean {
  if (!child || !parent) return false
  const c = resolve(child).toLowerCase()
  const p = resolve(parent).toLowerCase()
  return c === p || c.startsWith(`${p}${sep}`)
}

/** deploy.yaml 里的 WebuiPort；读不到就按原版默认 22267 */
function readDeployPort(dir: string): number | null {
  try {
    const text = readFileSync(join(dir, 'config', 'deploy.yaml'), 'utf-8')
    const match = /^\s*WebuiPort:\s*(\d+)/m.exec(text)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

/** 用 tasklist 确认这个 pid 确实是 python，避免 pid 复用误杀别的进程 */
function isPythonProcess(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false)
      return
    }
    const child = spawn('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      windowsHide: true
    })
    let out = ''
    child.stdout?.on('data', (d) => {
      out += String(d)
    })
    child.on('close', () => resolve(/python/i.test(out)))
    child.on('error', () => resolve(false))
  })
}

class EngineManager {
  private child: ChildProcess | null = null
  private installer: ChildProcess | null = null
  private port: number | null = null
  private stopping = false
  private tail: string[] = []
  private cached: { dir: string; at: number; info: ScriptInfo } | null = null
  /** 主进程注册的日志出口（转发给界面） */
  onLog: ((event: EngineLogEvent) => void) | null = null

  isBusy(): boolean {
    return this.child !== null || this.installer !== null
  }

  /** 脚本服务是不是本应用拉起来的（用户自己起的服务不归我们管） */
  isSpawnedByUs(): boolean {
    return this.child !== null
  }

  private pushTail(line: string): void {
    this.tail.push(line)
    if (this.tail.length > 40) this.tail.splice(0, this.tail.length - 40)
  }

  private tailSnippet(): string {
    const text = this.tail.slice(-3).join(' | ').trim()
    return text ? `：${text.length > 300 ? `${text.slice(0, 300)}…` : text}` : ''
  }

  private log(stream: EngineLogEvent['stream'], line: string): void {
    this.pushTail(line)
    this.onLog?.({ stream, line })
  }

  /** 清理上次崩溃/被强杀留下的脚本进程 */
  async killStale(): Promise<void> {
    let record: PidRecord | null = null
    try {
      if (existsSync(pidFile())) {
        record = JSON.parse(readFileSync(pidFile(), 'utf-8')) as PidRecord
      }
    } catch {
      record = null
    }
    clearPidFile()
    if (!record?.pid) return

    if (!(await isPythonProcess(record.pid))) {
      console.warn(`[engine] 残留记录里的 pid ${record.pid} 已不是 python 进程，跳过`)
      return
    }
    console.warn(`[engine] 清理上次残留的脚本进程 pid=${record.pid} port=${record.port}`)
    try {
      spawn('taskkill', ['/pid', String(record.pid), '/t', '/f'], { windowsHide: true })
    } catch {
      /* ignore */
    }
  }

  /** 检查脚本目录（结果缓存 5 秒，状态轮询不用每次都扫 git） */
  async inspect(force = false): Promise<ScriptInfo> {
    const dir = getConfig().scriptDir.trim()
    if (!force && this.cached && this.cached.dir === dir && Date.now() - this.cached.at < 5000) {
      return this.cached.info
    }

    const info: ScriptInfo = {
      dir,
      valid: false,
      missing: [],
      python: null,
      git: null,
      branch: null,
      commit: null,
      dirty: false,
      hasGit: false
    }

    if (!dir || !existsSync(dir)) {
      this.cached = { dir, at: Date.now(), info }
      return info
    }

    const python = join(dir, 'toolkit', 'python.exe')
    if (existsSync(python)) info.python = python
    else info.missing.push('toolkit/python.exe')

    const gitCandidates = [
      join(dir, 'toolkit', 'Git', 'mingw64', 'bin', 'git.exe'),
      join(dir, 'toolkit', 'Git', 'cmd', 'git.exe')
    ]
    info.git = gitCandidates.find((path) => existsSync(path)) ?? null
    if (!info.git) info.missing.push('toolkit/Git（git.exe）')

    if (!existsSync(join(dir, 'deploy', 'installer.py'))) {
      info.missing.push('deploy/installer.py')
    }

    info.valid = info.missing.length === 0
    info.hasGit = existsSync(join(dir, '.git'))

    if (info.valid && info.git && info.hasGit) {
      const [branch, commit, status] = await Promise.all([
        execText(info.git, ['rev-parse', '--abbrev-ref', 'HEAD'], dir),
        execText(info.git, ['rev-parse', '--short', 'HEAD'], dir),
        execText(info.git, ['status', '--porcelain'], dir)
      ])
      info.branch = branch.ok ? branch.out.trim() || null : null
      info.commit = commit.ok ? commit.out.trim() || null : null
      info.dirty =
        status.ok &&
        status.out
          .split(/\r?\n/)
          .some((line) => line.trim().length > 0 && !isBootstrapUntracked(line))
    }

    this.cached = { dir, at: Date.now(), info }
    return info
  }

  /** 读 config/deploy.yaml；文件不存在时载入 deploy/template 作为默认内容 */
  async readDeploy(): Promise<DeployFile> {
    const dir = getConfig().scriptDir.trim()
    if (!dir) return { ok: false, content: '', message: '还没选择脚本目录' }

    const file = join(dir, 'config', 'deploy.yaml')
    if (!existsSync(file)) {
      const template = join(dir, 'deploy', 'template')
      if (existsSync(template)) {
        try {
          return {
            ok: true,
            content: readFileSync(template, 'utf-8'),
            message: 'config/deploy.yaml 还不存在，已载入 deploy/template，保存后生成'
          }
        } catch (e) {
          return { ok: false, content: '', message: String(e) }
        }
      }
      return { ok: false, content: '', message: '找不到 config/deploy.yaml，也找不到 deploy/template' }
    }

    try {
      return { ok: true, content: readFileSync(file, 'utf-8'), message: '' }
    } catch (e) {
      return { ok: false, content: '', message: String(e) }
    }
  }

  async saveDeploy(content: string): Promise<ActionResult> {
    const dir = getConfig().scriptDir.trim()
    if (!dir) return { ok: false, message: '还没选择脚本目录' }
    const file = join(dir, 'config', 'deploy.yaml')
    try {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, content, 'utf-8')
      return { ok: true, message: '已保存 config/deploy.yaml' }
    } catch (e) {
      return { ok: false, message: `保存失败：${e instanceof Error ? e.message : String(e)}` }
    }
  }

  async status(force = false): Promise<EngineStatus> {
    const info = await this.inspect(force)
    const busy = this.installer !== null
    const running = this.child !== null

    let message = '未选择脚本目录'
    if (info.dir) {
      if (!info.valid) message = `脚本目录不可用：缺少 ${info.missing.join('、')}`
      else if (busy) message = '正在执行 deploy.installer…'
      else if (running) message = '运行中'
      else message = '已停止'
    }

    // 旧版发布包引擎：engine/state.json 或 engine/code 还在，但已经不再支持
    const legacyPack =
      !info.valid &&
      (existsSync(join(paths.root, 'engine', 'state.json')) ||
        existsSync(join(paths.root, 'engine', 'code')))

    return {
      scriptDir: info.dir,
      valid: info.valid,
      missing: info.missing,
      running,
      busy,
      port: this.port,
      pid: this.child?.pid ?? null,
      branch: info.branch,
      commit: info.commit,
      dirty: info.dirty,
      legacyPack,
      insideInstallDir: Boolean(info.dir) && isInsideDir(info.dir, uiInstallDir()),
      message
    }
  }

  async start(opts: { update?: boolean; allowDirty?: boolean } = {}): Promise<{
    ok: boolean
    message: string
    port?: number
  }> {
    if (this.child || this.installer) {
      return { ok: false, message: '脚本服务正在运行或更新中' }
    }

    const info = await this.inspect(true)
    if (!info.dir) return { ok: false, message: '还没选择脚本目录' }
    if (!info.valid || !info.python) {
      return { ok: false, message: `脚本目录不可用：缺少 ${info.missing.join('、')}` }
    }

    // 兜底：即使界面没弹确认，也不允许带未提交改动执行 reset --hard
    if (opts.update && info.dirty && !opts.allowDirty) {
      return { ok: false, message: '脚本目录有未提交改动，已取消更新启动' }
    }

    this.stopping = false
    let warning = ''

    if (opts.update) {
      const code = await this.runInstaller(info)
      if (this.stopping) return { ok: false, message: '已停止' }
      if (code !== 0) warning = `脚本更新失败（exit ${code}），已用现有代码启动${this.tailSnippet()}`
      // 首次安装会 git init，清掉安装前的目录缓存，状态页才能显示分支/提交
      this.cached = null
    }

    const result = await this.startServer(info)
    if (!warning) return result
    return { ...result, message: `${result.message}；${warning}` }
  }

  /** 执行 deploy.installer：git pull + pip + adb，输出实时转给界面 */
  private runInstaller(info: ScriptInfo): Promise<number> {
    this.tail = []
    this.log('installer', `> cd ${info.dir}`)
    this.log('installer', '> toolkit\\python.exe -m deploy.installer')

    return new Promise((resolve) => {
      const gitPath = gitExecPath(info.dir)
      const child = spawn(info.python!, ['-m', 'deploy.installer'], {
        cwd: info.dir,
        env: {
          ...process.env,
          ...(gitPath ? { GIT_EXEC_PATH: gitPath } : {}),
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      this.installer = child

      const feed = lineSplitter((line) => this.log('installer', line))
      child.stdout?.on('data', feed)
      child.stderr?.on('data', feed)

      child.on('exit', (code) => {
        if (this.installer === child) this.installer = null
        this.log('installer', `> deploy.installer 退出，code=${code ?? -1}`)
        resolve(code ?? -1)
      })
      child.on('error', (e) => {
        if (this.installer === child) this.installer = null
        this.log('installer', `> deploy.installer 启动失败：${e.message}`)
        resolve(-1)
      })
    })
  }

  private async startServer(info: ScriptInfo): Promise<{
    ok: boolean
    message: string
    port?: number
  }> {
    const python = info.python!
    ensureSysPath(python, info.dir)

    let port = readDeployPort(info.dir) ?? 22267
    this.port = port
    this.tail = []

    const gitPath = gitExecPath(info.dir)
    const child = spawn(python, ['server.py'], {
      cwd: info.dir,
      env: {
        ...process.env,
        ...(gitPath ? { GIT_EXEC_PATH: gitPath } : {}),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let exited = false
    const feed = lineSplitter((line) => {
      this.log('server', line)
      const match = /\[Port\]\s+(\d+)/.exec(line)
      if (match) {
        port = Number(match[1])
        this.port = port
      }
    })
    child.stdout?.on('data', feed)
    child.stderr?.on('data', feed)
    child.on('exit', (code) => {
      console.log(`[engine] 退出，code=${code}`)
      exited = true
      if (this.child === child) {
        this.child = null
        this.port = null
      }
    })
    child.on('error', (e) => {
      exited = true
      this.log('server', `> server.py 启动失败：${e.message}`)
      if (this.child === child) {
        this.child = null
        this.port = null
      }
    })

    this.child = child
    writePidFile({
      pid: child.pid ?? 0,
      port,
      scriptDir: info.dir,
      startedAt: new Date().toISOString()
    })

    const alive = await waitHealthy(port, 90_000, () => exited, () => this.port ?? port)
    if (!alive) {
      this.stop()
      const reason = exited
        ? `脚本服务启动失败（端口 ${port} 可能被占用，检查 config/deploy.yaml 的 WebuiPort）`
        : '脚本服务启动超时（90 秒内 /test 未就绪）'
      return { ok: false, message: `${reason}${this.tailSnippet()}` }
    }

    writePidFile({
      pid: child.pid ?? 0,
      port: this.port,
      scriptDir: info.dir,
      startedAt: new Date().toISOString()
    })
    return { ok: true, message: `脚本服务已启动 · 端口 ${this.port}`, port: this.port ?? undefined }
  }

  stop(): void {
    this.stopping = true
    const pids = [this.child?.pid, this.installer?.pid].filter(
      (pid): pid is number => typeof pid === 'number'
    )
    this.child = null
    this.installer = null
    this.port = null
    clearPidFile()
    for (const pid of pids) {
      try {
        // Windows 上必须杀进程树：python 会再拉 OCR 服务等子进程
        spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true })
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * 等 /test 就绪。
 * isDead 用来提前发现子进程已经退出（端口被占用等），不必等满超时。
 * currentPort 让日志里解析出的真实端口能即时生效。
 */
async function waitHealthy(
  port: number,
  timeoutMs: number,
  isDead: () => boolean,
  currentPort: () => number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await ping(currentPort())) return true
    if (isDead()) return false
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

/**
 * 探活必须走 Node 的 http，不能用全局 fetch / net.fetch：
 * 后两者用 Chromium 网络栈，会跟随系统代理，用户开着 Clash 时
 * 对 127.0.0.1 的请求会被代理拦掉，导致脚本明明起来了却判超时。
 */
function ping(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpGet(
      { host: '127.0.0.1', port, path: '/test', timeout: 2000 },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      }
    )
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

export const engine = new EngineManager()

// app 退出时确保子进程一起收掉（before-quit 里也会再调一次）
app.on('will-quit', () => engine.stop())
