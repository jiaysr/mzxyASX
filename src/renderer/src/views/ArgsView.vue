<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NEmpty, useMessage } from 'naive-ui'
import { runTaskNow } from '../api/http'
import ArgsForm from '../components/ArgsForm.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { tr } from '../i18n'

const message = useMessage()
const { currentConfig, currentMenu } = useConfig()
const { status } = useEngine()

const engineReady = computed(() => Boolean(status.value?.running))

/** 立即运行：把下次运行时间设成现在，调度器下一轮就会跑到它 */
async function onRunNow(): Promise<void> {
  try {
    await runTaskNow(currentConfig.value, currentMenu.value)
    message.success('已排到最前，脚本运行时会立刻执行')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}
</script>

<template>
  <n-empty v-if="!engineReady" description="引擎还没启动" size="large" class="empty">
    <template #extra>
      <span class="hint">先到「引擎」页点启动，再回来配置任务</span>
    </template>
  </n-empty>

  <template v-else-if="currentMenu">
    <div class="head">
      <span class="title">{{ tr(currentMenu) }}</span>
      <span class="cfg">{{ currentConfig }}</span>
      <n-button size="small" type="primary" ghost class="run" @click="onRunNow">
        立即运行
      </n-button>
    </div>
    <args-form :config="currentConfig" :task="currentMenu" />
  </template>

  <n-empty v-else description="选一个任务开始配置" />
</template>

<style scoped>
.head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}

.title {
  font-size: 14px;
  font-weight: 600;
}

.cfg {
  font-size: 12px;
  opacity: 0.45;
}

.run {
  margin-left: auto;
}

.empty {
  margin-top: 60px;
}

.hint {
  font-size: 12px;
  opacity: 0.6;
}
</style>
