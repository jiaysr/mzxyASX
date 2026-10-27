<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CustomThemeDialog from '../../components/CustomThemeDialog.vue'
import { BG_STYLES, useBackground, type BgStyle } from '../../composables/useBackground'
import { usePrefs } from '../../composables/usePrefs'
import { useTheme } from '../../composables/useTheme'
import { tr, useLocale } from '../../i18n'

const { mode, setMode, themes, activeId, setTheme, removeCustomTheme } = useTheme()
const {
  state: bg,
  hasImage,
  setStyle,
  setAnimation,
  setTransition,
  setImageOpacity,
  pickImage,
  clearImage
} = useBackground()
const { prefs: appPrefs, load: loadPrefs, save: savePrefs } = usePrefs()
const { locale, setLocale } = useLocale()

const dialog = ref(false)

const MODES = [
  { id: 'light' as const, label: '浅色' },
  { id: 'dark' as const, label: '深色' }
]

// ---------------------------------------------------------------- 字体缩放
/** 滑块要立刻跟手，所以先落到本地，再防抖写盘 */
const scaleDraft = ref(1)
let scaleTimer: number | undefined

onMounted(async () => {
  await loadPrefs()
  scaleDraft.value = appPrefs.uiScale
})

watch(
  () => appPrefs.uiScale,
  (v) => {
    // 别在拖动过程中被回写打断
    if (!scaleTimer) scaleDraft.value = v
  }
)

function onScaleInput(value: number | number[]): void {
  const next = Array.isArray(value) ? value[0] : value
  scaleDraft.value = next
  window.clearTimeout(scaleTimer)
  scaleTimer = window.setTimeout(async () => {
    scaleTimer = undefined
    const error = await savePrefs({ uiScale: next })
    if (error) ElMessage.error(error)
  }, 120)
}

function onLocaleChange(value: string | number | boolean | undefined): void {
  setLocale(value === 'en-US' ? 'en-US' : 'zh-CN')
}

function onStyleChange(value: string): void {
  setStyle(value as BgStyle)
}

