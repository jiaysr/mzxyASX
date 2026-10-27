<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { VList, type VListHandle } from 'virtua/vue'
import { logViewStates, type LogViewState } from '../composables/logScroll'
import { tr } from '../i18n'

const props = withDefaults(
  defineProps<{
    lines: string[]
    title?: string
    height?: string
    /** 是否显示「折叠」按钮（总览页按原版不显示） */
    collapsible?: boolean
    /** 视图标识（配置名）。同一个面板会被多个配置复用，靠它分别记住滚动位置 */
    viewKey?: string
  }>(),
  { title: '', height: '100%', collapsible: true, viewKey: '' }
)
const emit = defineEmits<{ clear: [] }>()

/** 距底部多少像素算「贴底」 */
const BOTTOM_TOLERANCE = 8

const listRef = ref<VListHandle | null>(null)
const autoScroll = ref(true)
const collapsed = ref(false)

/** 挂载时列表还是空的，等第一批日志到了再恢复位置 */
let pendingRestore = false

// ---------------------------------------------------------------- 着色
interface Seg {
  text: string
  cls: string
}

/**
 * 一条正则搞定所有着色点，顺序即优先级。
 *
 * 和原 Flutter 版 EasyRichText 的规则表一一对应：
 * 级别 / 时间戳 / 括号 / 布尔值 / 分隔线。
 */
const TOKEN_RE =
  /(CRITICAL|WARNING|ERROR|INFO|DEBUG)|\b(\d{2}:\d{2}:\d{2}\.\d{3})\b|([{}[\]()])|\b(True|False|None)\b|(═{2,}|─{2,})/g

const LEVEL_CLASS: Record<string, string> = {
  INFO: 'lv-info',
  DEBUG: 'lv-debug',
  WARNING: 'lv-warn',
  ERROR: 'lv-error',
  CRITICAL: 'lv-error'
}

/** 分词结果按整行缓存，滚动、重排时不用重复跑正则 */
const cache = new Map<string, Seg[]>()

function tokenize(line: string): Seg[] {
  const hit = cache.get(line)
  if (hit) return hit

  const segs: Seg[] = []
  let last = 0
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(line)) !== null) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index), cls: '' })
    const text = m[0]
    let cls = ''
    if (m[1]) cls = LEVEL_CLASS[m[1]] ?? ''
    else if (m[2]) cls = 'lv-time'
    else if (m[3]) cls = 'lv-bracket'
    else if (m[4]) cls = m[4] === 'True' ? 'lv-true' : m[4] === 'False' ? 'lv-false' : 'lv-none'
    else if (m[5]) cls = 'lv-sep'
    segs.push({ text, cls })

    // 级别补到 8 个字符宽，等宽字体下消息列才能对齐
    if (m[1]) {
      const pad = 8 - text.length
      if (pad > 0) segs.push({ text: ' '.repeat(pad), cls: '' })
    }
    last = m.index + text.length
  }
  if (last < line.length) segs.push({ text: line.slice(last), cls: '' })

  const result = segs.length ? segs : [{ text: line, cls: '' }]
  // 日志上限 500 行，缓存涨到一定量就整体丢掉重来
  if (cache.size > 1200) cache.clear()
  cache.set(line, result)
  return result
}

// ---------------------------------------------------------------- 滚动
/** 程序化滚动期间不参与「用户是否上滚」的判断 */
let programmatic = false

function scrollToBottom(): void {
  const list = listRef.value
  if (!list || !props.lines.length) return
  programmatic = true
  list.scrollToIndex(props.lines.length - 1, { align: 'end' })
  requestAnimationFrame(() => {
    programmatic = false
  })
}

function onScroll(offset: number): void {
  const list = listRef.value
  if (!list) return
  if (!programmatic) {
    // 用户往上滚 → 关掉自动滚动；滚回底部 → 重新打开
    autoScroll.value = offset + list.viewportSize >= list.scrollSize - BOTTOM_TOLERANCE
  }
  logViewStates.set(props.viewKey, { offset, auto: autoScroll.value })
}

/**
 * 把某个配置存下来的位置恢复回来。
 *
 * 只有「没存过」或「当时处于贴底」才跳到底部；
 * 滚到最顶部（offset = 0）也是一次有效的滚动位置，必须原样恢复。
 */
