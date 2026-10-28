<script setup lang="ts">
import { computed, ref } from 'vue'
import ArgsForm from '../components/ArgsForm.vue'
import AppIcon from '../components/AppIcon.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { getStore } from '../composables/useScript'
import { tr } from '../i18n'

const { currentConfig, currentMenu } = useConfig()
const { status } = useEngine()

/** 手动起的服务/远程服务不归主进程管，能连上 WebSocket 就算就绪 */
const connected = computed(() => getStore(currentConfig.value).connected)
const engineReady = computed(() => Boolean(status.value?.running || connected.value))

const formRef = ref<InstanceType<typeof ArgsForm> | null>(null)
const reloading = ref(false)

async function onReload(): Promise<void> {
  reloading.value = true
  try {
    await formRef.value?.reload()
  } finally {
    reloading.value = false
  }
}
</script>

<template>
  <div class="args-view">
    <el-empty v-if="!engineReady" description="引擎还没启动" :image-size="90">
      <template #description>
        <p class="empty-title">引擎还没启动</p>
        <p class="hint">先到「设置 → 脚本服务」启动引擎，再回来配置任务</p>
      </template>
    </el-empty>

    <template v-else-if="currentMenu">
      <div class="head">
        <div class="head-left">
          <span class="title">{{ tr(currentMenu) }}</span>
          <el-tag size="small" type="info" effect="plain" round :closable="false">
            {{ currentConfig }}
          </el-tag>
        </div>
        <div class="head-right">
          <el-tooltip content="重新读取" placement="bottom" :show-after="300">
            <el-button text circle size="small" :loading="reloading" @click="onReload">
              <app-icon name="refresh" :size="16" />
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <args-form ref="formRef" :config="currentConfig" :task="currentMenu" />
    </template>

    <el-empty v-else description="选一个任务开始配置" :image-size="90" />
  </div>
</template>

<style scoped>
.args-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  /* 不限宽：字段区自己用网格决定列数，窗口越宽排得越开 */
  min-width: 0;
}

.head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.head-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
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
</style>
