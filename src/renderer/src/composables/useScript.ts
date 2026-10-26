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

function pushLog(store: ScriptStore, line: string): void {
  store.logs.push(line)
  if (store.logs.length > LOG_LIMIT) store.logs.splice(0, store.logs.length - LOG_LIMIT)
}

function handleMessage(name: string, raw: unknown): void {
  if (typeof raw !== 'string') return
  const store = getStore(name)
  if (!raw.startsWith('{')) {
    pushLog(store, raw)
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
    pushLog(store, raw)
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

export function start(name: string): void {
  send(name, 'start')
  send(name, 'get_state')
}

export function stop(name: string): void {
  send(name, 'stop')
}

export function clearLogs(name: string): void {
  const store = stores[name]
  if (store) store.logs.splice(0, store.logs.length)
}

export function useScript() {
  return { stores, getStore, connect, connectAll, close, start, stop, clearLogs }
}
