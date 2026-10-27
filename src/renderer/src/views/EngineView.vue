<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useEngine } from '../composables/useEngine'

const { status, rootDir, engineBytes, working, install, start, stop, installEngine } = useEngine()

const installed = computed(() => status.value?.installed ?? false)
const running = computed(() => status.value?.running ?? false)
const busy = computed(() => working.value || install.active)

const stateText = computed(() => {
  if (!status.value) return '读取中'
  if (!installed.value) return '未安装'
  return running.value ? '运行中' : '已停止'
})

const stateType = computed<'info' | 'success' | 'warning'>(() => {
  if (!installed.value) return 'info'
  return running.value ? 'success' : 'warning'
})

const sizeText = computed(() => `${(engineBytes.value / 1024 / 1024).toFixed(0)} MB`)

async function onStart(): Promise<void> {
  ElMessage.info(await start())
}

async function onStop(): Promise<void> {
  ElMessage.info(await stop())
}

async function onInstall(): Promise<void> {
  const r = await installEngine()
  if (install.error) ElMessage.error(install.error)
  else ElMessage.success(r)
}
</script>

<template>
  <el-row :gutter="16">
    <el-col :xs="24" :md="12">
      <el-card shadow="never" class="block">
        <template #header>
          <div class="head">
            <span class="card-title">引擎</span>
            <el-tag :type="stateType" size="small" round effect="light" :closable="false">
              {{ stateText }}
            </el-tag>
          </div>
        </template>

        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item label="代码版本">
            <code class="code">{{ status?.codeVersion ?? '—' }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="运行环境">
            <code class="code">{{ status?.envId ?? '—' }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="端口">{{ status?.port ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="存放位置">
            <div class="path-row">
              <span class="path break-all" :title="rootDir">{{ rootDir || '—' }}</span>
              <el-tag size="small" type="info" effect="plain" :closable="false">
                {{ sizeText }}
              </el-tag>
            </div>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="install.active" class="progress">
          <el-progress
            :percentage="install.percent"
            :show-text="false"
            :stroke-width="6"
            :indeterminate="install.percent === 0"
          />
          <div class="progress-text">{{ install.text }}</div>
        </div>

        <el-alert v-else-if="install.error" type="error" :closable="false" show-icon class="alert">
          {{ install.error }}
        </el-alert>

        <el-alert v-else-if="!installed" type="info" :closable="false" show-icon class="alert">
          首次使用需要下载脚本（代码约 8MB + 运行环境约 235MB）。
          脚本全部放在「存放位置」这一个目录里，删掉即卸载。
        </el-alert>

        <template #footer>
          <div class="actions">
            <el-button type="primary" :disabled="busy || !installed || running" @click="onStart">
              启动
            </el-button>
            <el-button :disabled="busy || !running" @click="onStop">停止</el-button>
            <el-button :disabled="busy || running" @click="onInstall">
              {{ installed ? '更新引擎' : '安装引擎' }}
            </el-button>
          </div>
        </template>
      </el-card>
    </el-col>

    <el-col :xs="24" :md="12">
      <el-card shadow="never" class="block">
        <template #header><span class="card-title">说明</span></template>
        <div class="tips">
          <p><b>启动</b>：拉起本地脚本服务，界面所有数据都从它读取。</p>
          <p>
            <b>更新引擎</b>：只比对代码版本，通常只下几 MB；运行环境（几百 MB）只在依赖变化时才下载。
          </p>
          <p><b>运行中不能更新</b>：引擎正在跑任务时请先停止，避免打断脚本。</p>
          <p><b>便携</b>：引擎和数据都在「存放位置」这一个文件夹里，整个拷走就能用。</p>
        </div>
      </el-card>
    </el-col>
  </el-row>
</template>

<style scoped>
.block {
  border-radius: 10px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 13.5px;
  font-weight: 600;
}

.code {
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
}

.path-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.path {
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.progress {
  margin-top: 14px;
}

.progress-text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.alert {
  margin-top: 14px;
}

.actions {
  display: flex;
  gap: 8px;
}

.tips p {
  margin: 0 0 10px;
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--el-text-color-regular);
}

.tips p:last-child {
  margin-bottom: 0;
}
</style>
