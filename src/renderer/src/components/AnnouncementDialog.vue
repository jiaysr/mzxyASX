<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { useAnnouncement } from '../composables/useAnnouncement'

/**
 * 公告弹窗，布局参考原版 MFA：左边标题列表，右边 markdown 内容。
 *
 * 内容来自随应用打包的 `resources/announcements/*.md`，
 * 加公告只要往那个目录丢文件，不用改代码。
 *
 * 弹窗状态放在 useAnnouncement 里，全应用只挂这一个实例，
 * 自动弹出和设置页的手动入口共用。
 */
const { items, visible, loading, close, load, isMuted, setMuted } = useAnnouncement()

const md = new MarkdownIt({ html: true, linkify: true, breaks: true })

/** 公告类型：界面更新 / 脚本更新 / 普通公告，用颜色区分来源 */
const KIND_META = {
  ui: { label: '界面更新' },
  script: { label: '脚本更新' },
  notice: { label: '公告' }
} as const

const activeId = ref('')

const active = computed(() => items.value.find((item) => item.id === activeId.value))

const html = computed(() => (active.value ? md.render(active.value.content) : ''))

/** 「不再提示」只影响启动时的自动弹出，手动打开不受影响 */
const muted = computed({
  get: isMuted,
  set: (value: boolean) => setMuted(value)
})

watch(visible, async (open) => {
  if (!open) return
  await load()
  // 默认选中第一条，重新打开时保持上次看的那条
  if (!items.value.some((item) => item.id === activeId.value)) {
    activeId.value = items.value[0]?.id ?? ''
  }
})
</script>

<template>
  <el-dialog v-model="visible" title="公告" width="760px" append-to-body class="announcement">
    <div v-loading="loading" class="body">
      <aside class="side">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="side-item"
          :class="{ active: item.id === activeId }"
          @click="activeId = item.id"
        >
          <span class="dot" :class="item.kind" />
          <span class="side-title">{{ item.title }}</span>
        </button>
      </aside>

      <div class="content">
        <div v-if="active" class="chip" :class="active.kind">
          {{ KIND_META[active.kind].label }}
        </div>
        <div v-if="html" class="markdown" v-html="html"></div>
        <el-empty v-else :image-size="70" description="暂无公告" />
      </div>
    </div>

    <template #footer>
      <div class="footer">
        <el-checkbox v-model="muted" size="small">不再提示</el-checkbox>
        <el-button size="small" type="primary" @click="close">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.body {
  display: flex;
  gap: 16px;
  height: 420px;
  min-height: 0;
}

.side {
  flex: 0 0 168px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 10px;
}

.side-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

/* 列表里用一个小圆点表示来源，比塞一整块标签省地方 */
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  margin-top: 6px;
  background: var(--el-color-info);
}

.dot.ui {
  background: var(--el-color-primary);
}

.dot.script {
  background: var(--el-color-success);
}

.side-title {
  flex: 1;
  min-width: 0;
}

/* 正文上方标一下这条是什么类型 */
.chip {
  display: inline-block;
  margin-bottom: 8px;
  padding: 1px 8px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.7;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.chip.ui {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.chip.script {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.side-item:hover {
  background: var(--el-fill-color-light);
}

.side-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.content :deep(.el-empty) {
  height: 100%;
}

/* markdown 正文：和主页 README 的观感保持一致 */
.markdown {
  font-size: 13px;
  line-height: 1.75;
  color: var(--el-text-color-regular);
  word-break: break-word;
}

.markdown :deep(h1) {
  font-size: 18px;
  margin: 0 0 12px;
}

.markdown :deep(h2) {
  font-size: 15px;
  margin: 20px 0 8px;
}

.markdown :deep(h3) {
  font-size: 14px;
  margin: 16px 0 6px;
}

.markdown :deep(p) {
  margin: 8px 0;
}

.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown :deep(li) {
  margin: 4px 0;
}

.markdown :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

.markdown :deep(a:hover) {
  text-decoration: underline;
}

.markdown :deep(code) {
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
  background: var(--el-fill-color-light);
  padding: 1px 5px;
  border-radius: 4px;
}

.markdown :deep(hr) {
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
  margin: 16px 0;
}
</style>
