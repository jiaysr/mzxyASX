<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import appIcon from '../assets/icon.png'
import { useAppUpdate } from '../composables/useAppUpdate'
import { useEngine } from '../composables/useEngine'
import { usePrefs } from '../composables/usePrefs'
import { normalizeAddress, useSession } from '../composables/useSession'

const router = useRouter()
const { status, working, install, start, stop, installEngine, refresh } = useEngine()
const { info, update, check, install: installUpdate } = useAppUpdate()
const { prefs, load: loadPrefs, save: savePrefs } = usePrefs()
const { address, localAddress, login } = useSession()

const input = ref(address.value || '')
const busy = ref(false)
const error = ref('')

const installed = computed(() => status.value?.installed ?? false)
const running = computed(() => status.value?.running ?? false)
const engineBusy = computed(() => working.value || install.active)

const engineLabel = computed(() => {
  if (!status.value) return '读取中'
  if (!installed.value) return '未安装'
  return running.value ? `运行中 · 端口 ${status.value.port ?? '—'}` : '已停止'
})

const engineTagType = computed<'info' | 'success' | 'warning'>(() => {
  if (!installed.value) return 'info'
  return running.value ? 'success' : 'warning'
})

/** 本地引擎起来后自动填上动态端口 */
watch(
  localAddress,
  (next) => {
    if (next) input.value = next
  },
  { immediate: true }
)

/** 引擎状态文案跟着实时状态走，不是一次性文案 */
const engineText = computed(() =>
  running.value
    ? `本机引擎已启动，端口 ${status.value?.port}`
    : installed.value
      ? '本机引擎已停止：点下面的「启动引擎」，或手动填写别的地址'
      : '本机引擎未安装：点下面的「下载引擎」，或手动填写别的地址'
)

onMounted(async () => {
  await Promise.all([refresh(), loadPrefs()])
})

async function onLogin(): Promise<void> {
  error.value = ''
  busy.value = true
  try {
    const r = await login(input.value)
    if (r.ok) {
      void router.replace({ name: 'main' })
    } else {
      error.value = r.message
    }
  } finally {
    busy.value = false
  }
}

function onInput(value: string): void {
  input.value = normalizeAddress(value)
}

/** 下载 / 启动 / 停止本机引擎（全部手动，应用打开时不会自己跑） */
async function onInstall(): Promise<void> {
  const r = await installEngine()
  if (install.error) ElMessage.error(install.error)
  else ElMessage.success(r)
}

async function onStart(): Promise<void> {
  ElMessage.success(await start())
}

async function onStop(): Promise<void> {
  ElMessage.info(await stop())
}

async function onChannelChange(value: string): Promise<void> {
  const next = value === 'latest' ? 'latest' : 'dev-latest'
  const err = await savePrefs({ engineChannel: next })
  if (err) ElMessage.error(err)
  else ElMessage.success(`已切换到${next === 'latest' ? '正式版' : '开发版'}，下次更新引擎时生效`)
}

async function onCheckUpdate(): Promise<void> {
  ElMessage.info(await check())
}

async function onInstallUpdate(): Promise<void> {
  ElMessage.info(await installUpdate())
}
</script>

