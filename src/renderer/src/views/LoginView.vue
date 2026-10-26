<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NCard, NInput, NSpin } from 'naive-ui'
import { useEngine } from '../composables/useEngine'
import { normalizeAddress, useSession } from '../composables/useSession'

const router = useRouter()
const { status } = useEngine()
const { address, localAddress, login } = useSession()

const input = ref(address.value || '')
const busy = ref(false)
const error = ref('')

/** 本地引擎起来后自动填上动态端口 */
watch(
  localAddress,
  (next) => {
    if (next && !input.value) input.value = next
  },
  { immediate: true }
)

const engineText = ref('')

onMounted(() => {
  engineText.value = status.value?.running
    ? `本机引擎已启动，端口 ${status.value.port}`
    : '本机引擎未启动（可以到引擎页启动，或手动填写别的地址）'
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
  width: 380px;
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
  margin-top: 14px;
  text-align: center;
  font-size: 12px;
  opacity: 0.4;
}

.spin {
  position: fixed;
  bottom: 20px;
}
</style>
