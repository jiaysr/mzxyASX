<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import AppIcon from '../components/AppIcon.vue'
import LogPanel from '../components/LogPanel.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { ScriptState, getStore, useScript, type ScheduleItem } from '../composables/useScript'
import { tr } from '../i18n'

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
    ElMessage.info('已发送停止指令')
  } else {
    clearLogs(name)
    start(name)
    ElMessage.success('已发送启动指令')
  }
}

function gotoTask(name: string): void {
  switchMenu(name)
}
</script>

<template>
  <div v-if="!engineReady" class="overview-empty">
    <el-empty description="引擎还没启动" :image-size="90">
      <template #description>
        <p class="empty-title">引擎还没启动</p>
        <p class="hint">先到「引擎」页点启动</p>
      </template>
    </el-empty>
  </div>

  <div v-else class="overview">
    <div class="left">
      <!-- 调度器 -->
      <div class="card sched">
        <span class="sched-title">{{ tr('scheduler') }}</span>
        <div class="sched-right">
          <!-- 状态指示对齐原版（SpinKitChasingDots / DoubleBounce）：
               运行中绿点跳动、异常橙点跳动、更新中蓝点呼吸、未运行灰点静止。
               不用转圈 —— 环形加载在异常时看着像「还在跑」。 -->
          <span v-if="state === ScriptState.RUNNING" class="dot dot-running" />
          <span v-else-if="state === ScriptState.WARNING" class="dot dot-warning" />
          <span v-else-if="state === ScriptState.UPDATING" class="dot dot-updating" />
          <span v-else class="dot dot-idle" />

          <el-button
            text
            circle
            size="small"
            :type="running ? 'primary' : 'default'"
            @click="toggleScript"
          >
            <app-icon name="power" :size="16" />
          </el-button>
        </div>
      </div>

      <!-- 运行中 -->
      <div class="card">
        <div class="card-title">{{ tr('running') }}</div>
        <el-divider class="divider" />
        <div v-if="runningItem" class="task-item">
          <div class="task-info">
            <div class="task-name">{{ tr(runningItem.name) }}</div>
            <div class="task-time">{{ runningItem.next_run }}</div>
          </div>
          <el-button size="small" text type="primary" @click="gotoTask(runningItem.name)">
            {{ tr('task_setting') }}
          </el-button>
        </div>
        <div v-else class="task-empty" />
      </div>

      <!-- 队列中 -->
      <div class="card">
        <div class="card-title">{{ tr('pending') }}</div>
        <el-divider class="divider" />
        <div class="list pending">
          <div v-for="item in schedule.pending" :key="item.name" class="task-item">
            <div class="task-info">
              <div class="task-name">{{ tr(item.name) }}</div>
              <div class="task-time">{{ item.next_run }}</div>
            </div>
            <el-button size="small" text type="primary" @click="gotoTask(item.name)">
              {{ tr('task_setting') }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- 等待中 -->
      <div class="card grow">
        <div class="card-title">
          {{ tr('waiting') }}
          <span class="conn" :class="{ on: connected }">{{ connected ? '已连接' : '未连接' }}</span>
        </div>
        <el-divider class="divider" />
        <div class="list waiting">
          <div v-for="item in schedule.waiting" :key="item.name" class="task-item">
            <div class="task-info">
              <div class="task-name">{{ tr(item.name) }}</div>
              <div class="task-time">{{ item.next_run }}</div>
            </div>
            <el-button size="small" text type="primary" @click="gotoTask(item.name)">
              {{ tr('task_setting') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="right">
      <!-- 按配置重建面板：滚动位置、自动滚动状态各自独立，不会互相干扰 -->
      <log-panel
        :key="currentConfig"
        :lines="logs"
        :view-key="currentConfig"
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

.overview-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
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
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
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
  padding: 0 4px 0 12px;
}

.sched-title {
  font-size: 13px;
  font-weight: 600;
}

.sched-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.divider {
  margin: 6px 0 4px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}

.task-item :deep(.el-button) {
  padding: 2px 4px;
  font-size: 12px;
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
  color: var(--el-text-color-placeholder);
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
  color: var(--el-text-color-placeholder);
}

.conn.on {
  color: var(--el-color-success);
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex: none;
}

/* 运行中：绿色跳动（对应原版 SpinKitChasingDots） */
.dot-running {
  background: var(--el-color-success);
  animation: dot-bounce 1.1s ease-in-out infinite;
}

/* 异常：橙色跳动（对应原版 SpinKitDoubleBounce） */
.dot-warning {
  background: var(--el-color-warning);
  animation: dot-bounce 1.4s ease-in-out infinite;
}

/* 更新中：蓝色呼吸 */
.dot-updating {
  background: var(--el-color-primary);
  animation: dot-breath 1.6s ease-in-out infinite;
}

/* 未运行：灰色静止（对应原版灰色圆环） */
.dot-idle {
  background: var(--el-border-color-darker, #c9ced6);
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
