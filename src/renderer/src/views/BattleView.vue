<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import PresetBar from '../components/battle/PresetBar.vue'
import SkillCard from '../components/battle/SkillCard.vue'
import BattleSettings from '../components/battle/BattleSettings.vue'
import IdentifyPanel from '../components/battle/IdentifyPanel.vue'
import { useBattle } from '../composables/useBattle'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { ScriptState, getStore } from '../composables/useScript'
import { tr } from '../i18n'

const { currentConfig } = useConfig()
const { status } = useEngine()
/** 手动起的服务/远程服务不归主进程管，能连上 WebSocket 就算就绪 */
const engineReady = computed(
  () => Boolean(status.value?.running || getStore(currentConfig.value).connected)
)

const battle = useBattle(() => currentConfig.value)
const {
  presets,
  presetId,
  builtin,
  common,
  order,
  disabledSet,
  orderedSkills,
  enabledCount,
  saving,
  justSaved,
  saveError,
  loading,
  error,
  identifyResult,
  identifying
} = battle

/** 批量操作：选中若干技能后统一启用/禁用 */
const batchMode = ref(false)
const selected = ref<string[]>([])

/** 识别会抢设备，脚本非空闲时后端直接拒绝，这里先把按钮禁掉 */
const scriptRunning = computed(() => getStore(currentConfig.value).state !== ScriptState.INACTIVE)

function toggleBatch(): void {
  batchMode.value = !batchMode.value
  selected.value = []
}

function pick(id: string, checked: boolean): void {
  selected.value = checked
    ? [...new Set([...selected.value, id])]
    : selected.value.filter((item) => item !== id)
}

function selectAll(): void {
  selected.value = orderedSkills.value.map((skill) => skill.id)
}

function batchSet(enabled: boolean): void {
  battle.setManyEnabled(selected.value, enabled)
  selected.value = []
}

/** 技能 + 职业色块一起算一次，避免每张卡片都去查表 */
const cards = computed(() =>
  orderedSkills.value.map((skill) => {
    const cls = battle.classOf(skill)
    return {
      skill,
      tone: cls?.color || '#8a8a8a',
      label: cls?.name || skill.className || tr('battle_class_unknown')
    }
  })
)

watch(
  engineReady,
  (ready) => {
    if (ready) void battle.load()
  },
  { immediate: true }
)

watch(currentConfig, () => {
  batchMode.value = false
  selected.value = []
})
</script>

<template>
  <div class="battle">
    <el-empty v-if="!engineReady" :image-size="90">
      <template #description>
        <p class="empty-title">引擎还没启动</p>
        <p class="hint">先到设置里的「脚本服务」启动引擎，再回来配置战斗</p>
      </template>
    </el-empty>

    <el-alert v-else-if="error" type="error" :closable="false" show-icon class="error">
      <div class="error-body">
        <span>{{ error }}</span>
        <el-button size="small" @click="battle.load()">重试</el-button>
      </div>
    </el-alert>

    <div v-else class="grid" v-loading="loading">
      <div class="main">
        <preset-bar
          :model-value="presetId"
          :presets="presets"
          :builtin="builtin"
          :saving="saving"
          :saved="justSaved"
          :save-error="saveError"
          :enabled-count="enabledCount"
          :total="order.length"
          @update:model-value="battle.selectPreset"
          @create="battle.createPreset"
          @rename="battle.renamePreset"
          @delete="battle.deletePreset"
          @reset="battle.resetOrder"
        />

        <div class="tools">
          <span class="hint">{{ tr('battle_priority_hint') }}</span>
          <el-button text size="small" @click="toggleBatch">
            {{ batchMode ? '退出批量' : '批量操作' }}
          </el-button>
        </div>

        <div v-if="batchMode" class="batch">
          <el-button size="small" @click="selectAll">{{ tr('battle_select_all') }}</el-button>
          <el-button size="small" @click="selected = []">{{ tr('battle_select_none') }}</el-button>
          <span class="sel">已选 {{ selected.length }} 个</span>
          <el-button size="small" :disabled="selected.length === 0" @click="batchSet(true)">
            {{ tr('battle_batch_enable') }}
          </el-button>
          <el-button size="small" :disabled="selected.length === 0" @click="batchSet(false)">
            {{ tr('battle_batch_disable') }}
          </el-button>
        </div>

        <vue-draggable
          v-model="order"
          class="cards"
          :animation="160"
          handle=".drag-handle"
          ghost-class="ghost"
          chosen-class="chosen"
          :disabled="builtin"
          @end="battle.queuePresetSave()"
        >
          <skill-card
            v-for="(card, index) in cards"
            :key="card.skill.id"
            :skill="card.skill"
            :index="index"
            :disabled="disabledSet.has(card.skill.id)"
            :builtin="builtin"
            :batch-mode="batchMode"
            :selected="selected.includes(card.skill.id)"
            :tone="card.tone"
            :class-label="card.label"
            @toggle="battle.setSkillEnabled(card.skill.id, $event)"
            @pick="pick(card.skill.id, $event)"
            @move="battle.moveSkill(card.skill.id, $event)"
            @top="battle.moveTop(card.skill.id)"
          />
        </vue-draggable>

        <el-empty
          v-if="!loading && orderedSkills.length === 0"
          :image-size="70"
          description="技能目录是空的，先更新引擎"
        />
      </div>

      <aside class="side">
        <battle-settings :common="common" @change="battle.saveCommon" />
        <identify-panel
          :result="identifyResult"
          :loading="identifying"
          :running="scriptRunning"
          @identify="battle.runIdentify()"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.battle {
  min-height: 200px;
}

.empty-title {
  margin: 0 0 4px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.6;
}

.error-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.grid {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.side {
  flex: 0 0 336px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 0;
}

.tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px;
}

.batch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.sel {
  margin-left: auto;
  margin-right: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(188px, 1fr));
  gap: 10px;
  min-height: 60px;
}

/* 拖动中的占位与浮起的卡片 */
.cards :deep(.ghost) {
  opacity: 0.35;
  border-style: dashed;
}

.cards :deep(.chosen) {
  box-shadow: var(--el-box-shadow);
}

@media (max-width: 1200px) {
  .grid {
    flex-direction: column;
  }

  .side {
    position: static;
    flex: none;
    width: 100%;
    flex-direction: row;
    align-items: flex-start;
  }

  .side > * {
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 860px) {
  .side {
    flex-direction: column;
  }

  .side > * {
    width: 100%;
  }
}
</style>
