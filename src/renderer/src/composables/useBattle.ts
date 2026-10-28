import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  battleApi,
  type BattleCatalog,
  type BattleClass,
  type BattleCommon,
  type BattleIdentifyResult,
  type BattlePreset,
  type BattleSkill
} from '../api/http'
import { tr } from '../i18n'

/** 预设改动（拖动/开关）600ms 防抖；通用设置 500ms */
const PRESET_DELAY = 600
const COMMON_DELAY = 500

/**
 * 战斗页状态。
 *
 * 后端所有写操作都返回「保存后的完整 catalog」，这里拿到就整体覆盖，
 * 不用自己拼数据。拖动过程中本地数组先变，落盘失败再 reload 回滚。
 */
export function useBattle(config: () => string) {
  const catalog = ref<BattleCatalog | null>(null)
  const loading = ref(false)
  const error = ref('')
  /** 有请求在飞：工具栏显示「保存中…」 */
  const saving = ref(false)
  /** 刚保存成功：工具栏短暂显示「已保存」 */
  const justSaved = ref(false)
  /** 最近一次保存失败的原因：常驻显示，直到下次成功 */
  const saveError = ref('')
  let inflight = 0
  let savedTimer: ReturnType<typeof setTimeout> | null = null

  const presetId = ref('default')
  const order = ref<string[]>([])
  const disabled = ref<string[]>([])

  const identifyResult = ref<BattleIdentifyResult | null>(null)
  const identifying = ref(false)

  const skillsById = computed(
    () => new Map((catalog.value?.skills ?? []).map((skill) => [skill.id, skill]))
  )
  const classesById = computed(
    () => new Map((catalog.value?.classes ?? []).map((item) => [item.id, item]))
  )
  const presets = computed<BattlePreset[]>(() => catalog.value?.presets ?? [])
  const preset = computed(
    () => presets.value.find((item) => item.id === presetId.value) ?? presets.value[0] ?? null
  )
  /** 内建默认预设：不落盘、不可修改 */
  const builtin = computed(() => preset.value?.builtin !== false)
  const common = computed<BattleCommon | null>(() => catalog.value?.common ?? null)

  const orderedSkills = computed(() =>
    order.value
      .map((id) => skillsById.value.get(id))
      .filter((skill): skill is BattleSkill => Boolean(skill))
  )
  const disabledSet = computed(() => new Set(disabled.value))
  const enabledCount = computed(
    () => order.value.filter((id) => !disabledSet.value.has(id)).length
  )

  function classOf(skill: BattleSkill): BattleClass | undefined {
    return classesById.value.get(skill.class)
  }

  function applyCatalog(next: BattleCatalog, keepLocalOrder = false): void {
    catalog.value = next
    if (!next.presets.some((item) => item.id === presetId.value)) {
      presetId.value = next.presets[0]?.id ?? 'default'
    }
    if (keepLocalOrder) return
    const current = next.presets.find((item) => item.id === presetId.value)
    order.value = [...(current?.order ?? [])]
    disabled.value = [...(current?.disabled ?? [])]
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      applyCatalog(await battleApi.catalog(config()))
    } catch (e) {
      error.value = e instanceof Error ? e.message : '读取战斗配置失败'
      catalog.value = null
    } finally {
      loading.value = false
    }
  }

  function selectPreset(id: string): void {
    presetId.value = id
    const target = presets.value.find((item) => item.id === id)
    order.value = [...(target?.order ?? [])]
    disabled.value = [...(target?.disabled ?? [])]
    identifyResult.value = null
  }

  // ---------------------------------------------------------------- 预设保存

  let presetTimer: ReturnType<typeof setTimeout> | null = null
  let commonTimer: ReturnType<typeof setTimeout> | null = null
  /** 请求序号：只认最后一次响应，避免慢请求把新状态覆盖回去 */
  let seq = 0

  function beginSave(): void {
    inflight += 1
    saving.value = true
    saveError.value = ''
  }

  function endSave(): void {
    inflight = Math.max(0, inflight - 1)
    saving.value = inflight > 0
  }

  /** 成功反馈：工具栏短暂显示「已保存」+ 合并的 toast（连续拖动不会刷屏） */
  function reportSaved(): void {
    justSaved.value = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      justSaved.value = false
    }, 1800)
    ElMessage.success({ message: tr('battle_saved'), duration: 1200, grouping: true })
  }

  function reportError(message: string): void {
    saveError.value = message
    ElMessage.error({ message, grouping: true })
  }

  /** 拖动/开关后调用：先把本地改完，再防抖落盘 */
  function queuePresetSave(): void {
    if (builtin.value) return
    if (presetTimer) clearTimeout(presetTimer)
    presetTimer = setTimeout(() => {
      presetTimer = null
      void flushPreset()
    }, PRESET_DELAY)
  }

  async function flushPreset(): Promise<void> {
    if (builtin.value || !preset.value) return
    const my = ++seq
    beginSave()
    try {
      const next = await battleApi.updatePreset(config(), {
        id: preset.value.id,
        order: [...order.value],
        disabled: [...disabled.value]
      })
      // 拖动可能已经又改了本地数组，此时不能用响应覆盖
      applyCatalog(next, presetTimer !== null)
      if (my === seq) reportSaved()
    } catch (e) {
      if (my === seq) {
        reportError(e instanceof Error ? e.message : '保存失败')
        await load()
      }
    } finally {
      endSave()
    }
  }

  // ---------------------------------------------------------------- 预设增删改

  async function createPreset(name: string, base: string): Promise<boolean> {
    const before = new Set(presets.value.map((item) => item.id))
    try {
      const next = await battleApi.createPreset(config(), { name, base })
      catalog.value = next
      const created = next.presets.find((item) => !before.has(item.id))
      selectPreset(created?.id ?? next.presets[0]?.id ?? 'default')
      ElMessage.success('预设已创建')
      return true
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '创建预设失败')
      return false
    }
  }

  async function renamePreset(name: string): Promise<boolean> {
    if (!preset.value) return false
    try {
      applyCatalog(await battleApi.updatePreset(config(), { id: preset.value.id, name }))
      ElMessage.success('已重命名')
      return true
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '重命名失败')
      return false
    }
  }

  async function deletePreset(): Promise<boolean> {
    if (!preset.value || builtin.value) return false
    const id = preset.value.id
    try {
      catalog.value = await battleApi.deletePreset(config(), id)
      presetId.value = 'default'
      selectPreset('default')
      ElMessage.success('预设已删除')
      return true
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '删除预设失败')
      return false
    }
  }

  async function resetOrder(): Promise<boolean> {
    if (!preset.value || builtin.value) return false
    try {
      applyCatalog(await battleApi.resetPreset(config(), preset.value.id))
      ElMessage.success('已恢复默认顺序')
      return true
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '恢复失败')
      return false
    }
  }

  // ---------------------------------------------------------------- 技能开关与排序

  function setSkillEnabled(skillId: string, enabled: boolean): void {
    if (builtin.value) return
    const next = new Set(disabled.value)
    if (enabled) next.delete(skillId)
    else next.add(skillId)
    disabled.value = [...next]
    queuePresetSave()
  }

  function setManyEnabled(skillIds: string[], enabled: boolean): void {
    if (builtin.value || skillIds.length === 0) return
    const next = new Set(disabled.value)
    for (const id of skillIds) {
      if (enabled) next.delete(id)
      else next.add(id)
    }
    disabled.value = [...next]
    queuePresetSave()
  }

  /** 上移/下移/置顶：拖动之外的键盘友好入口 */
  function moveSkill(skillId: string, delta: number): void {
    if (builtin.value) return
    const list = [...order.value]
    const from = list.indexOf(skillId)
    if (from < 0) return
    const to = Math.min(list.length - 1, Math.max(0, from + delta))
    if (to === from) return
    list.splice(from, 1)
    list.splice(to, 0, skillId)
    order.value = list
    queuePresetSave()
  }

  function moveTop(skillId: string): void {
    if (builtin.value) return
    const list = [...order.value]
    const from = list.indexOf(skillId)
    if (from <= 0) return
    list.splice(from, 1)
    list.unshift(skillId)
    order.value = list
    queuePresetSave()
  }

  // ---------------------------------------------------------------- 通用设置

  function saveCommon(patch: Partial<BattleCommon>): void {
    if (!catalog.value) return
    catalog.value = { ...catalog.value, common: { ...catalog.value.common, ...patch } }
    if (commonTimer) clearTimeout(commonTimer)
    commonTimer = setTimeout(async () => {
      commonTimer = null
      if (!catalog.value) return
      const my = ++seq
      beginSave()
      try {
        const next = await battleApi.setCommon(config(), catalog.value.common)
        applyCatalog(next, presetTimer !== null)
        if (my === seq) reportSaved()
      } catch (e) {
        if (my === seq) reportError(e instanceof Error ? e.message : '保存战斗设置失败')
      } finally {
        endSave()
      }
    }, COMMON_DELAY)
  }

  // ---------------------------------------------------------------- 识别预览

  async function runIdentify(): Promise<void> {
    identifying.value = true
    identifyResult.value = null
    try {
      identifyResult.value = await battleApi.identify(config(), preset.value?.id ?? 'default')
    } catch (e) {
      identifyResult.value = {
        ok: false,
        message: e instanceof Error ? e.message : '识别失败'
      }
    } finally {
      identifying.value = false
    }
  }

  return {
    catalog,
    loading,
    error,
    saving,
    justSaved,
    saveError,
    presets,
    presetId,
    preset,
    builtin,
    common,
    order,
    disabled,
    disabledSet,
    orderedSkills,
    enabledCount,
    identifyResult,
    identifying,
    classOf,
    load,
    selectPreset,
    queuePresetSave,
    createPreset,
    renamePreset,
    deletePreset,
    resetOrder,
    setSkillEnabled,
    setManyEnabled,
    moveSkill,
    moveTop,
    saveCommon,
    runIdentify
  }
}
