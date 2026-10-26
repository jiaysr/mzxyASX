<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { NButton, NSwitch, useMessage } from 'naive-ui'
import { tr } from '../i18n'

const props = withDefaults(
  defineProps<{ lines: string[]; title?: string; height?: string }>(),
  { title: '', height: '100%' }
)
const emit = defineEmits<{ clear: [] }>()

const message = useMessage()
const box = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const collapsed = ref(false)

type Level = 'error' | 'warn' | 'info'
const LEVEL_RE = /\b(CRITICAL|ERROR|WARNING|WARN|INFO|DEBUG)\b/

/** 按等级着色，和原版日志面板一致 */
const rows = computed<{ text: string; level: Level }[]>(() =>
  props.lines.map((text) => {
    const m = LEVEL_RE.exec(text)
    const tag = m?.[1] ?? ''
    const level: Level =
      tag === 'ERROR' || tag === 'CRITICAL' ? 'error' : tag === 'WARNING' || tag === 'WARN' ? 'warn' : 'info'
    return { text, level }
  })
)

watch(
  () => props.lines.length,
  async () => {
    if (!autoScroll.value) return
    await nextTick()
    const el = box.value
    if (el) el.scrollTop = el.scrollHeight
  }
)

async function copyAll(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.lines.join('\n'))
    message.success(tr('copy_success') === 'copy_success' ? '已复制' : tr('copy_success'))
  } catch {
    message.error('复制失败')
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
          <n-switch v-model:value="autoScroll" size="small" />
          <span>{{ tr('auto_scroll') }}</span>
        </label>
        <n-button size="tiny" quaternary @click="collapsed = !collapsed">
          {{ collapsed ? '展开' : tr('collapse') }}
        </n-button>
        <n-button size="tiny" quaternary @click="copyAll">{{ tr('copy_log') }}</n-button>
        <n-button size="tiny" quaternary @click="emit('clear')">{{ tr('clear_log') }}</n-button>
      </div>
    </div>

    <div v-show="!collapsed" ref="box" class="body">
      <div v-for="(row, i) in rows" :key="i" class="line" :class="row.level">{{ row.text }}</div>
      <div v-if="!rows.length" class="empty">暂无日志</div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--n-border-color, #ebedf0);
  border-radius: 8px;
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--n-border-color, #ebedf0);
  flex: 0 0 auto;
}

.title {
  font-size: 12.5px;
  font-weight: 600;
}

.count {
  font-size: 11px;
  opacity: 0.4;
}

.tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.auto {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  opacity: 0.7;
  cursor: pointer;
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 10px;
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
}

.line {
  opacity: 0.82;
}

.line.warn {
  color: #d99100;
}

.line.error {
  color: #d03050;
}

.empty {
  opacity: 0.35;
}
</style>
