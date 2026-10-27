<script setup lang="ts">
import { computed } from 'vue'
import appIcon from '../../assets/icon.png'
import { useAnnouncement } from '../../composables/useAnnouncement'
import { useAppUpdate } from '../../composables/useAppUpdate'
import { useEngine } from '../../composables/useEngine'

const { info } = useAppUpdate()

const { open: openAnnouncement } = useAnnouncement()
const { rootDir } = useEngine()

const rows = computed(() => [
  { label: '控制台版本', value: info.value ? `v${info.value.version}` : '—' },
  { label: '运行方式', value: info.value?.packaged ? '已安装' : '开发模式' },
  { label: '存放位置', value: rootDir.value || '—', mono: true }
])

const links = [
  { label: '脚本仓库', url: 'https://github.com/jiaysr/mzxyAutoScript' },
  { label: '控制台仓库', url: 'https://github.com/jiaysr/mzxyASX' }
]
</script>

<template>
  <div class="about">
    <div class="card">
      <div class="brand">
        <img class="mark" :src="appIcon" alt="明珠轩辕" />
        <div>
          <div class="name">明珠轩辕 · 脚本控制台</div>
          <div class="sub">界面基于 Electron + Vue 3 + Element Plus，字体为小米 MiSans</div>
        </div>
      </div>

      <div v-for="row in rows" :key="row.label" class="row">
        <span class="row-label">{{ row.label }}</span>
        <span class="row-value" :class="{ mono: row.mono }">{{ row.value }}</span>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <span class="row-label">公告</span>
        <el-button
          size="small"
          text
          type="primary"
          class="row-action"
          @click="openAnnouncement"
        >
          查看
        </el-button>
      </div>

      <div v-for="link in links" :key="link.label" class="row">
        <span class="row-label">{{ link.label }}</span>
        <a class="link" :href="link.url" target="_blank" rel="noreferrer">{{ link.url }}</a>
      </div>
      <div class="row">
        <span class="row-label">协议</span>
        <span class="row-value">GPL-3.0</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
.about {
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

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  object-fit: cover;
  flex: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.name {
  font-size: 14px;
  font-weight: 600;
}

.sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 44px;
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
  text-align: right;
  word-break: break-all;
}

.row-value.mono {
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
}

.row-action {
  margin-left: auto;
}

.link {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--el-color-primary);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
</style>
