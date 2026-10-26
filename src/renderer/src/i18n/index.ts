import { ref } from 'vue'

/**
 * 词条翻译
 *
 * 引擎自带 `assets/i18n/zh-CN.json`（346 条），通过 `/home/additional_translate` 暴露。
 * 缺的词条原样显示英文键——原 Flutter 版也是这个行为。
 * 这里额外补一小份常用词条，避免菜单和调度器字段全是英文。
 */
/** 菜单分组名单独一套：分组和任务可能同名（Script 既是分组又是任务） */
const GROUP_LOCAL: Record<string, string> = {
  'Daily Task': '日常任务',
  'Battle Task': '战斗任务',
  Script: '脚本设置',
  Overview: '总览',
  Dungeon: '副本玩法',
  Home: '主页',
  Updater: '更新',
  Tool: '工具'
}

const LOCAL: Record<string, string> = {
  // 调度器
  scheduler: '调度器',
  Enable: '启用',
  enable_help: '勾选后该任务会进入调度队列',
  'Next Run': '下次运行',
  next_run_help: '该任务下一次执行的时间',
  Priority: '优先级',
  priority_help: '数字越小越优先执行',
  'Success Interval': '成功后间隔',
  success_interval_help: '任务成功后，隔多久再次运行',
  'Failure Interval': '失败后间隔',
  failure_interval_help: '任务失败后，隔多久重试',
  'Server Update': '服务器刷新时间',
  server_update_help: '每天几点刷新日常，用于计算下次运行时间',
  'Scheduler Enable': '启用调度',
  scheduler_enable_help: '关闭后该任务不会被自动调度',
  'Next Run Rule': '下次运行规则',
  next_run_rule_help: '手动指定下次运行时间',
  // 通用
  Success: '成功',
  Failure: '失败',
  'Run Now': '立即运行',
  'Last Run': '上次运行'
}

const dict = ref<Record<string, string>>({})
let loaded = false

/** 用引擎返回的词条覆盖本地兜底 */
export function setTranslate(map: Record<string, string>): void {
  dict.value = map
  loaded = true
}

export function isTranslateLoaded(): boolean {
  return loaded
}

/** 取词条：引擎优先 → 本地兜底 → 原键 */
export function tr(key: string | undefined | null): string {
  if (!key) return ''
  return dict.value[key] ?? LOCAL[key] ?? key
}

/** 菜单分组名：先查分组专用表，再走通用逻辑 */
export function trGroup(key: string): string {
  return GROUP_LOCAL[key] ?? tr(key)
}
