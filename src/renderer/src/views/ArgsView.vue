<script setup lang="ts">
import { computed } from 'vue'
import { NEmpty } from 'naive-ui'
import ArgsForm from '../components/ArgsForm.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { tr } from '../i18n'

const { currentConfig, currentMenu } = useConfig()
const { status } = useEngine()

const engineReady = computed(() => Boolean(status.value?.running))
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
  font-size: 11.5px;
  opacity: 0.45;
}

.empty {
  margin-top: 60px;
}

.hint {
  font-size: 12px;
  opacity: 0.6;
}
</style>
