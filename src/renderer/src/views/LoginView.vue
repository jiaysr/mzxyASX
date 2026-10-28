<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import appIcon from '../assets/icon.png'
import AppIcon from '../components/AppIcon.vue'
import { useAppUpdate } from '../composables/useAppUpdate'
import { normalizeAddress, useSession } from '../composables/useSession'

const router = useRouter()
const { info, update, check, install: installUpdate } = useAppUpdate()
const { address, localAddress, login, tryAutoLogin } = useSession()

const input = ref(address.value || '')
const busy = ref(false)
const error = ref('')
const autoConnecting = ref(false)

/** 本机脚本服务启动后自动填上端口 */
watch(
  localAddress,
  (next) => {
    if (next) input.value = next
  },
  { immediate: true }
)

onMounted(async () => {
  if (!input.value) input.value = address.value
  if (!address.value) return

  // 后台自动重连：先让登录页出来，成功后再跳主界面，绝不阻塞首屏
  autoConnecting.value = true
  const ok = await tryAutoLogin()
  autoConnecting.value = false
  if (ok) void router.replace({ name: 'main' })
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

function onOpenServer(): void {
  void router.push({ name: 'server' })
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

      <div class="page-title">登录</div>

      <section class="section">
        <div class="label">服务地址</div>
        <el-input
          :model-value="input"
          placeholder="127.0.0.1:22267"
          size="large"
          @update:model-value="onInput"
          @keyup.enter="onLogin"
        />
        <div class="hint">
          <span v-if="autoConnecting">正在尝试连接上次的服务地址…</span>
          <span v-else>填 IP:Port；本机脚本服务启动后会自动填入端口</span>
        </div>

        <el-alert v-if="error" type="error" :closable="false" show-icon class="alert">
          {{ error }}
        </el-alert>

        <el-button type="primary" size="large" class="connect" :loading="busy" @click="onLogin">
          登录
        </el-button>
        <div class="tip">首次使用先点右下角「启动脚本服务」，选择脚本目录后再登录</div>
      </section>

      <footer class="foot">
        <el-button text size="small" :loading="update.checking" @click="onCheckUpdate">
          {{ update.checking ? '检查中…' : '检查更新' }}
        </el-button>
        <span v-if="update.error" class="foot-error" :title="update.error">更新检查失败</span>
      </footer>
    </div>

    <el-tooltip content="启动脚本服务" placement="left" :show-after="300">
      <el-button class="server-fab" circle size="large" @click="onOpenServer">
        <app-icon name="engine" :size="20" />
      </el-button>
    </el-tooltip>
  </div>
</template>

<style scoped>
.login {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--el-bg-color-page);
  overflow-y: auto;
}

.card {
  width: 400px;
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
  margin-bottom: 18px;
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

/* 旧版登录页的标题：居中、主题色、加粗 */
.page-title {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-color-primary);
  margin: 2px 0 18px;
}

/* ---------------- 表单 ---------------- */
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
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

.update-tag {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.update-tag.ready {
  border: none;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  border-radius: 999px;
  padding: 2px 8px;
  cursor: pointer;
}

.update-tag.ready:hover {
  background: var(--el-color-success-light-8);
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

/* 旧版右下角的服务器入口，保留同样的位置和圆形按钮 */
.server-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 48px;
  height: 48px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  border-color: var(--el-border-color-light);
}

.server-fab:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

@media (max-width: 720px) {
  .server-fab {
    right: 16px;
    bottom: 16px;
  }
}
</style>
