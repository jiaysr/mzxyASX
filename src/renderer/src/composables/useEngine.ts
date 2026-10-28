import { computed, reactive, ref } from 'vue'
import { api } from '../api'
import type { EngineLogEvent, EngineStatus } from '../../../shared/types'

/**
 * 脚本目录与进程状态。
 *
 * 模块级单例：所有视图共享同一份状态，切页面不会重复轮询。
 * 控制台不再下载/安装引擎，状态只反映「用户选的目录能不能用、进程在不在」。
 */
const status = ref<EngineStatus | null>(null)
const rootDir = ref('')
const logs = ref<EngineLogEvent[]>([])
const working = ref(false)
const lastError = ref('')

/** 启动页里的 deploy.yaml 编辑器状态 */
const deploy = reactive({
  content: '',
  message: '',
  loading: false,
  saving: false
})

const LOG_LIMIT = 400
let started = false

async function refresh(force = false): Promise<void> {
  try {
    status.value = await api.engine.status(force)
  } catch {
    /* 主进程刚启动时可能还拿不到，界面用空态兜底 */
  }
}

async function refreshPaths(): Promise<void> {
  try {
    const p = await api.paths.get()
    rootDir.value = p.rootDir
  } catch {
    /* ignore */
  }
}

/** 日志合并写入：server.py 可能连续刷屏，逐条触发响应式更新会卡界面 */
let pendingLogs: EngineLogEvent[] = []
let flushTimer = 0

function flushLogs(): void {
  flushTimer = 0
  if (!pendingLogs.length) return
  logs.value.push(...pendingLogs)
  pendingLogs = []
  if (logs.value.length > LOG_LIMIT) logs.value.splice(0, logs.value.length - LOG_LIMIT)
}

function handleLog(event: EngineLogEvent): void {
  pendingLogs.push(event)
  if (pendingLogs.length > LOG_LIMIT * 2) pendingLogs.splice(0, pendingLogs.length - LOG_LIMIT)
  if (!flushTimer) flushTimer = window.setTimeout(flushLogs, 100)
}

export function useEngine() {
  if (!started) {
    started = true
    void refresh()
    void refreshPaths()
    window.setInterval(() => {
      void refresh()
    }, 3000)
    api.engine.onLog(handleLog)
  }

  const scriptDir = computed(() => status.value?.scriptDir ?? '')
  const running = computed(() => status.value?.running ?? false)
  const busy = computed(() => status.value?.busy ?? false)
  const valid = computed(() => status.value?.valid ?? false)
  const logTail = computed(() => logs.value.at(-1)?.line ?? '')
  const logText = computed(() => logs.value.map((item) => item.line).join('\n'))
  const logLines = computed(() => logs.value.map((item) => item.line))

  function clearLogs(): void {
    pendingLogs = []
    logs.value.splice(0, logs.value.length)
  }

  /** 强制刷新（忽略目录缓存）：启动前判断有没有未提交改动 */
  async function inspect(): Promise<void> {
    await refresh(true)
  }

  async function start(update?: boolean, allowDirty = false): Promise<string> {
    working.value = true
    lastError.value = ''
    clearLogs()
    try {
      const r = await api.engine.start({ update, allowDirty })
      if (!r.ok) lastError.value = r.message
      return r.message
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      lastError.value = message
      return message
    } finally {
      working.value = false
      await refresh()
    }
  }

  async function stop(): Promise<string> {
    working.value = true
    try {
      const r = await api.engine.stop()
      return r.message
    } finally {
      working.value = false
      await refresh()
    }
  }

  async function pickDir(): Promise<EngineStatus | null> {
    const r = await api.engine.pickDir()
    status.value = r.status
    await refreshPaths()
    return r.canceled ? null : r.status
  }

  async function openDir(): Promise<string> {
    const r = await api.engine.openDir()
    return r.message
  }

  async function openDeploy(): Promise<string> {
    const r = await api.engine.openDeploy()
    return r.message
  }

  async function readDeploy(): Promise<void> {
    deploy.loading = true
    try {
      const r = await api.engine.readDeploy()
      deploy.content = r.content
      deploy.message = r.message
    } catch (e) {
      deploy.message = e instanceof Error ? e.message : String(e)
    } finally {
      deploy.loading = false
    }
  }

  async function saveDeploy(content: string): Promise<{ ok: boolean; message: string }> {
    deploy.saving = true
    try {
      const r = await api.engine.saveDeploy(content)
      deploy.message = r.message
      return r
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      deploy.message = message
      return { ok: false, message }
    } finally {
      deploy.saving = false
    }
  }

  return {
    status,
    rootDir,
    logs,
    logLines,
    deploy,
    scriptDir,
    running,
    busy,
    valid,
    working,
    lastError,
    logTail,
    logText,
    clearLogs,
    inspect,
    start,
    stop,
    pickDir,
    openDir,
    openDeploy,
    readDeploy,
    saveDeploy,
    refresh,
    refreshPaths
  }
}
