<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NCard, NInput, NProgress, NSpin, NTag, useMessage } from 'naive-ui'
import { useEngine } from '../composables/useEngine'
import { normalizeAddress, useSession } from '../composables/useSession'

const router = useRouter()
const message = useMessage()
const { status, working, install, start, stop, installEngine, refresh } = useEngine()
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

const engineTagType = computed<'default' | 'success' | 'warning'>(() => {
  if (!installed.value) return 'default'
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
      : '本机引擎未安装：点下面的「安装引擎」，或手动填写别的地址'
)

onMounted(async () => {
  await refresh()
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

/** 安装 / 启动 / 停止本机引擎（全部手动，应用打开时不会自己跑） */
async function onInstall(): Promise<void> {
  const r = await installEngine()
  if (install.error) message.error(install.error)
  else message.success(r)
}

async function onStart(): Promise<void> {
  message.success(await start())
}

async function onStop(): Promise<void> {
  message.info(await stop())
}
</script>

<template>
  <div class="login">
    <n-card class="card" :bordered="false">
      <div class="brand">
        <div class="mark">明</div>
        <div>
          <div class="name">明珠轩辕</div>
          <div class="sub">脚本控制台</div>
        </div>
      </div>

      <div class="field">
        <div class="label">服务地址</div>
        <n-input
          :value="input"
          placeholder="127.0.0.1:22267"
          size="large"
          @update:value="onInput"
          @keyup.enter="onLogin"
        />
        <div class="hint">{{ engineText }}</div>
      </div>

      <n-alert v-if="error" type="error" :bordered="false" class="alert">{{ error }}</n-alert>

      <n-button type="primary" size="large" block :loading="busy" @click="onLogin">连接</n-button>

      <div class="tip">填 IP:Port，不要填用户名密码</div>

      <div class="divider" />

      <!-- 本机引擎：手动安装 / 启动，不做任何自动动作 -->
      <div class="engine">
        <div class="engine-head">
          <span class="engine-title">本机引擎</span>
          <n-tag :type="engineTagType" size="small" round :bordered="false">
            {{ engineLabel }}
          </n-tag>
        </div>

        <n-progress
          v-if="install.active"
          type="line"
          :percentage="install.percent"
          :show-indicator="false"
          :height="5"
          processing
          class="progress"
        />
        <div v-if="install.active" class="progress-text">{{ install.text }}</div>
        <n-alert v-else-if="install.error" type="error" :bordered="false" class="alert">
          {{ install.error }}
        </n-alert>

        <div class="engine-actions">
          <n-button v-if="!installed" size="small" type="primary" :disabled="engineBusy" @click="onInstall">
            安装引擎
          </n-button>
          <template v-else>
            <n-button size="small" type="primary" :disabled="engineBusy || running" @click="onStart">
              启动引擎
            </n-button>
            <n-button size="small" :disabled="engineBusy || !running" @click="onStop">停止引擎</n-button>
            <n-button size="small" quaternary :disabled="engineBusy || running" @click="onInstall">
              更新引擎
            </n-button>
          </template>
        </div>
      </div>
    </n-card>

    <n-spin v-if="busy" :size="14" class="spin" />
  </div>
</template>

<style scoped>
.login {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card {
  width: 400px;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2b6cf6, #5b8dff);
  color: #fff;
  font-size: 21px;
  font-weight: 600;
}

.name {
  font-size: 16px;
  font-weight: 600;
}

.sub {
  font-size: 12.5px;
  opacity: 0.5;
}

.field {
  margin-bottom: 16px;
}

.label {
  font-size: 13px;
  opacity: 0.7;
  margin-bottom: 6px;
}

.hint {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.45;
  line-height: 1.6;
}

.alert {
  margin-bottom: 14px;
}

.tip {
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  opacity: 0.4;
}

.divider {
  height: 1px;
  background: rgba(128, 128, 128, 0.16);
  margin: 18px 0 14px;
}

.engine-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.engine-title {
  font-size: 13px;
  font-weight: 600;
}

.progress {
  margin-bottom: 4px;
}

.progress-text {
  font-size: 12px;
  opacity: 0.6;
  margin-bottom: 8px;
}

.engine-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.spin {
  position: fixed;
  bottom: 20px;
}
</style>
