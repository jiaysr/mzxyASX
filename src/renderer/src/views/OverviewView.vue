<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NDivider, NEmpty, NIcon, useMessage } from 'naive-ui'
import AppIcon from '../components/AppIcon.vue'
import LogPanel from '../components/LogPanel.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { ScriptState, getStore, useScript, type ScheduleItem } from '../composables/useScript'
import { tr } from '../i18n'

const message = useMessage()
const { currentConfig, switchMenu } = useConfig()
const { status } = useEngine()
const { start, stop, clearLogs } = useScript()

/** 每个配置有自己的连接与日志（多配置并行） */
const store = computed(() => getStore(currentConfig.value))
const state = computed(() => store.value.state)
const schedule = computed(() => store.value.schedule)
const logs = computed(() => store.value.logs)
const connected = computed(() => store.value.connected)

const engineReady = computed(() => Boolean(status.value?.running || connected.value))
const running = computed(() => state.value === ScriptState.RUNNING)

/** 运行中的任务：后端给的是 {} 或 {name, next_run} */
const runningItem = computed<ScheduleItem | null>(() =>
  schedule.value.running?.name ? (schedule.value.running as ScheduleItem) : null
)

/** 电源键：未运行就启动并清空日志，运行中则停止（与原版一致） */
function toggleScript(): void {
  const name = currentConfig.value
  if (running.value) {
    stop(name)
    message.info('已发送停止指令')
  } else {
    clearLogs(name)
    start(name)
    message.success('已发送启动指令')
  }
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
    <div class="left">
      <!-- 调度器 -->
      <div class="card sched">
        <span class="sched-title">{{ tr('scheduler') }}</span>
        <div class="sched-right">
          <!-- 状态指示对齐原版（SpinKitChasingDots / DoubleBounce）：
               运行中绿点跳动、异常橙点跳动、更新中蓝点呼吸、未运行灰点静止。
               不用 NSpin —— 它是环形转圈，异常时看着像「还在跑」，
               而且颜色走 --n-color 变量，class 里的 color 盖不住（会显示成主题蓝）。 -->
          <span v-if="state === ScriptState.RUNNING" class="dot dot-running" />
          <span v-else-if="state === ScriptState.WARNING" class="dot dot-warning" />
          <span v-else-if="state === ScriptState.UPDATING" class="dot dot-updating" />
          <span v-else class="dot dot-idle" />

          <n-button
            quaternary
            circle
            size="small"
            :type="running ? 'primary' : 'default'"
            @click="toggleScript"
          >
            <template #icon>
              <n-icon><app-icon name="power" /></n-icon>
            </template>
          </n-button>
        </div>
      </div>

      <!-- 运行中 -->
      <div class="card">
        <div class="card-title">{{ tr('running') }}</div>
        <n-divider class="divider" />
        <div v-if="runningItem" class="task-item">
          <div class="task-info">
            <div class="task-name">{{ tr(runningItem.name) }}</div>
            <div class="task-time">{{ runningItem.next_run }}</div>
          </div>
          <n-button size="tiny" @click="gotoTask(runningItem.name)">
            {{ tr('task_setting') }}
          </n-button>
        </div>
        <div v-else class="task-empty" />
      </div>

      <!-- 队列中 -->
      <div class="card">
        <div class="card-title">{{ tr('pending') }}</div>
        <n-divider class="divider" />
        <div class="list pending">
          <div v-for="item in schedule.pending" :key="item.name" class="task-item">
            <div class="task-info">
              <div class="task-name">{{ tr(item.name) }}</div>
              <div class="task-time">{{ item.next_run }}</div>
            </div>
            <n-button size="tiny" @click="gotoTask(item.name)">
              {{ tr('task_setting') }}
            </n-button>
          </div>
        </div>
      </div>

      <!-- 等待中 -->
      <div class="card grow">
        <div class="card-title">
          {{ tr('waiting') }}
          <span class="conn" :class="{ on: connected }">{{ connected ? '已连接' : '未连接' }}</span>
        </div>
        <n-divider class="divider" />
        <div class="list waiting">
          <div v-for="item in schedule.waiting" :key="item.name" class="task-item">
            <div class="task-info">
              <div class="task-name">{{ tr(item.name) }}</div>
              <div class="task-time">{{ item.next_run }}</div>
            </div>
            <n-button size="tiny" @click="gotoTask(item.name)">
              {{ tr('task_setting') }}
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <div class="right">
      <log-panel
        :lines="logs"
        :title="tr('log')"
        height="100%"
        :collapsible="false"
        @clear="clearLogs(currentConfig)"
      />
    </div>
  </div>
</template>

<style scoped>
.overview {
  height: 100%;
  display: flex;
  gap: 10px;
  min-height: 0;
}

.left {
  width: 300px;
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.right {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.card {
  border: 1px solid var(--n-border-color, #ebedf0);
  border-radius: 8px;
  padding: 8px 10px;
  flex: 0 0 auto;
}

.card.grow {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sched {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 12px;
}

.sched-title {
  font-size: 13px;
  font-weight: 600;
}

.sched-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  margin: 6px 0 4px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
}

.task-info {
  min-width: 0;
}

.task-name {
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-time {
  font-size: 11px;
  opacity: 0.45;
  font-variant-numeric: tabular-nums;
}

.task-empty {
  height: 30px;
}

.list {
  overflow-y: auto;
}

.pending {
  height: 116px;
}

.waiting {
  flex: 1;
  min-height: 0;
}

.conn {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 400;
  opacity: 0.4;
}

.conn.on {
  color: #18a058;
  opacity: 0.85;
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex: none;
}

/* 运行中：绿色跳动（对应原版 SpinKitChasingDots） */
.dot-running {
  background: #18a058;
  animation: dot-bounce 1.1s ease-in-out infinite;
}

/* 异常：橙色跳动（对应原版 SpinKitDoubleBounce） */
.dot-warning {
  background: #f0a020;
  animation: dot-bounce 1.4s ease-in-out infinite;
}

/* 更新中：蓝色呼吸 */
.dot-updating {
  background: #2b6cf6;
  animation: dot-breath 1.6s ease-in-out infinite;
}

/* 未运行：灰色静止（对应原版灰色圆环） */
.dot-idle {
  background: #c9ced6;
}

@keyframes dot-bounce {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.6);
    opacity: 0.5;
  }
}

@keyframes dot-breath {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.empty {
  margin-top: 60px;
}

.hint {
  font-size: 12px;
  opacity: 0.6;
}

/* 窄窗口时上下堆叠，和原版竖屏一致 */
@media (max-width: 900px) {
  .overview {
    flex-direction: column;
    overflow-y: auto;
  }

  .left {
    width: auto;
    flex: 0 0 auto;
  }

  .right {
    height: 420px;
    flex: 0 0 420px;
  }

  .pending {
    height: 200px;
  }

  .waiting {
    height: 200px;
    flex: 0 0 200px;
  }
}
</style>
