<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NGrid,
  NGi,
  NProgress,
  NSpace,
  NTag,
  NText,
  useMessage
} from 'naive-ui'
import { useAppUpdate } from '../composables/useAppUpdate'

const message = useMessage()
const { info, update, check, install } = useAppUpdate()

async function onCheck(): Promise<void> {
  message.info(await check())
}

async function onInstall(): Promise<void> {
  message.info(await install())
}
</script>

<template>
  <n-grid cols="1 900:2" responsive="screen" :x-gap="16" :y-gap="16">
    <n-gi>
      <n-card title="应用更新" :bordered="true" size="small">
        <template #header-extra>
          <n-tag v-if="update.checking" size="small" round :bordered="false">检查中…</n-tag>
          <n-tag v-else-if="update.ready" type="success" size="small" round :bordered="false">
            已下载
          </n-tag>
          <n-tag v-else-if="update.available" size="small" round :bordered="false">
            发现 {{ update.available }}
          </n-tag>
        </template>

        <n-descriptions :column="1" label-placement="left" label-style="width: 84px" size="small">
          <n-descriptions-item label="当前版本">
            v{{ info?.version ?? '—' }}
          </n-descriptions-item>
          <n-descriptions-item label="运行方式">
            {{ info?.packaged ? '已安装' : '开发模式' }}
          </n-descriptions-item>
          <n-descriptions-item label="环境">
            Electron {{ info?.electron ?? '—' }} · Node {{ info?.node ?? '—' }}
          </n-descriptions-item>
          <n-descriptions-item label="平台">
            {{ info?.platform ?? '—' }}
          </n-descriptions-item>
        </n-descriptions>

        <div v-if="update.available && !update.ready" class="progress">
          <n-progress
            type="line"
            :percentage="update.percent"
            :show-indicator="false"
            :height="6"
            processing
          />
          <div class="progress-text">{{ update.percent }}%</div>
        </div>

        <n-alert
          v-if="update.ready"
          :type="update.ready.busy ? 'warning' : 'success'"
          :bordered="false"
          class="alert"
        >
          {{
            update.ready.busy
              ? `v${update.ready.version} 已下载，但引擎正在跑任务，请先停止引擎再重启更新。`
              : `v${update.ready.version} 已就绪，重启后生效。`
          }}
        </n-alert>

        <n-alert v-if="update.error" type="error" :bordered="false" class="alert">
          {{ update.error }}
        </n-alert>

        <template #action>
          <n-space>
            <n-button :disabled="update.checking" @click="onCheck">检查更新</n-button>
            <n-button type="primary" :disabled="!update.ready" @click="onInstall">
              重启并更新
            </n-button>
          </n-space>
        </template>
      </n-card>
    </n-gi>

    <n-gi>
      <n-card title="关于" :bordered="true" size="small">
        <div class="about">
          <p class="about-name">明珠轩辕 · 脚本控制台</p>
          <n-text depth="3" style="font-size: 12.5px; line-height: 1.8">
            界面基于 Electron + Vue 3 + Naive UI，字体为小米 MiSans。
          </n-text>
          <n-text depth="3" style="font-size: 12.5px; line-height: 1.8">
            脚本本体来自 mzxyAutoScript，通过 Release 独立更新。
          </n-text>
        </div>
      </n-card>
    </n-gi>
  </n-grid>
</template>

<style scoped>
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

.about p {
  margin: 0 0 8px;
}

.about-name {
  font-size: 13.5px;
  font-weight: 600;
}
</style>
