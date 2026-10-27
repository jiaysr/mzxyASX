import { ref } from 'vue'
import { api, type Announcement } from '../api'

/**
 * 公告状态（模块级单例）。
 *
 * 弹窗只挂一次（在 App.vue），设置页只负责调用 open()，
 * 这样自动弹出和手动查看用的是同一份数据和同一个弹窗。
 */
const MUTED_KEY = 'mzxy.announcement.muted'
const SEEN_KEY = 'mzxy.announcement.seen'

const items = ref<Announcement[]>([])
const visible = ref(false)
const loading = ref(false)

let loaded = false

/** 内容指纹：加一条公告或改了正文，指纹就变，用来判断「有没有新公告」 */
function fingerprint(list: Announcement[]): string {
  const raw = list.map((item) => `${item.kind}:${item.id}:${item.content}`).join('\u0000')
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0
  }
  return String(hash)
}

async function load(force = false): Promise<Announcement[]> {
  if (loaded && !force) return items.value
  loading.value = true
  try {
    items.value = await api.announcements.list()
    loaded = true
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
  return items.value
}

/** 手动打开（设置页的入口） */
function open(): void {
  visible.value = true
  void load()
}

function close(): void {
  visible.value = false
}

function isMuted(): boolean {
  return localStorage.getItem(MUTED_KEY) === '1'
}

function setMuted(value: boolean): void {
  if (value) localStorage.setItem(MUTED_KEY, '1')
  else localStorage.removeItem(MUTED_KEY)
}

/**
 * 启动时调用：这批公告还没提醒过、并且用户没勾「不再提示」，就自动弹一次。
 *
 * 同一个指纹只提醒一次——公告内容变了（新增或改写）才会再次弹，
 * 不会每次开应用都糊一脸。
 */
async function maybeAutoShow(): Promise<void> {
  const list = await load()
  if (!list.length) return

  const fp = fingerprint(list)
  if (localStorage.getItem(SEEN_KEY) === fp) return
  localStorage.setItem(SEEN_KEY, fp)

  if (isMuted()) return
  visible.value = true
}

export function useAnnouncement() {
  return { items, visible, loading, open, close, load, isMuted, setMuted, maybeAutoShow }
}
