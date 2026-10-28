import { computed, ref, watch } from 'vue'
import { useEngine } from './useEngine'

/**
 * 会话：脚本服务地址
 *
 * 默认连本地引擎（端口由主进程动态分配），也可以在登录页手动填别的地址
 * （比如手动起的服务，或局域网里的另一台机器）。
 */
const STORAGE_KEY = 'mzxy.address'

const address = ref(localStorage.getItem(STORAGE_KEY) ?? '')
const loggedIn = ref(false)

/** 去掉协议前缀和多余空格 */
export function normalizeAddress(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
}

/** 是不是本机地址（本机地址要跟着动态端口走） */
function isLocal(addr: string): boolean {
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(addr)
}

async function ping(addr: string): Promise<boolean> {
  try {
    const res = await fetch(`http://${addr}/test`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false
    const text = await res.text()
    return text.includes('success')
  } catch {
    return false
  }
}

export function useSession() {
  const { status } = useEngine()

  const localAddress = computed(() => {
    const port = status.value?.port
    return port ? `127.0.0.1:${port}` : ''
  })

  /**
   * 本机地址跟随引擎端口变化：
   *   - 引擎起来 -> 自动填当前端口（引擎重启会换端口）
   *   - 本应用拉起的引擎停了 -> 清掉过期的本机地址，避免用户拿着旧端口点连接
   *
   * 只有「刚才是我们拉起的引擎、现在停了」才清。手动起的服务、局域网里的
   * 另一台机器都不归主进程管，status.port 一直是空的，不能把地址一起清掉。
   */
  let lastLocal = ''

  watch(
    localAddress,
    (next) => {
      if (next) {
        if (!address.value || isLocal(address.value)) address.value = next
        lastLocal = next
        return
      }
      if (lastLocal && address.value === lastLocal) address.value = ''
      lastLocal = ''
    },
    { immediate: true }
  )

  async function login(target: string): Promise<{ ok: boolean; message: string }> {
    const addr = normalizeAddress(target)
    if (!addr) return { ok: false, message: '请输入地址，例如 127.0.0.1:22267' }
    if (!(await ping(addr))) {
      const hint = isLocal(addr) ? '（本机引擎可能没启动，先点下面的「启动引擎」）' : ''
      return { ok: false, message: `连不上 ${addr}${hint}` }
    }
    address.value = addr
    localStorage.setItem(STORAGE_KEY, addr)
    loggedIn.value = true
    return { ok: true, message: '连接成功' }
  }

  /**
   * 启动时用已保存的地址自动重连。
   * 本地引擎刚起来时端口可能还没分配，这里重试几次（最多约 6 秒）。
   */
  async function tryAutoLogin(retry = 4): Promise<boolean> {
    if (!address.value) return false
    for (let i = 0; i < retry; i++) {
      const target = address.value
      if (target && (await ping(target))) {
        loggedIn.value = true
        return true
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    return false
  }

  function logout(): void {
    loggedIn.value = false
  }

  return { address, loggedIn, localAddress, login, tryAutoLogin, logout }
}
