<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useEngine } from '../../composables/useEngine'
import { useSession } from '../../composables/useSession'
import { tr } from '../../i18n'

const { status, start, stop } = useEngine()
const { logout } = useSession()
const router = useRouter()

const busy = ref(false)

const engineReady = computed(() => Boolean(status.value?.running))
const canStart = computed(() => Boolean(status.value?.installed) && !engineReady.value)

const rows = computed(() => [
  { label: '状态', value: engineReady.value ? '运行中' : status.value?.installed ? '已停止' : '未安装' },
  { label: '端口', value: String(status.value?.port ?? '—') },
  { label: '代码版本', value: status.value?.codeVersion ?? '—' }
])

function onLogout(): void {
  logout()
  void router.replace({ name: 'login' })
}

async function onStartEngine(): Promise<void> {
  busy.value = true
  try {
    const message = await start()
    // start() 内部已刷新状态，按结果给成功或失败提示
    if (status.value?.running) ElMessage.success(message)
    else ElMessage.error(message)
  } finally {
    busy.value = false
  }
}

async function onKillServer(): Promise<void> {
  try {
    await ElMessageBox.confirm('会停止本地脚本服务，正在跑的任务会中断。', tr('are_you_sure_kill'), {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  busy.value = true
  try {
    ElMessage.info(await stop())
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="service">
    <div class="card">
      <div v-for="row in rows" :key="row.label" class="row">
        <span class="row-label">{{ row.label }}</span>
        <span class="row-value">{{ row.value }}</span>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <div class="row-text">
          <div class="row-title">启动脚本服务</div>
          <div class="row-desc">
            {{ status?.installed ? '按引擎目录里的 Python 起服务，端口由应用挑选' : '引擎还没安装，先到「更新设置」里下载' }}
          </div>
        </div>
        <el-button size="small" type="primary" :disabled="!canStart || busy" @click="onStartEngine">
          启动引擎
        </el-button>
      </div>

      <div class="row">
        <div class="row-text">
          <div class="row-title">关闭脚本服务</div>
          <div class="row-desc">停掉本机的 python 服务，正在跑的任务会中断</div>
        </div>
        <el-button size="small" type="danger" plain :disabled="!engineReady || busy" @click="onKillServer">
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
</style>
