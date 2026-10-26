import { ref } from 'vue'

/**
 * 词条与语言
 *
 * 中文：引擎自带 `assets/i18n/zh-CN.json`（346 条）+ 本地兜底
 * 英文：直接用键名（引擎的键本来就是英文，例如 `WorldBoss`、`quiz_config`）
 *
 * 缺词条时原样显示键名——原 Flutter 版也是这个行为。
 */
const LOCALE_KEY = 'mzxy.locale'

/** 菜单分组名单独一套：分组和任务可能同名（Script 既是分组又是任务） */
const GROUP_LOCAL: Record<'zh-CN' | 'en-US', Record<string, string>> = {
  'zh-CN': {
    'Daily Task': '日常任务',
    'Battle Task': '战斗任务',
    Script: '脚本设置',
    Overview: '总览',
    Dungeon: '副本玩法',
    Home: '主页',
    Updater: '更新',
    Tool: '工具'
  },
  'en-US': {
    'Daily Task': 'Daily Task',
    'Battle Task': 'Battle Task',
    Script: 'Script',
    Overview: 'Overview',
    Dungeon: 'Dungeon',
    Home: 'Home',
    Updater: 'Updater',
    Tool: 'Tool'
  }
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
  'Delay Date': '延迟天数',
  'Float Time': '浮动时间',
  // 界面
  running: '运行中',
  pending: '队列中',
  waiting: '等待中',
  log: '日志',
  clear_log: '清空',
  copy_log: '复制',
  auto_scroll: '自动滚动',
  collapse: '折叠',
  task_setting: '设置',
  current_version: '当前版本',
  current_branch: '当前分支',
  execute_update: '执行更新',
  find_oas_new_version: '发现新版本',
  oas_latest_version: '已是最新',
  detailed_submission_history: '提交历史',
  author: '作者',
  submit_time: '提交时间',
  submit_info: '提交信息',
  local_repo: '本地',
  remote_repo: '远程',
  notify_test: '推送测试',
  notify_test_config: '推送配置',
  notify_test_help: '请翻阅文档「消息推送」填写相关配置',
  notify_test_title: '发送主题',
  notify_test_content: '发送内容',
  notify_test_send: '点击测试',
  notify_test_success: '推送成功',
  notify_test_failed: '推送失败',
  export_diagnostic: '导出诊断',
  export_diagnostic_help: '把日志和配置打包，便于排查问题',
  export_diagnostic_button: '导出',
  export_diagnostic_done: '已导出到：',
  export_diagnostic_failed: '导出失败',
  change_theme: '切换主题',
  change_language: '切换语言',
  zh_cn: '简体中文',
  en_us: 'English',
  kill_oas_server: '关闭脚本服务',
  are_you_sure_kill: '确定关闭脚本服务吗？',
  log_out: '退出登录',
  no_config: '没有可配置项'
}

const dict = ref<Record<string, string>>({})
const locale = ref<'zh-CN' | 'en-US'>(
  (localStorage.getItem(LOCALE_KEY) as 'zh-CN' | 'en-US' | null) ?? 'zh-CN'
)

/** 用引擎返回的词条覆盖本地兜底 */
export function setTranslate(map: Record<string, string>): void {
  dict.value = map
}

/** 取词条：中文走引擎词条 + 本地兜底，英文直接用键名 */
export function tr(key: string | undefined | null): string {
  if (!key) return ''
  if (locale.value === 'en-US') return key
  return dict.value[key] ?? LOCAL[key] ?? key
}

/** 菜单分组名 */
export function trGroup(key: string): string {
  return GROUP_LOCAL[locale.value][key] ?? tr(key)
}

export function useLocale() {
  function setLocale(next: 'zh-CN' | 'en-US'): void {
    locale.value = next
    localStorage.setItem(LOCALE_KEY, next)
  }
  return { locale, setLocale }
}
