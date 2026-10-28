<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useEngine } from '../../composables/useEngine'
import { useSession } from '../../composables/useSession'
import { tr } from '../../i18n'

const { status, scriptDir, running, valid, busy, lastError, stop } = useEngine()
const { logout } = useSession()
const router = useRouter()

const stateLabel = computed(() => {
  if (!scriptDir.value) return '未选择目录'
  if (!valid.value) return '目录不完整'
  if (busy.value) return '更新中'
  return running.value ? '运行中' : '已停止'
})

const rows = computed(() => [
  { label: '状态', value: stateLabel.value },
  { label: '脚本目录', value: scriptDir.value || '—', mono: true },
  { label: '端口', value: running.value ? String(status.value?.port ?? '—') : '—' },
  {
    label: '脚本版本',
    value: status.value?.commit
      ? `${status.value.branch ?? ''} @ ${status.value.commit}`
      : '—',
    mono: true
  }
])

function onOpenStartup(): void {
  void router.push({ name: 'server' })
}

async function onStop(): Promise<void> {
  ElMessage.info(await stop())
}

function onLogout(): void {
  logout()
  void router.replace({ name: 'login' })
}
</script>

<template>
  <div class="service">
    <div class="card">
      <div v-for="row in rows" :key="row.label" class="row">
        <span class="row-label">{{ row.label }}</span>
        <span class="row-value" :class="{ mono: row.mono }" :title="row.value">
          {{ row.value }}
        </span>
      </div>
    </div>

    <el-alert
      v-if="status?.legacyPack"
      type="warning"
      :closable="false"
      show-icon
    >
      检测到旧版发布包引擎（engine/state.json），控制台已不再维护它。
      请准备含 toolkit 的完整脚本目录，并在启动页重新选择。
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

    <div class="card">
      <div class="row">
        <div class="row-text">
          <div class="row-title">启动页</div>
          <div class="row-desc">
            选择脚本目录、编辑 deploy.yaml、查看启动日志、启动/停止服务
          </div>
        </div>
        <el-button size="small" type="primary" @click="onOpenStartup">
          打开启动页
        </el-button>
      </div>

      <div class="row">
        <div class="row-text">
          <div class="row-title">关闭脚本服务</div>
          <div class="row-desc">
            {{ running ? `当前运行中，端口 ${status?.port ?? '—'}` : '当前没有运行中的服务' }}
          </div>
        </div>
        <el-button
          size="small"
          type="danger"
          plain
          :disabled="!running && !busy"
          @click="onStop"
        >
          {{ tr('kill_oas_server') }}
        </el-button>
      </div>

      <div class="row">
        <div class="row-text">
          <div class="row-title">退出登录</div>
          <div class="row-desc">回到连接页，重新填写服务地址</div>
        </div>
        <el-button size="small" @click="onLogout">{{ tr('log_out') }}</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service {
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

.row-label {
  font-size: 13px;
  font-weight: 600;
  flex: none;
}

.row-value {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
  max-width: 62%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-value.mono {
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
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
  word-break: break-all;
}
</style>
