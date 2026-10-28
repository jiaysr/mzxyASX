<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { usePrefs } from '../../composables/usePrefs'
import { useAppUpdate } from '../../composables/useAppUpdate'
import type { AppPrefs } from '../../api'

const { prefs, load, save } = usePrefs()
const { info, update, check, install: installAppUpdate } = useAppUpdate()

const busy = ref(false)

onMounted(async () => {
  await load()
})

// ---------------------------------------------------------------- 版本信息
const rows = computed(() => [
  { label: '软件版本', value: info.value ? `v${info.value.version}` : '—' }
])

async function copy(text: string): Promise<void> {
  if (!text || text === '—') return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success({ message: '已复制', duration: 1000 })
  } catch {
    ElMessage.error('复制失败')
  }
}

// ---------------------------------------------------------------- 偏好保存
async function patch(next: Partial<AppPrefs>): Promise<void> {
  const error = await save(next)
  if (error) ElMessage.error(error)
}

async function onProxyTypeChange(value: string): Promise<void> {
  const proxyType = value === 'http' || value === 'socks5' ? value : 'none'
  await patch({ proxyType })
}

const proxyPlaceholder = computed(() =>
  prefs.proxyType === 'socks5' ? '127.0.0.1:7891' : '127.0.0.1:7890'
)

// ---------------------------------------------------------------- 操作
async function onCheckApp(): Promise<void> {
  busy.value = true
  try {
    ElMessage.info(await check())
  } finally {
    busy.value = false
  }
}

/** 更新包已经下载好了：这里直接重启安装（脚本在跑时主进程会拒绝） */
async function onInstallApp(): Promise<void> {
  ElMessage.info(await installAppUpdate())
}
</script>

<template>
  <div class="update">
    <!-- 版本 -->
    <div class="card">
      <div v-for="row in rows" :key="row.label" class="row">
        <span class="row-label">{{ row.label }}</span>
        <span class="row-value" title="点击复制" @click="copy(row.value)">{{ row.value }}</span>
      </div>
    </div>

    <!-- 脚本更新：完全交给脚本目录自己的 deploy.installer -->
    <div class="card">
      <div class="row">
        <div class="row-text">
          <div class="row-title">启动前更新脚本</div>
          <div class="row-desc">
            启动脚本服务前执行 deploy.installer（git pull + 依赖 + adb）。
            关闭后直接用现有代码启动，也可以在「更新」页手动拉取。
          </div>
        </div>
        <el-switch
          class="switch-right"
          :model-value="prefs.updateOnStart"
          @update:model-value="(v: string | number | boolean) => patch({ updateOnStart: !!v })"
        />
      </div>

      <div class="row tip">
        <span>
          脚本目录有未提交改动时，启动前会单独提示；deploy.installer 默认会
          reset --hard 到远端分支，确认后再继续。
        </span>
      </div>
    </div>

    <!-- 网络 / 控制台更新 -->
    <div class="card">
      <div class="row">
        <span class="row-label">代理设置</span>
        <div class="ctl-group">
          <el-select
            :model-value="prefs.proxyType"
            class="ctl narrow"
            @update:model-value="onProxyTypeChange"
          >
            <el-option label="不使用" value="none" />
            <el-option label="HTTP Proxy" value="http" />
            <el-option label="SOCKS5" value="socks5" />
          </el-select>
          <el-input
            v-model="prefs.proxyAddress"
            class="ctl"
            :disabled="prefs.proxyType === 'none'"
            :placeholder="proxyPlaceholder"
            @change="patch({ proxyAddress: prefs.proxyAddress })"
          />
        </div>
      </div>

      <div class="row">
        <span class="row-label">自动检查更新</span>
        <el-switch
          class="switch-right"
          :model-value="prefs.autoCheckUpdate"
          @update:model-value="(v: string | number | boolean) => patch({ autoCheckUpdate: !!v })"
        />
      </div>

      <div class="row tip">
        <span>
          代理只作用于控制台自身的更新和网络请求；脚本的 git / pip 走系统网络，
          需要代理请在脚本目录的 config/deploy.yaml 里配置 GitProxy。
        </span>
      </div>
    </div>

    <!-- 控制台更新 -->
    <div class="card">
      <div class="row">
        <div class="row-text">
          <div class="row-title">检查界面更新</div>
          <div class="row-desc">
            {{ update.ready ? `v${update.ready.version} 已就绪，重启后生效` : '检查控制台本体是否有新版本' }}
          </div>
        </div>
        <el-button
          v-if="update.ready"
          size="small"
          type="primary"
          @click="onInstallApp"
        >
          重启并更新
        </el-button>
        <el-button v-else size="small" :loading="busy || update.checking" @click="onCheckApp">
          检查
        </el-button>
      </div>

      <el-alert v-if="update.error" type="error" :closable="false" show-icon class="mt">
        {{ update.error }}
      </el-alert>
    </div>
  </div>
</template>

<style scoped>
.update {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 0 8px;
}

.card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  padding: 6px 20px;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 46px;
  padding: 6px 0;
}

.row + .row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.row.tip {
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
  min-height: 0;
  padding: 10px 0;
}

.row-label {
  font-size: 13px;
  font-weight: 600;
  flex: none;
}

.row-text {
  flex: 1;
  min-width: 0;
}

.row-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.row-desc {
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.row-value {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.row-value:hover {
  color: var(--el-color-primary);
}

.ctl {
  margin-left: auto;
  width: 215px;
  flex: none;
}

.switch-right {
  margin-left: auto;
}

.ctl.narrow {
  width: 140px;
}

.ctl-group {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex: none;
}

.ctl-group .ctl {
  margin-left: 0;
  width: 215px;
}

.mt {
  margin-top: 4px;
  margin-bottom: 8px;
}
</style>
