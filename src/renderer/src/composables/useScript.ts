import { reactive } from 'vue'
import { useSession } from './useSession'

/** 调度器数据：{ running: {name,next_run}, pending: [...], waiting: [...] } */
export interface ScheduleItem {
  name: string
  next_run: string
}

export interface Schedule {
  running: Partial<ScheduleItem>
  pending: ScheduleItem[]
  waiting: ScheduleItem[]
}

/** 引擎侧脚本状态，与 ScriptState 枚举一致 */
export const ScriptState = {
  INACTIVE: 0,
  RUNNING: 1,
  WARNING: 2,
  UPDATING: 3
} as const

const LOG_LIMIT = 500

export interface ScriptStore {
  connected: boolean
  state: number
  schedule: Schedule
  logs: string[]
}

/**
 * 每个配置一个独立的 WebSocket 与状态。
 *
 * 原版 ScriptService 启动时会把所有配置都连上，
 * 这样切配置不用重连，日志也不会串。
 */
const stores = reactive<Record<string, ScriptStore>>({})
const sockets = new Map<string, WebSocket>()
const timers = new Map<string, number>()
const manualClose = new Set<string>()

function emptySchedule(): Schedule {
  return { running: {}, pending: [], waiting: [] }
}

/** 取（或创建）某个配置的状态 */
export function getStore(name: string): ScriptStore {
  if (!stores[name]) {
    stores[name] = { connected: false, state: ScriptState.INACTIVE, schedule: emptySchedule(), logs: [] }
  }
  return stores[name]
}

/**
 * 待写入的日志。
 *
 * 引擎刷屏时（coroutine_broadcast_log 是 0.05s 轮询），一条一条 push 会触发
 * 同样多次响应式更新。这里先攒着合并成一批再写。
 *
 * 用 setTimeout 而不是 requestAnimationFrame：窗口被遮挡或最小化时
 * Chromium 会暂停 rAF，日志会一直卡在缓冲区里刷不出来。
 */
const pendingLogs = new Map<string, string[]>()
/** 兜底上限：万一长时间没机会刷新，也别把内存吃光 */
const PENDING_LIMIT = 2000
let flushHandle = 0

function flushLogs(): void {
  flushHandle = 0
  for (const [name, lines] of pendingLogs) {
    const store = getStore(name)
    for (const line of lines) store.logs.push(line)
    const over = store.logs.length - LOG_LIMIT
    if (over > 0) store.logs.splice(0, over)
  }
  pendingLogs.clear()
}

function queueLog(name: string, line: string): void {
  const bucket = pendingLogs.get(name)
  if (bucket) {
    bucket.push(line)
    if (bucket.length > PENDING_LIMIT) bucket.splice(0, bucket.length - PENDING_LIMIT)
  } else {
    pendingLogs.set(name, [line])
  }
  if (!flushHandle) flushHandle = window.setTimeout(flushLogs, 16)
}

function handleMessage(name: string, raw: unknown): void {
  if (typeof raw !== 'string') return
  const store = getStore(name)
  if (!raw.startsWith('{')) {
    queueLog(name, raw)
    return
  }
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (typeof data.state === 'number') {
      store.state = data.state
      return
    }
    if (data.schedule) store.schedule = data.schedule as Schedule
  } catch {
    queueLog(name, raw)
  }
}

function scheduleReconnect(name: string): void {
  if (manualClose.has(name)) return
  if (timers.has(name)) return
  const timer = window.setTimeout(() => {
    timers.delete(name)
    connect(name)
  }, 2000)
  timers.set(name, timer)
}

/** 连接某个配置的 WebSocket（已连则复用） */
export function connect(name: string): void {
  if (!name) return
  const existing = sockets.get(name)
  if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
    return
  }

  const { address } = useSession()
  if (!address.value) {
    scheduleReconnect(name)
    return
  }

  manualClose.delete(name)
  const store = getStore(name)

  let socket: WebSocket
  try {
    socket = new WebSocket(`ws://${address.value}/ws/${name}`)
  } catch {
    scheduleReconnect(name)
    return
  }

  sockets.set(name, socket)
  socket.onopen = () => {
    store.connected = true
  }
  socket.onmessage = (ev) => handleMessage(name, ev.data)
  socket.onclose = () => {
    store.connected = false
    sockets.delete(name)
    scheduleReconnect(name)
  }
  socket.onerror = () => {
    store.connected = false
  }
}

function close(name: string): void {
  manualClose.add(name)
  const timer = timers.get(name)
  if (timer) {
    window.clearTimeout(timer)
    timers.delete(name)
  }
  const socket = sockets.get(name)
  if (socket) {
    socket.onclose = null
    socket.close()
    sockets.delete(name)
  }
  const store = stores[name]
  if (store) store.connected = false
}

/** 一次性连上所有配置（多配置并行） */
export function connectAll(names: string[]): void {
  for (const name of names) connect(name)
}

function send(name: string, text: string): void {
  const socket = sockets.get(name)
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(text)
}

/**
 * 让引擎重算并推一次调度数据。
 *
 * 引擎的 `PUT .../value`（改 enable、next_run 那些）**只写配置，不广播 schedule**，
 * 只有 `sync_next_run` 会推。所以改完参数必须自己发一句 get_schedule，
 * 否则总览页会一直显示改动前的调度。
 */
export function requestSchedule(name: string): void {
  send(name, 'get_schedule')
}

export function start(name: string): void {
  send(name, 'start')
  send(name, 'get_state')
}

export function stop(name: string): void {
  send(name, 'stop')
}

export function clearLogs(name: string): void {
  pendingLogs.delete(name)
  const store = stores[name]
  if (store) store.logs.splice(0, store.logs.length)
}

/** 有没有任何一个配置的脚本正在运行（关窗确认用） */
export function anyScriptRunning(): boolean {
  return Object.values(stores).some((store) => store.state === ScriptState.RUNNING)
}

export function useScript() {
  return {
    stores,
    getStore,
    connect,
    connectAll,
    close,
    start,
    stop,
    clearLogs,
    requestSchedule,
    anyScriptRunning
  }
}
