<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MarkdownIt from 'markdown-it'

// README 里有 <div align="center"> 这类原始 HTML，必须允许，否则会被当成文本显示
const md = new MarkdownIt({ html: true, linkify: true, breaks: true })
const html = ref('')
const loading = ref(true)

const FALLBACK = `# 明珠轩辕 脚本控制台

欢迎使用。左侧选择配置，二级菜单里挑任务改参数。

## 上手

1. 到「设置 → 脚本服务」确认引擎已启动
2. 左侧选中配置（\`oas1\`），二级菜单点「总览」看调度状态
3. 点具体任务（例如「每日答题」）修改参数，改完自动保存
4. 总览页点「启动脚本」开始托管

## 说明

- 脚本本体来自 mzxyAutoScript，通过 Release 独立更新
- 引擎和数据都在一个目录里，整个拷走就能用
`

onMounted(async () => {
  try {
    // 必须带超时：GitHub 直连被墙时 fetch 会一直挂着，
    // 加载遮罩就永远盖在页面上，用户看到一张空白卡
    const res = await fetch('https://raw.githubusercontent.com/jiaysr/mzxyAutoScript/dev/README.md', {
      signal: AbortSignal.timeout(6000)
    })
    if (res.ok) html.value = md.render(await res.text())
  } catch {
    /* 网络不通就用内置文案 */
  } finally {
    if (!html.value) html.value = md.render(FALLBACK)
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading" class="home-wrap">
    <el-card shadow="never" class="home">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="markdown selectable" v-html="html" />
    </el-card>
  </div>
</template>

<style scoped>
.home-wrap {
  min-height: 200px;
}

.home {
  max-width: 860px;
  margin: 0 auto;
  border-radius: 10px;
}

.markdown {
  font-size: 13px;
  line-height: 1.85;
  color: var(--el-text-color-regular);
}

.markdown :deep(h1) {
  font-size: 20px;
  margin: 0 0 12px;
  color: var(--el-text-color-primary);
}

.markdown :deep(h2) {
  font-size: 15px;
  margin: 20px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-primary);
}

.markdown :deep(h3) {
  font-size: 13.5px;
  margin: 14px 0 6px;
  color: var(--el-text-color-primary);
}

.markdown :deep(p) {
  margin: 8px 0;
}

.markdown :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
}

.markdown :deep(pre) {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  overflow-x: auto;
}

.markdown :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown :deep(img) {
  max-width: 100%;
  height: 20px;
  vertical-align: middle;
}

.markdown :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 10px 0;
}

.markdown :deep(th),
.markdown :deep(td) {
  border: 1px solid var(--el-border-color-light);
  padding: 6px 10px;
  text-align: left;
}

.markdown :deep(ul) {
  padding-left: 20px;
}

.markdown :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}
</style>
