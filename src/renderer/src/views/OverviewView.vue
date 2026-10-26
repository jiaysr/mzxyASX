<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NCard, NEmpty, NGi, NGrid, NTag, useMessage } from 'naive-ui'
import LogPanel from '../components/LogPanel.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { ScriptState, useScript } from '../composables/useScript'
import { tr } from '../i18n'

const message = useMessage()
const { currentConfig, switchMenu } = useConfig()
const { status } = useEngine()
const { state, schedule, logs, connected, start, stop, clearLogs } = useScript()

const engineReady = computed(() => Boolean(status.value?.running))

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

function onStart(): void {
  start()
  message.success('已发送启动指令')
}

function onStop(): void {
  stop()
  message.info('已发送停止指令')
}

function gotoTask(name: string): void {
  switchMenu(name)
}
</script>

<template>
  <n-empty v-if="!engineReady" description="引擎还没启动" size="large" class="empty">
    <template #extra>
      <span class="hint">先到「引擎」页点启动</span>
    </template>
  </n-empty>

  <div v-else class="overview">
    <n-card size="small" :bordered="true" class="scheduler">
      <div class="sched-head">
        <div class="left">
          <span class="label">{{ tr('scheduler') }}</span>
          <n-tag :type="stateType" size="small" round :bordered="false">{{ stateText }}</n-tag>
          <n-tag v-if="runningTask" size="small" :bordered="false" type="info">
            {{ tr(runningTask) }}
          </n-tag>
          <span class="conn" :class="{ on: connected }">
            {{ connected ? '已连接' : '未连接' }}
          </span>
        </div>
        <div class="right">
          <n-button size="small" type="primary" @click="onStart">启动脚本</n-button>
          <n-button size="small" class="ml" @click="onStop">停止脚本</n-button>
        </div>
      </div>

      <n-grid :cols="3" :x-gap="14">
        <n-gi>
          <div class="queue-title">{{ tr('running') }}</div>
          <div class="queue">
            <div v-if="runningTask" class="queue-item">
              <span class="name">{{ tr(runningTask) }}</span>
              <n-button size="tiny" quaternary @click="gotoTask(runningTask)">
                {{ tr('task_setting') }}
              </n-button>
            </div>
            <div v-else class="queue-empty">—</div>
          </div>
        </n-gi>
        <n-gi>
          <div class="queue-title">{{ tr('pending') }} ({{ schedule.pending.length }})</div>
          <div class="queue">
            <div v-for="item in schedule.pending" :key="item.name" class="queue-item">
              <span class="name">{{ tr(item.name) }}</span>
              <span class="time">{{ item.next_run.slice(5, 16) }}</span>
            </div>
            <div v-if="!schedule.pending.length" class="queue-empty">—</div>
          </div>
        </n-gi>
        <n-gi>
          <div class="queue-title">{{ tr('waiting') }} ({{ schedule.waiting.length }})</div>
          <div class="queue">
            <div v-for="item in schedule.waiting" :key="item.name" class="queue-item">
              <span class="name">{{ tr(item.name) }}</span>
              <span class="time">{{ item.next_run.slice(5, 16) }}</span>
            </div>
            <div v-if="!schedule.waiting.length" class="queue-empty">—</div>
          </div>
        </n-gi>
      </n-grid>

      <div class="cfg-line">配置：{{ currentConfig }}</div>
    </n-card>

    <log-panel :lines="logs" :title="tr('log')" height="100%" @clear="clearLogs" />
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

.right {
  display: flex;
  align-items: center;
}

.ml {
  margin-left: 8px;
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

.queue-title {
  font-size: 12px;
  opacity: 0.55;
  margin-bottom: 6px;
}

.queue {
  max-height: 120px;
  overflow: auto;
}

.queue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  padding: 2px 0;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  opacity: 0.45;
  font-variant-numeric: tabular-nums;
  margin-left: 8px;
  flex: 0 0 auto;
}

.queue-empty {
  font-size: 12px;
  opacity: 0.3;
}

.cfg-line {
  margin-top: 10px;
  font-size: 11.5px;
  opacity: 0.4;
}

.empty {
  margin-top: 60px;
}

.hint {
  font-size: 12px;
  opacity: 0.6;
}
</style>