<template>
  <div class="login">
    <div class="card">
      <!-- 品牌 + 版本 / 新版本提示 -->
      <header class="brand">
        <img class="mark" :src="appIcon" alt="明珠轩辕" />
        <div class="brand-text">
          <div class="name">明珠轩辕</div>
          <div class="sub">脚本控制台</div>
        </div>
        <div class="version">
          <span class="ver">{{ info ? `v${info.version}` : '—' }}</span>
          <button v-if="update.ready" type="button" class="update-tag ready" @click="onInstallUpdate">
            新版本 v{{ update.ready.version }} 已就绪
          </button>
          <span v-else-if="update.available" class="update-tag">
            正在下载 v{{ update.available }} · {{ update.percent }}%
          </span>
        </div>
      </header>

      <!-- 连接 -->
      <section class="section">
        <div class="label">服务地址</div>
        <el-input
          :model-value="input"
          placeholder="127.0.0.1:22267"
          size="large"
          @update:model-value="onInput"
          @keyup.enter="onLogin"
        />
        <div class="hint">{{ engineText }}</div>

        <el-alert v-if="error" type="error" :closable="false" show-icon class="alert">
          {{ error }}
        </el-alert>

        <el-button type="primary" size="large" class="connect" :loading="busy" @click="onLogin">
          连接
        </el-button>
        <div class="tip">填 IP:Port，不要填用户名密码</div>
      </section>

      <el-divider class="divider" />

      <!-- 本机引擎：手动下载 / 启动，不做任何自动动作 -->
      <section class="section">
        <div class="section-head">
          <span class="section-title">本机引擎</span>
          <el-tag :type="engineTagType" size="small" round effect="light" :closable="false">
            {{ engineLabel }}
          </el-tag>
        </div>

        <div class="channel">
          <span class="channel-label">更新渠道</span>
          <el-select
            :model-value="prefs.engineChannel"
            size="small"
            class="channel-select"
            @update:model-value="onChannelChange"
          >
            <el-option label="开发版 · dev-latest" value="dev-latest" />
            <el-option label="正式版 · 尚未发布" value="latest" disabled />
          </el-select>
        </div>

        <el-progress
          v-if="install.active"
          :percentage="install.percent"
          :show-text="false"
          :stroke-width="5"
          :indeterminate="install.percent === 0"
          class="progress"
        />
        <div v-if="install.active" class="progress-text">{{ install.text }}</div>
        <el-alert v-else-if="install.error" type="error" :closable="false" class="alert">
          {{ install.error }}
        </el-alert>

        <div class="actions">
          <el-button
            v-if="!installed"
            size="small"
            type="primary"
            :disabled="engineBusy"
            @click="onInstall"
          >
            下载引擎
          </el-button>
          <template v-else>
            <el-button size="small" type="primary" :disabled="engineBusy || running" @click="onStart">
              启动引擎
            </el-button>
            <el-button size="small" :disabled="engineBusy || !running" @click="onStop">
              停止引擎
            </el-button>
            <el-button size="small" text :disabled="engineBusy || running" @click="onInstall">
              更新引擎
            </el-button>
          </template>
        </div>
      </section>

      <footer class="foot">
        <el-button text size="small" :loading="update.checking" @click="onCheckUpdate">
          {{ update.checking ? '检查中…' : '检查更新' }}
        </el-button>
        <span v-if="update.error" class="foot-error" :title="update.error">更新检查失败</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.login {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--el-bg-color-page);
  overflow-y: auto;
}

.card {
  width: 420px;
  padding: 22px 24px 14px;
  border-radius: 14px;
  background: var(--el-bg-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

/* ---------------- 品牌 ---------------- */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
  flex: none;
  /* 图标自带描边，加一层很淡的阴影让它从卡片底色上浮起来 */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.brand-text {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 16px;
  font-weight: 600;
}

.sub {
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.version {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.ver {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

.update-tag {
  border: none;
  padding: 1px 8px;
  border-radius: 9px;
  font-family: inherit;
  font-size: 11.5px;
  line-height: 1.6;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.update-tag.ready {
  cursor: pointer;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.update-tag.ready:hover {
  background: var(--el-color-success-light-8);
}

/* ---------------- 通用 ---------------- */
.section {
  margin-bottom: 4px;
}

.label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

.hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

.alert {
  margin-top: 12px;
}

.connect {
  width: 100%;
  margin-top: 14px;
}

.tip {
  margin-top: 10px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.divider {
  margin: 18px 0 16px;
}

/* ---------------- 引擎 ---------------- */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
}

.channel {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.channel-label {
  font-size: 12.5px;
  color: var(--el-text-color-regular);
  flex: none;
}

.channel-select {
  width: 190px;
}

.progress {
  margin-bottom: 6px;
}

.progress-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ---------------- 底部 ---------------- */
.foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.foot :deep(.el-button) {
  padding: 4px 6px;
  font-size: 12px;
}

.foot-error {
  font-size: 11.5px;
  color: var(--el-color-danger);
  cursor: help;
}
</style>
