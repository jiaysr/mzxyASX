<script setup lang="ts">
import { computed } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NGi,
  NGrid,
  NProgress,
  NSpace,
  NTag,
  NText,
  useMessage
} from 'naive-ui'
import { useEngine } from '../composables/useEngine'

const message = useMessage()
const { status, rootDir, engineBytes, working, install, start, stop, installEngine } = useEngine()

const installed = computed(() => status.value?.installed ?? false)
const running = computed(() => status.value?.running ?? false)
const busy = computed(() => working.value || install.active)

const stateText = computed(() => {
  if (!status.value) return '读取中'
  if (!installed.value) return '未安装'
  return running.value ? '运行中' : '已停止'
})

const stateType = computed<'default' | 'success' | 'warning'>(() => {
  if (!installed.value) return 'default'
  return running.value ? 'success' : 'warning'
})

const sizeText = computed(() => `${(engineBytes.value / 1024 / 1024).toFixed(0)} MB`)

async function onStart(): Promise<void> {
  message.info(await start())
}

async function onStop(): Promise<void> {
  message.info(await stop())
}

async function onInstall(): Promise<void> {
  const r = await installEngine()
  if (install.error) {
    message.error(install.error)
  } else {
    message.success(r)
  }
}
</script>

<template>
  <n-grid cols="1 900:2" responsive="screen" :x-gap="16" :y-gap="16">
    <n-gi>
      <n-card title="引擎" :bordered="true" size="small">
        <template #header-extra>
          <n-tag :type="stateType" size="small" round :bordered="false">{{ stateText }}</n-tag>
        </template>

        <n-descriptions :column="1" label-placement="left" label-style="width: 84px" size="small">
          <n-descriptions-item label="代码版本">
            <n-text code>{{ status?.codeVersion ?? '—' }}</n-text>
          </n-descriptions-item>
          <n-descriptions-item label="运行环境">
            <n-text code>{{ status?.envId ?? '—' }}</n-text>
          </n-descriptions-item>
          <n-descriptions-item label="端口">
            {{ status?.port ?? '—' }}
          </n-descriptions-item>
          <n-descriptions-item label="存放位置">
            <span class="path" :title="rootDir">{{ rootDir || '—' }}</span>
            <n-tag size="small" :bordered="false" class="size-tag">{{ sizeText }}</n-tag>
          </n-descriptions-item>
        </n-descriptions>

        <div v-if="install.active" class="progress">
          <n-progress
            type="line"
            :percentage="install.percent"
            :show-indicator="false"
            :height="6"
            processing
          />
          <div class="progress-text">{{ install.text }}</div>
        </div>

        <n-alert v-else-if="install.error" type="error" :bordered="false" class="alert">
          {{ install.error }}
        </n-alert>

        <n-alert v-else-if="!installed" type="info" :bordered="false" class="alert">
          首次使用需要下载脚本（代码约 8MB + 运行环境约 235MB）。
          脚本全部放在「存放位置」这一个目录里，删掉即卸载。
        </n-alert>

        <template #action>
          <n-space>
            <n-button type="primary" :disabled="busy || !installed || running" @click="onStart">
              启动
            </n-button>
            <n-button :disabled="busy || !running" @click="onStop">停止</n-button>
            <n-button :disabled="busy || running" @click="onInstall">
              {{ installed ? '更新引擎' : '安装引擎' }}
            </n-button>
          </n-space>
        </template>
      </n-card>
    </n-gi>

    <n-gi>
      <n-card title="说明" :bordered="true" size="small">
        <div class="tips">
          <p><b>启动</b>：拉起本地脚本服务，界面所有数据都从它读取。</p>
          <p><b>更新引擎</b>：只比对代码版本，通常只下几 MB；运行环境（几百 MB）只在依赖变化时才下载。</p>
          <p><b>运行中不能更新</b>：引擎正在跑任务时请先停止，避免打断脚本。</p>
          <p><b>便携</b>：引擎和数据都在「存放位置」这一个文件夹里，整个拷走就能用。</p>
        </div>
      </n-card>
    </n-gi>
  </n-grid>
</template>

<style scoped>
.path {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  opacity: 0.8;
  word-break: break-all;
}

.size-tag {
  margin-left: 8px;
}

.progress {
  margin-top: 14px;
}

.progress-text {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.65;
}

.alert {
  margin-top: 14px;
}

.tips p {
  margin: 0 0 10px;
  font-size: 12.5px;
  line-height: 1.7;
  opacity: 0.8;
}

.tips p:last-child {
  margin-bottom: 0;
}
</style>
