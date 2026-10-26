<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NEmpty,
  NGi,
  NGrid,
  NSpace,
  NTag,
  useMessage
} from 'naive-ui'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { ScriptState, useScript } from '../composables/useScript'
import { tr } from '../i18n'

const message = useMessage()
const { currentConfig, ready, init } = useConfig()
const { status } = useEngine()
const { state, schedule, logs, connected, switchTo, start, stop, clearLogs } = useScript()

const engineReady = computed(() => Boolean(status.value?.running))
const logBox = ref<HTMLElement | null>(null)

const stateText = computed(() => {
  switch (state.value) {
    case ScriptState.RUNNING:
      return '运行中'
    case ScriptState.WARNING:
      return '异常'
    case ScriptState.UPDATING:
      return '更新中'
    default:
      return '未运行'
  }
})

const stateType = computed<'default' | 'success' | 'warning' | 'info'>(() => {
  switch (state.value) {
    case ScriptState.RUNNING:
      return 'success'
    case ScriptState.WARNING:
      return 'warning'
    case ScriptState.UPDATING:
      return 'info'
    default:
      return 'default'
  }
})

const runningTask = computed(() => schedule.value.running?.name ?? '')

watch(
  [() => currentConfig.value, engineReady],
  async ([name, ok]) => {
    if (!ok) return
    if (!ready.value) {
      try {
        await init()
      } catch {
        /* 引擎刚起，稍后重试即可 */
      }
    }
    if (name) switchTo(name)
  },
  { immediate: true }
)

// 新日志进来时滚到底部
watch(
  () => logs.value.length,
  async () => {
    await nextTick()
    const el = logBox.value
    if (el) el.scrollTop = el.scrollHeight
  }
)

function onStart(): void {
  start()
  message.success('已发送启动指令')
}

function onStop(): void {
  stop()
  message.info('已发送停止指令')
}
</script>

<template>
  <div class="overview">
    <n-empty v-if="!engineReady" description="引擎还没启动" size="large">
      <template #extra>
        <span class="hint">先到「引擎」页点启动</span>
      </template>
    </n-empty>

    <template v-else>
      <n-card size="small" :bordered="true" class="scheduler">
        <div class="sched-head">
          <div class="left">
            <span class="label">调度器</span>
            <n-tag :type="stateType" size="small" round :bordered="false">{{ stateText }}</n-tag>
            <n-tag v-if="runningTask" size="small" :bordered="false" type="info">
              当前任务 {{ tr(runningTask) }}
            </n-tag>
            <span class="conn" :class="{ on: connected }">
              {{ connected ? '已连接' : '未连接' }}
            </span>
          </div>
          <n-space>
            <n-button size="small" type="primary" @click="onStart">启动脚本</n-button>
            <n-button size="small" @click="onStop">停止脚本</n-button>
          </n-space>
        </div>

        <n-grid :cols="3" :x-gap="12" class="queues">
          <n-gi>
            <div class="queue-title">队列中 ({{ schedule.pending.length }})</div>
            <div class="queue">
              <div v-for="item in schedule.pending" :key="item.name" class="queue-item">
                <span class="name">{{ tr(item.name) }}</span>
                <span class="time">{{ item.next_run.slice(5, 16) }}</span>
              </div>
              <div v-if="!schedule.pending.length" class="queue-empty">—</div>
            </div>
          </n-gi>
          <n-gi>
            <div class="queue-title">等待中 ({{ schedule.waiting.length }})</div>
            <div class="queue">
              <div v-for="item in schedule.waiting" :key="item.name" class="queue-item">
                <span class="name">{{ tr(item.name) }}</span>
                <span class="time">{{ item.next_run.slice(5, 16) }}</span>
              </div>
              <div v-if="!schedule.waiting.length" class="queue-empty">—</div>
            </div>
          </n-gi>
          <n-gi>
            <div class="queue-title">配置</div>
            <div class="queue">
              <div class="queue-item">
                <span class="name">{{ currentConfig || '—' }}</span>
              </div>
            </div>
          </n-gi>
        </n-grid>
      </n-card>

      <n-card size="small" :bordered="true" class="log-card">
        <template #header>日志</template>
        <template #header-extra>
          <n-button size="tiny" quaternary @click="clearLogs">清空</n-button>
        </template>
        <div ref="logBox" class="log">
          <div v-for="(line, i) in logs" :key="i" class="log-line">{{ line }}</div>
          <div v-if="!logs.length" class="log-empty">暂无日志，启动脚本后这里会实时刷新</div>
        </div>
      </n-card>
    </template>
  </div>
</template>

<style scoped>
.overview {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.scheduler {
  flex: 0 0 auto;
}

.sched-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 13px;
  font-weight: 600;
}

.conn {
  font-size: 11px;
  opacity: 0.45;
}

.conn.on {
  color: #18a058;
  opacity: 0.9;
}

.queues {
  margin-top: 2px;
}

.queue-title {
  font-size: 12px;
  opacity: 0.55;
  margin-bottom: 6px;
}

.queue {
  max-height: 132px;
  overflow: auto;
}

.queue-item {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  padding: 3px 0;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  opacity: 0.45;
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;
  margin-left: 8px;
}

.queue-empty {
  font-size: 12px;
  opacity: 0.3;
}

.log-card {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.log-card :deep(.n-card__content) {
  flex: 1;
  min-height: 0;
  display: flex;
  padding-top: 8px;
}

.log {
  flex: 1;
  overflow: auto;
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
}

.log-line {
  opacity: 0.8;
}

.log-empty {
  opacity: 0.35;
  font-family: inherit;
}

.hint {
  font-size: 12px;
  opacity: 0.6;
}
</style>
