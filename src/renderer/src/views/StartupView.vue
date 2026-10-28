<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppIcon from '../components/AppIcon.vue'
import LogPanel from '../components/LogPanel.vue'
import { useEngine } from '../composables/useEngine'
import { usePrefs } from '../composables/usePrefs'
import { useSession } from '../composables/useSession'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const {
  status,
  scriptDir,
  running,
  valid,
  busy,
  working,
  lastError,
  logLines,
  deploy,
  inspect,
  start,
  stop,
  pickDir,
  openDir,
  openDeploy,
  readDeploy,
  saveDeploy,
  clearLogs
} = useEngine()
const { prefs, load: loadPrefs } = usePrefs()
const { loggedIn } = useSession()
const { isDark, toggle } = useTheme()

// 和旧版一样默认收起配置区，把启动日志留在首屏
const showDir = ref(true)
const showConfig = ref(false)

const stateLabel = computed(() => {
  if (!scriptDir.value) return '未选择目录'
  if (!valid.value) return '目录不完整'
  if (busy.value) return '更新中'
  return running.value ? `运行中 · ${status.value?.port ?? '—'}` : '已停止'
})

const stateTagType = computed<'success' | 'warning' | 'info'>(() => {
  if (running.value) return 'success'
  if (busy.value || (scriptDir.value && !valid.value)) return 'warning'
  return 'info'
})

onMounted(async () => {
  await Promise.all([loadPrefs(), readDeploy()])
})

// 切换脚本目录后重新载入 deploy.yaml
watch(scriptDir, () => {
  void readDeploy()
})

function goBack(): void {
  void router.push({ name: loggedIn.value ? 'main' : 'login' })
}

function goLogin(): void {
  void router.push({ name: 'login' })
}

async function onPickDir(): Promise<void> {
  const next = await pickDir()
  if (!next?.scriptDir) return
  if (next.valid) ElMessage.success('脚本目录已设置')
  else ElMessage.warning(`目录缺少：${next.missing.join('、')}`)
  await readDeploy()
}

async function onOpenDir(): Promise<void> {
  const message = await openDir()
  if (message !== '已打开脚本目录') ElMessage.warning(message)
}

async function onOpenDeploy(): Promise<void> {
  const message = await openDeploy()
  if (message !== '已打开 deploy.yaml') ElMessage.warning(message)
}

async function onReadDeploy(): Promise<void> {
  await readDeploy()
  if (deploy.message) ElMessage.info(deploy.message)
}

async function onSaveDeploy(): Promise<void> {
  const r = await saveDeploy(deploy.content)
  if (r.ok) ElMessage.success(r.message)
  else ElMessage.error(r.message)
}

/** 与旧版一致：启动前先跑 deploy.installer；有未提交改动时给跳过更新出口 */
async function onStart(): Promise<void> {
  if (working.value || busy.value) return
  if (status.value?.insideInstallDir) {
    ElMessage.error('脚本目录不能放在控制台安装目录内，UI 更新会删除它')
    return
  }
  if (!valid.value) {
    ElMessage.warning('先选择有效的脚本目录')
    return
  }

  await inspect()

  let update = prefs.updateOnStart
  let allowDirty = false
  if (update && status.value?.dirty) {
    try {
      await ElMessageBox.confirm(
        '脚本目录有未提交的改动，deploy.installer 会执行 git reset --hard 丢弃它们。',
        '脚本目录有本地改动',
        {
          type: 'warning',
          confirmButtonText: '继续更新并启动',
          cancelButtonText: '跳过更新直接启动',
          distinguishCancelAndClose: true,
          closeOnClickModal: false
        }
      )
    } catch (action) {
      if (action === 'cancel') update = false
      else return
    }
    if (update) allowDirty = true
  }

  const message = await start(update, allowDirty)
  if (!status.value?.running) ElMessage.error(message)
  else if (message.includes('更新失败')) ElMessage.warning(message)
  else ElMessage.success(message)
}

async function onStop(): Promise<void> {
  ElMessage.info(await stop())
}
</script>