function applyViewState(saved: LogViewState | undefined): void {
  const list = listRef.value
  if (!list) return
  autoScroll.value = saved?.auto ?? true
  if (!saved || saved.auto) {
    scrollToBottom()
    return
  }
  programmatic = true
  list.scrollTo(saved.offset)
  // 用定时器而不是 rAF：窗口被遮挡时 rAF 会被暂停，标志位就永远清不掉了
  window.setTimeout(() => {
    programmatic = false
  }, 80)
}

function toggleAutoScroll(value: string | number | boolean): void {
  autoScroll.value = Boolean(value)
  if (autoScroll.value) scrollToBottom()
}

watch(
  () => props.lines.length,
  async (count) => {
    if (!count) return
    await nextTick()
    // 挂载时日志还没到，这时候才有机会把上次的位置还原
    if (pendingRestore) {
      pendingRestore = false
      applyViewState(logViewStates.get(props.viewKey))
      return
    }
    if (autoScroll.value) scrollToBottom()
  }
)

onMounted(() => {
  const saved = logViewStates.get(props.viewKey)
  autoScroll.value = saved?.auto ?? true
  if (!props.lines.length) {
    // 列表还是空的，等 watch 里那批日志到了再恢复
    pendingRestore = Boolean(saved && !saved.auto)
    return
  }
  requestAnimationFrame(() => applyViewState(saved))
})

// ---------------------------------------------------------------- 其它
async function copyAll(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.lines.join('\n'))
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<template>
  <div class="panel" :style="{ height }">
    <div class="head">
      <span class="title">{{ title || tr('log') }}</span>
      <span class="count">{{ lines.length }}</span>
      <div class="tools">
        <label class="auto">
          <el-switch :model-value="autoScroll" size="small" @update:model-value="toggleAutoScroll" />
          <span>{{ tr('auto_scroll') }}</span>
        </label>
        <el-button v-if="collapsible" size="small" text @click="collapsed = !collapsed">
          {{ collapsed ? '展开' : tr('collapse') }}
        </el-button>
        <el-button size="small" text @click="copyAll">{{ tr('copy_log') }}</el-button>
        <el-button size="small" text @click="emit('clear')">{{ tr('clear_log') }}</el-button>
      </div>
    </div>

    <div v-show="!collapsed" class="body">
      <!--
        VList 自己就是滚动容器（overflow-y:auto + height:100%），
        行高由它渲染后实测，所以长日志换行也能正确撑开。
      -->
      <v-list
        v-if="lines.length"
        ref="listRef"
        :data="lines"
        :buffer-size="200"
        class="list selectable"
        @scroll="onScroll"
      >
        <template #default="{ item }">
          <div class="line">
            <span v-for="(seg, i) in tokenize(item)" :key="i" :class="seg.cls">{{ seg.text }}</span>
          </div>
        </template>
      </v-list>
      <div v-else class="empty selectable">暂无日志</div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex: 0 0 auto;
}

.title {
  font-size: 12.5px;
  font-weight: 600;
}

.count {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tools :deep(.el-button) {
  padding: 4px 6px;
  font-size: 12px;
}

.auto {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  margin-right: 4px;
}

/* VList 要父级有确定高度。.body 的高度是 flex 算出来的，
   子元素 height:100% 解析不到它（会退化成内容高度），
   所以这里用绝对定位给 VList 一个确定的包含块。 */
.body {
  flex: 1;
  min-height: 0;
  position: relative;
}

.list {
  position: absolute;
  inset: 0;
  font-family: 'Cascadia Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11.5px;
  color: var(--el-text-color-regular);
}

/* 完整显示：不再用省略号截断，长行换行 */
.line {
  padding: 1px 10px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty {
  color: var(--el-text-color-placeholder);
  padding: 8px 12px;
  font-size: 12px;
}

/* ---------------- 着色：亮色 ---------------- */
.lv-info {
  color: #376d88;
}

.lv-debug {
  color: var(--el-text-color-placeholder);
}

.lv-warn {
  color: var(--el-color-warning);
}

.lv-error {
  color: var(--el-color-danger);
}

.lv-time {
  color: #0d9488;
}

.lv-bracket {
  font-weight: 700;
}

.lv-true {
  color: var(--el-color-success);
}

.lv-false {
  color: var(--el-color-danger);
}

.lv-none {
  color: #7c3aed;
}

.lv-sep {
  color: var(--el-color-success);
}

/* ---------------- 着色：暗色下提亮，别糊成一片 ---------------- */
html.dark .lv-info {
  color: #7fb3cc;
}

html.dark .lv-time {
  color: #2dd4bf;
}

html.dark .lv-none {
  color: #c4b5fd;
}
</style>
