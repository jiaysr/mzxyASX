<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '../api'
import { anyScriptRunning } from '../composables/useScript'

/**
 * 关窗确认。
 *
 * 主进程只在「引擎由本应用拉起」时拦下关闭并通知这里；
 * 界面再看有没有脚本在跑：没有就直接放行，有才弹这个框。
 */
const visible = ref(false)
const busy = ref(false)

let off: (() => void) | null = null

function onCloseRequest(): void {
  if (!anyScriptRunning()) {
    void api.close.confirm()
    return
  }
  visible.value = true
}

function cancel(): void {
  visible.value = false
}

async function confirm(): Promise<void> {
  busy.value = true
  try {
    await api.close.confirm()
  } finally {
    busy.value = false
    visible.value = false
  }
}

onMounted(() => {
  off = api.close.onRequest(onCloseRequest)
})

onBeforeUnmount(() => {
  off?.()
  off = null
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    :close-on-click-modal="false"
    align-center
    width="392px"
    class="close-confirm"
    @closed="cancel"
  >
    <template #header>
      <span class="title">关闭窗口？</span>
    </template>

    <p class="desc">
      引擎由本应用启动，当前有脚本正在运行。退出应用会一并停止本地脚本服务，正在执行的任务会被中断。
    </p>

    <template #footer>
      <el-button :disabled="busy" @click="cancel">取消</el-button>
      <el-button type="danger" plain :loading="busy" @click="confirm">停止并退出</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
</style>

<style>
/* 弹窗本体：去掉默认的分隔线和多余留白，贴近系统级确认框的观感 */
.close-confirm .el-dialog__header {
  padding: 20px 20px 0;
  margin-right: 0;
}

.close-confirm .el-dialog__body {
  padding: 8px 20px 0;
}

.close-confirm .el-dialog__footer {
  padding: 20px;
}

.close-confirm .el-dialog__footer .el-button + .el-button {
  margin-left: 8px;
}
</style>
