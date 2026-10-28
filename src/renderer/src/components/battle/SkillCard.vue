<script setup lang="ts">
import { ref, watch } from 'vue'
import { assetUrl, type BattleSkill } from '../../api/http'
import { tr } from '../../i18n'

const props = defineProps<{
  skill: BattleSkill
  index: number
  disabled: boolean
  builtin: boolean
  batchMode: boolean
  selected: boolean
  tone: string
  classLabel: string
}>()

const emit = defineEmits<{
  toggle: [enabled: boolean]
  pick: [checked: boolean]
  move: [delta: number]
  top: []
}>()

const iconFailed = ref(false)
watch(
  () => props.skill.id,
  () => {
    iconFailed.value = false
  }
)
</script>

<template>
  <div
    class="card"
    :class="{ off: disabled, locked: builtin, picked: batchMode && selected }"
  >
    <div class="card-top">
      <span class="idx drag-handle" :class="{ locked: builtin }" :title="`#${index + 1}`">
        {{ index + 1 }}
      </span>
      <img
        v-if="!iconFailed"
        class="icon"
        :src="assetUrl(skill.iconUrl)"
        :alt="skill.name"
        draggable="false"
        @error="iconFailed = true"
      />
      <span v-else class="icon fallback">{{ skill.name.slice(0, 1) }}</span>
      <el-checkbox
        v-if="batchMode"
        class="pick"
        :model-value="selected"
        :disabled="builtin"
        @update:model-value="emit('pick', Boolean($event))"
      />
      <el-switch
        v-else
        class="power"
        size="small"
        :model-value="!disabled"
        :disabled="builtin"
        @update:model-value="emit('toggle', Boolean($event))"
      />
    </div>

    <div class="name" :title="skill.name">{{ skill.name }}</div>

    <div class="meta">
      <span class="tone" :style="{ color: tone, backgroundColor: `${tone}1f` }">
        {{ classLabel }}
      </span>
      <span v-if="skill.cooldown > 0" class="cd">{{ skill.cooldown }}s</span>
      <span v-if="disabled" class="off-tag">{{ tr('battle_skill_disabled') }}</span>
    </div>

    <div class="desc" :title="skill.description">{{ skill.description }}</div>

    <div class="ops">
      <button type="button" :disabled="builtin" title="置顶" @click="emit('top')">⇱</button>
      <button type="button" :disabled="builtin" title="上移" @click="emit('move', -1)">↑</button>
      <button type="button" :disabled="builtin" title="下移" @click="emit('move', 1)">↓</button>
    </div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 132px;
  padding: 10px 12px 8px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    opacity 0.15s;
}

.card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-light);
}

.card.off {
  opacity: 0.62;
}

.card.off .name {
  text-decoration: line-through;
  color: var(--el-text-color-secondary);
}

.card.off .icon {
  filter: grayscale(1);
}

.card.locked {
  cursor: default;
}

.card.picked {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 序号就是拖拽手柄 */
.idx {
  flex: 0 0 auto;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 6px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  cursor: grab;
  user-select: none;
}

.idx:active {
  cursor: grabbing;
}

.idx.locked {
  cursor: default;
}

.icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--el-fill-color-light);
}

.icon.fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.power,
.pick {
  margin-left: auto;
}

.name {
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.tone {
  padding: 0 6px;
  border-radius: 6px;
  line-height: 17px;
  font-weight: 500;
}

.cd {
  font-variant-numeric: tabular-nums;
}

.off-tag {
  color: var(--el-color-warning);
}

.desc {
  flex: 1;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--el-text-color-placeholder);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 鼠标悬停才露出排序按钮，平时不抢视线 */
.ops {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.15s;
}

.card:hover .ops {
  opacity: 1;
}

.ops button {
  width: 22px;
  height: 20px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}

.ops button:hover:not(:disabled) {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}

.ops button:disabled {
  cursor: default;
  opacity: 0.35;
}
</style>
