<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NSwitch,
  useDialog,
  useMessage
} from 'naive-ui'
import { useAppUpdate } from '../composables/useAppUpdate'
import { useEngine } from '../composables/useEngine'
import { useLocale, tr } from '../i18n'
import { useTheme } from '../composables/useTheme'
import { useSession } from '../composables/useSession'
import { useRouter } from 'vue-router'

const dialog = useDialog()
const message = useMessage()
const { isDark, toggle } = useTheme()
const { locale, setLocale } = useLocale()
const { info, update, check, install } = useAppUpdate()
const { status, stop } = useEngine()
const { logout } = useSession()
const router = useRouter()

const busy = ref(false)

function onLogout(): void {
  logout()
  void router.replace({ name: 'login' })
}

const engineReady = computed(() => Boolean(status.value?.running))

async function onCheck(): Promise<void> {
  message.info(await check())
}

async function onInstall(): Promise<void> {
  message.info(await install())
}

function onKillServer(): void {
  dialog.warning({
    title: tr('are_you_sure_kill'),
    content: '会停止本地脚本服务，正在跑的任务会中断。',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      busy.value = true
      try {
        message.info(await stop())
      } finally {
        busy.value = false
      }
    }
  })
}
</script>

<template>
  <div class="settings">
    <n-card size="small" :bordered="true" title="外观">
      <div class="row">
        <span class="label">{{ tr('change_theme') }}</span>
        <n-switch :value="isDark" @update:value="toggle">
          <template #checked>暗色</template>
          <template #unchecked>亮色</template>
        </n-switch>
      </div>
      <div class="row">
        <span class="label">{{ tr('change_language') }}</span>
        <n-radio-group
          :value="locale"
          size="small"
          @update:value="(v: 'zh-CN' | 'en-US') => setLocale(v)"
        >
          <n-radio-button value="zh-CN">{{ tr('zh_cn') }}</n-radio-button>
          <n-radio-button value="en-US">{{ tr('en_us') }}</n-radio-button>
        </n-radio-group>
      </div>
    </n-card>

    <n-card size="small" :bordered="true" title="脚本服务" class="mt">
      <n-descriptions :column="1" size="small" label-placement="left" label-style="width: 92px">
        <n-descriptions-item label="状态">
          {{ engineReady ? '运行中' : status?.installed ? '已停止' : '未安装' }}
        </n-descriptions-item>
        <n-descriptions-item label="端口">{{ status?.port ?? '—' }}</n-descriptions-item>
        <n-descriptions-item label="代码版本">{{ status?.codeVersion ?? '—' }}</n-descriptions-item>
      </n-descriptions>
      <div class="row mt">
        <n-button size="small" type="error" ghost :disabled="!engineReady || busy" @click="onKillServer">
          {{ tr('kill_oas_server') }}
        </n-button>
        <n-button size="small" @click="onLogout">{{ tr('log_out') }}</n-button>
      </div>
    </n-card>

    <n-card size="small" :bordered="true" title="应用更新" class="mt">
      <n-descriptions :column="1" size="small" label-placement="left" label-style="width: 92px">
        <n-descriptions-item :label="tr('current_version')">
          v{{ info?.version ?? '—' }}
        </n-descriptions-item>
        <n-descriptions-item label="运行方式">
          {{ info?.packaged ? '已安装' : '开发模式' }}
        </n-descriptions-item>
        <n-descriptions-item label="环境">
          Electron {{ info?.electron ?? '—' }} · Node {{ info?.node ?? '—' }}
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
        class="mt"
      >
        {{
          update.ready.busy
            ? `v${update.ready.version} 已下载，但引擎正在跑任务，请先停止引擎再重启更新。`
            : `v${update.ready.version} 已就绪，重启后生效。`
        }}
      </n-alert>

      <n-alert v-if="update.error" type="error" :bordered="false" class="mt">
        {{ update.error }}
      </n-alert>

      <div class="row mt">
        <n-button size="small" :disabled="update.checking" @click="onCheck">检查更新</n-button>
        <n-button size="small" type="primary" :disabled="!update.ready" @click="onInstall">
          重启并更新
        </n-button>
      </div>
    </n-card>

    <n-card size="small" :bordered="true" class="mt">
      <div class="about">
        <div class="about-name">明珠轩辕 · 脚本控制台</div>
        <div class="about-text">
          界面基于 Electron + Vue 3 + Naive UI，字体为小米 MiSans。 脚本本体来自 mzxyAutoScript，通过
          Release 独立更新。
        </div>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.settings {
  max-width: 620px;
  margin: 0 auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 0;
}

.label {
  font-size: 12.5px;
  opacity: 0.7;
  min-width: 88px;
}

.mt {
  margin-top: 12px;
}

.progress {
  margin-top: 10px;
}

.progress-text {
  margin-top: 4px;
  font-size: 11.5px;
  opacity: 0.6;
}

.about-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.about-text {
  font-size: 12px;
  line-height: 1.7;
  opacity: 0.6;
}
</style>