<template>
  <div class="startup">
    <header class="bar">
      <el-button text circle size="small" @click="goBack">
        <app-icon name="back" :size="17" />
      </el-button>
      <span class="title">启动脚本服务</span>
      <el-tag :type="stateTagType" size="small" round effect="light" :closable="false">
        {{ stateLabel }}
      </el-tag>

      <div class="bar-right">
        <el-button v-if="running" size="small" type="primary" plain @click="goLogin">
          去登录
        </el-button>
        <el-button text circle size="small" :title="'切换主题'" @click="toggle">
          <app-icon :name="isDark ? 'sun' : 'moon'" :size="16" />
        </el-button>
      </div>
    </header>

    <main class="body">
      <el-alert
        v-if="status?.legacyPack"
        type="warning"
        :closable="false"
        show-icon
      >
        检测到旧版发布包引擎（engine/state.json），控制台已不再维护它。
        请准备含 toolkit 的完整脚本目录，并在这里重新选择。
      </el-alert>

      <el-alert
        v-if="status?.insideInstallDir"
        type="error"
        :closable="false"
        show-icon
      >
        脚本目录在控制台安装目录内，UI 更新/重装会删除它。
        请把脚本目录移到控制台安装目录之外。
      </el-alert>

      <el-alert v-if="lastError" type="error" :closable="false" show-icon>
        {{ lastError }}
      </el-alert>

      <section class="card">
        <div class="card-head clickable" @click="showDir = !showDir">
          <span class="card-title">脚本目录</span>
          <div class="head-right">
            <el-tag
              :type="valid ? 'success' : 'danger'"
              size="small"
              effect="plain"
              :closable="false"
            >
              {{ valid ? '目录可用' : '目录不完整' }}
            </el-tag>
            <span class="chev" :class="{ open: showDir }">›</span>
          </div>
        </div>

        <div v-show="showDir" class="card-body">
          <div class="dir-row">
            <span class="dir-value" :title="scriptDir">{{ scriptDir || '未选择' }}</span>
            <el-button size="small" :disabled="busy" @click="onPickDir">
              {{ scriptDir ? '更改' : '选择' }}
            </el-button>
            <el-button size="small" :disabled="!scriptDir" @click="onOpenDir">打开</el-button>
          </div>

          <div v-if="scriptDir && !valid" class="missing">
            缺少：{{ status?.missing.join('、') }}
          </div>
          <div class="hint">
            easy-install 解压后的目录，或含 toolkit、module、deploy 的脚本目录。
            必须放在控制台安装目录之外。
          </div>
        </div>
      </section>

      <section v-loading="deploy.loading" class="card">
        <div class="card-head clickable" @click="showConfig = !showConfig">
          <span class="card-title">服务启动配置</span>
          <div class="head-right">
            <span class="card-sub">{{ showConfig ? '收起' : '展开编辑' }}</span>
            <span class="chev" :class="{ open: showConfig }">›</span>
          </div>
        </div>

        <div v-show="showConfig" class="card-body">
          <div class="card-actions">
            <el-button size="small" text @click="onReadDeploy">重新读取</el-button>
            <el-button size="small" text :disabled="!scriptDir" @click="onOpenDeploy">打开文件</el-button>
            <el-button
              size="small"
              type="primary"
              :loading="deploy.saving"
              :disabled="!scriptDir"
              @click="onSaveDeploy"
            >
              保存
            </el-button>
          </div>

          <el-input
            v-model="deploy.content"
            type="textarea"
            :rows="16"
            class="yaml"
            spellcheck="false"
            placeholder="config/deploy.yaml"
          />
          <div v-if="deploy.message" class="hint">{{ deploy.message }}</div>
        </div>
      </section>

      <log-panel
        :lines="logLines"
        title="服务启动日志"
        height="320px"
        view-key="engine"
        @clear="clearLogs"
      />
    </main>

    <div class="fab">
      <div v-if="busy || (working && !running)" class="running-tip">
        {{ busy ? '正在执行 deploy.installer…' : '正在启动…' }}
      </div>
      <el-button
        circle
        size="large"
        type="primary"
        class="fab-btn"
        :disabled="!valid || running || status?.insideInstallDir"
        title="启动脚本服务"
        @click="onStart"
      >
        <span v-if="working || busy" class="spinner" />
        <app-icon v-else name="play" :size="20" />
      </el-button>
      <el-button
        circle
        size="large"
        class="fab-btn"
        :disabled="!running && !busy"
        title="停止脚本服务"
        @click="onStop"
      >
        <app-icon name="stop" :size="18" />
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.startup {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

.bar {
  flex: 0 0 50px;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 0 10px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.title {
  font-size: 15px;
  font-weight: 600;
  margin-right: 2px;
}

.bar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 18px 108px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  padding: 14px 16px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.card-head.clickable {
  cursor: pointer;
  user-select: none;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  font-size: 13.5px;
  font-weight: 600;
}

.card-sub {
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
}

.chev {
  line-height: 1;
  font-size: 17px;
  color: var(--el-text-color-placeholder);
  transition: transform 0.15s;
}

.chev.open {
  transform: rotate(90deg);
}

.card-body {
  padding-top: 2px;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  margin-bottom: 8px;
}

.dir-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dir-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  border-radius: 7px;
  padding: 6px 10px;
}

.missing {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.hint {
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.yaml :deep(textarea) {
  font-family: 'Cascadia Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre;
  overflow: auto;
}

.fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 20;
}

.fab-btn {
  width: 46px;
  height: 46px;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}

.fab-btn :deep(svg) {
  display: block;
}

.spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  animation: fab-spin 0.8s linear infinite;
}

@keyframes fab-spin {
  to {
    transform: rotate(360deg);
  }
}

.running-tip {
  margin-right: 2px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 999px;
  padding: 5px 10px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .body {
    padding: 12px 12px 100px;
  }

  .fab {
    right: 16px;
    bottom: 16px;
  }
}
</style>