/** 自定义主题可以删；内置的四套删不掉 */
async function onRemove(id: string, name: string): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除主题「${name}」吗？`, '删除主题', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  removeCustomTheme(id)
  ElMessage.success('已删除')
}

async function onPickImage(): Promise<void> {
  const error = await pickImage()
  if (error) ElMessage.error(error)
  else if (hasImage.value) ElMessage.success('背景图片已更新')
}

/** 只取文件名显示，完整路径放在 title 里 */
const imageName = (path: string): string => path.split(/[\\/]/).pop() ?? path
</script>

<template>
  <div class="ui">
    <!-- 亮 / 暗 -->
    <div class="modes">
      <button
        v-for="m in MODES"
        :key="m.id"
        class="mode-card"
        :class="[m.id, { active: mode === m.id }]"
        @click="setMode(m.id)"
      >
        <span v-if="mode === m.id" class="check">✓</span>
        <span class="mode-label">{{ m.label }}</span>
      </button>
    </div>

    <!-- 配色 -->
    <div class="palette">
      <button
        v-for="t in themes"
        :key="t.id"
        class="swatch"
        :class="{ active: activeId === t.id }"
        :title="t.builtin ? t.name : `${t.name}（右键或点 × 删除）`"
        @click="setTheme(t.id)"
        @contextmenu.prevent="t.builtin ? undefined : onRemove(t.id, t.name)"
      >
        <span class="ring">
          <span class="dot-primary" :style="{ background: t.primary }" />
          <span v-if="activeId === t.id" class="dot-check">✓</span>
          <span v-if="!t.builtin" class="remove" @click.stop="onRemove(t.id, t.name)">×</span>
        </span>
        <span class="swatch-name">{{ t.name }}</span>
      </button>
    </div>

    <!-- 自定义主题 -->
    <div class="card">
      <div class="card-text">
        <div class="card-title">创建自定义主题</div>
        <div class="card-desc">选一个主色，按钮、选中态、图标都会跟着换</div>
      </div>
      <el-button class="card-action" @click="dialog = true">自定义</el-button>
    </div>

    <!-- 背景样式 -->
    <div class="card block">
      <div class="card-head">
        <div class="card-title">背景样式</div>
        <div class="card-desc">主色决定背景的颜色倾向，纯色时就是默认底色</div>
      </div>

      <div class="row">
        <span class="row-label">样式</span>
        <el-select :model-value="bg.style" class="ctl" @update:model-value="onStyleChange">
          <el-option v-for="s in BG_STYLES" :key="s.id" :label="s.label" :value="s.id">
            <span class="opt-label">{{ s.label }}</span>
            <span class="opt-desc">{{ s.desc }}</span>
          </el-option>
        </el-select>
      </div>

      <div class="row">
        <span class="row-label">背景动画</span>
        <span class="row-hint">渐变缓慢平移、气泡缓慢漂移</span>
        <el-switch
          class="ctl-switch"
          :model-value="bg.animation"
          :disabled="bg.style === 'flat'"
          @update:model-value="setAnimation"
        />
      </div>

      <div class="row">
        <span class="row-label">背景过渡</span>
        <span class="row-hint">切换样式时淡入，不会硬切</span>
        <el-switch
          class="ctl-switch"
          :model-value="bg.transition"
          @update:model-value="setTransition"
        />
      </div>

      <div class="row">
        <span class="row-label">背景图片</span>
        <div class="ctl-group">
          <span v-if="hasImage" class="file-name" :title="bg.imagePath">
            {{ imageName(bg.imagePath) }}
          </span>
          <span v-else class="row-hint">未选择，支持 png / jpg / webp / bmp / gif</span>
          <el-button size="small" @click="onPickImage">选择</el-button>
          <el-button size="small" text :disabled="!hasImage" @click="clearImage">清除</el-button>
        </div>
      </div>

      <div v-if="hasImage" class="row">
        <span class="row-label">图片不透明度</span>
        <el-slider
          class="slider"
          :model-value="bg.imageOpacity"
          :min="0.05"
          :max="1"
          :step="0.05"
          :format-tooltip="(v: number) => `${Math.round(v * 100)}%`"
          @update:model-value="setImageOpacity"
        />
      </div>
    </div>

    <!-- 语言 -->
    <div class="card">
      <div class="card-text">
        <div class="card-title">{{ tr('change_language') }}</div>
        <div class="card-desc">切换界面语言，需要重新进入页面才会全部刷新</div>
      </div>
      <el-radio-group :model-value="locale" size="small" @update:model-value="onLocaleChange">
        <el-radio-button value="zh-CN">{{ tr('zh_cn') }}</el-radio-button>
        <el-radio-button value="en-US">{{ tr('en_us') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 字体大小缩放 -->
    <div class="card block">
      <div class="scale-head">
        <div class="scale-text">
          <div class="card-title">字体大小缩放</div>
          <div class="card-desc">调整界面字体的整体缩放比例，所有字体和图标将按比例放大或缩小</div>
        </div>
        <span class="scale-value">{{ Math.round(scaleDraft * 100) }}%</span>
      </div>

      <div class="scale-slider">
        <el-slider
          :model-value="scaleDraft"
          :min="0.8"
          :max="1.5"
          :step="0.05"
          :show-tooltip="false"
          @update:model-value="onScaleInput"
        />
      </div>
    </div>

    <custom-theme-dialog v-model="dialog" />
  </div>
</template>

<style scoped>
.ui {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  padding: 26px 0 8px;
}

/* ---------------- 亮 / 暗 ---------------- */
.modes {
  display: flex;
  gap: 20px;
}

.mode-card {
  position: relative;
  width: 215px;
  height: 160px;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 18px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.mode-card.light {
  background: #fafafa;
  color: #555;
  box-shadow: inset 0 0 0 1px var(--el-border-color-light);
}

.mode-card.dark {
  background: #222;
  color: #fafafa;
}

.mode-card.active {
  border-color: var(--el-color-primary);
}

.mode-label {
  font-size: 13px;
  font-weight: 600;
}

.check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---------------- 配色 ---------------- */
.palette {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.swatch {
  width: 84px;
  padding: 8px 6px 6px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  background: var(--el-bg-color);
  cursor: pointer;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.swatch:hover {
  border-color: var(--el-color-primary-light-5);
}

.swatch.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.ring {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dot-primary {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.dot-check {
  position: absolute;
  top: 0;
  right: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px var(--el-bg-color);
}

.remove {
  position: absolute;
  top: -4px;
  left: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--el-color-danger);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  display: none;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px var(--el-bg-color);
}

.swatch:hover .remove {
  display: flex;
}

.swatch-name {
  font-size: 12px;
  font-weight: 500;
  max-width: 68px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-regular);
}

/* ---------------- 说明卡片 ---------------- */
.card {
  width: 100%;
  max-width: 680px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.card-text {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.card-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.card-action {
  flex: none;
  min-width: 140px;
}

/* ---------------- 多行卡片（背景样式） ---------------- */
.card.block {
  display: block;
  padding: 18px 20px 12px;
}

.card-head {
  margin-bottom: 4px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
}

.row + .row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.row-label {
  font-size: 13px;
  font-weight: 600;
  flex: none;
  width: 96px;
}

.row-hint {
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.ctl {
  margin-left: auto;
  width: 215px;
  flex: none;
}

.ctl-switch {
  margin-left: auto;
}

.ctl-group {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.file-name {
  font-size: 12px;
  color: var(--el-text-color-regular);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slider {
  margin-left: auto;
  width: 215px;
  flex: none;
}

.opt-label {
  margin-right: 8px;
}

.opt-desc {
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
}

/* ---------------- 字体缩放 ---------------- */
.scale-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.scale-text {
  flex: 1;
  min-width: 0;
}

.scale-value {
  flex: none;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}

.scale-slider {
  padding: 6px 4px 0;
}
</style>
