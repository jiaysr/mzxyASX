<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useEngine } from '../../composables/useEngine'
import { usePrefs } from '../../composables/usePrefs'
import { useAppUpdate } from '../../composables/useAppUpdate'
import type { AppPrefs } from '../../api'

const { status, working, install, installEngine, reinstallEngine } = useEngine()
const { prefs, load, save } = usePrefs()
const { info, update, check, install: installAppUpdate } = useAppUpdate()

const busy = ref(false)
/** 下载源是「直连 / 自定义镜像」的二选一，落盘只有 mirror 前缀一个字段 */
const sourceMode = ref<'github' | 'mirror'>('github')

onMounted(async () => {
  await load()
  sourceMode.value = prefs.downloadMirror ? 'mirror' : 'github'
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

/** 镜像前缀只接受 http(s)，否则拼出来的地址一定下载失败 */
const mirrorInvalid = computed(
  () => !!prefs.downloadMirror && !/^https?:\/\//i.test(prefs.downloadMirror)
)

async function onMirrorBlur(): Promise<void> {
  if (mirrorInvalid.value) {
    ElMessage.error('镜像地址要以 http:// 或 https:// 开头')
    return
  }
  await patch({ downloadMirror: prefs.downloadMirror })
}

/** 切到直连就清空前缀；切到镜像先保留，等用户填 */
async function onSourceChange(value: string): Promise<void> {
  sourceMode.value = value === 'mirror' ? 'mirror' : 'github'
  if (sourceMode.value === 'github') await patch({ downloadMirror: '' })
}

async function onProxyTypeChange(value: string): Promise<void> {
  const proxyType = value === 'http' || value === 'socks5' ? value : 'none'
  await patch({ proxyType })
}

const proxyPlaceholder = computed(() =>
  prefs.proxyType === 'socks5' ? '127.0.0.1:7891' : '127.0.0.1:7890'
)

// ---------------------------------------------------------------- 操作
const engineReady = computed(() => Boolean(status.value?.installed))

async function onCheckEngine(): Promise<void> {
  busy.value = true
  try {
    const message = await installEngine()
    if (install.error) ElMessage.error(install.error)
    else ElMessage.success(message)
  } finally {
    busy.value = false
  }
}

async function onReinstall(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '会重新下载代码包和运行环境（几百 MB），已有配置不会丢。确定继续吗？',
      '重新下载完整资源',
      { type: 'warning', confirmButtonText: '开始下载', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  busy.value = true
  try {
    const message = await reinstallEngine()
    if (install.error) ElMessage.error(install.error)
    else ElMessage.success(message)
  } finally {
    busy.value = false
  }
}

async function onCheckApp(): Promise<void> {
  ElMessage.info(await check())
}

/** 更新包已经下载好了：这里直接重启安装（引擎在跑时主进程会拒绝） */
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

    <!-- 更新源 -->
    <div class="card">
      <div class="row">
        <span class="row-label">资源更新渠道</span>
        <el-select
          :model-value="prefs.engineChannel"
          class="ctl"
          @update:model-value="(v: string) => patch({ engineChannel: v === 'latest' ? 'latest' : 'dev-latest' })"
        >
          <el-option label="开发版 · dev-latest" value="dev-latest" />
          <el-option label="正式版 · 尚未发布" value="latest" disabled />
        </el-select>
      </div>

      <div class="row">
        <span class="row-label">下载源</span>
        <el-select
          :model-value="sourceMode"
          class="ctl"
          @update:model-value="onSourceChange"
        >
          <el-option label="GitHub 直连" value="github" />
          <el-option label="自定义镜像" value="mirror" />
        </el-select>
      </div>

      <div v-if="sourceMode === 'mirror'" class="row sub">
        <span class="row-label">镜像前缀</span>
        <el-input
          v-model="prefs.downloadMirror"
          class="ctl"
          placeholder="https://ghfast.top/"
          clearable
          @change="onMirrorBlur"
        />
      </div>

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
          代理会应用到资源下载（走 Chromium 网络栈）；镜像前缀会拼在 GitHub 直链前面，
          留空即直连。
        </span>
      </div>
    </div>

    <!-- 操作 -->
    <div class="card">
      <div v-if="install.active" class="progress">
        <el-progress
          :percentage="install.percent"
          :show-text="false"
          :stroke-width="6"
          :indeterminate="install.percent === 0"
        />
        <div class="progress-text">{{ install.text }}</div>
      </div>
      <el-alert v-else-if="install.error" type="error" :closable="false" show-icon class="mb">
        {{ install.error }}
      </el-alert>

      <!-- 清单里的 notes：CI 用 git log 生成，更新完直接看改了什么 -->
      <div v-if="install.notes" class="notes">
        <div class="notes-title">本次更新内容</div>
        <pre class="notes-body">{{ install.notes }}</pre>
      </div>

      <div class="row">
        <div class="row-text">
          <div class="row-title">检查资源更新</div>
          <div class="row-desc">比对清单，有新版本才下载，通常只有几 MB</div>
        </div>
        <el-button size="small" :loading="busy" :disabled="busy || working" @click="onCheckEngine">
          检查
        </el-button>
      </div>

      <div class="row">
        <div class="row-text">
          <div class="row-title">重新下载完整资源</div>
          <div class="row-desc">忽略本地版本，强制重下代码包与运行环境</div>
        </div>
        <el-button
          size="small"
          :loading="busy"
          :disabled="busy || working || !engineReady"
          @click="onReinstall"
        >
          重新下载
        </el-button>
      </div>

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
        <el-button v-else size="small" :loading="update.checking" @click="onCheckApp">
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

.row.sub {
  border-top: none;
  padding-top: 0;
  min-height: 38px;
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

.progress {
  padding: 10px 0 12px;
}

.progress-text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.mb {
  margin: 10px 0;
}

.mt {
  margin-top: 4px;
  margin-bottom: 8px;
}

.notes {
  margin: 6px 0 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.notes-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.notes-body {
  margin: 0;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
</style>
