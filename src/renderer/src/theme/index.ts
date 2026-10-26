import type { GlobalThemeOverrides } from 'naive-ui'

/** 全局字体栈：小米字体优先，缺失时退回系统字体 */
export const FONT_SANS =
  "'MiSans VF', 'MiSans', -apple-system, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif"

export const FONT_MONO = "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace"

/** 品牌主色 */
const PRIMARY = '#2b6cf6'

const common: GlobalThemeOverrides['common'] = {
  fontFamily: FONT_SANS,
  fontFamilyMono: FONT_MONO,
  primaryColor: PRIMARY,
  primaryColorHover: '#4a83f8',
  primaryColorPressed: '#1f5ce0',
  primaryColorSuppl: '#4a83f8',
  borderRadius: '8px',
  borderRadiusSmall: '6px'
}

export const lightOverrides: GlobalThemeOverrides = {
  common,
  Layout: {
    siderColor: '#fafbfc',
    siderBorderColor: '#ebedf0'
  },
  Card: {
    borderColor: '#ebedf0'
  }
}

export const darkOverrides: GlobalThemeOverrides = {
  common,
  Layout: {
    siderColor: '#17181c'
  }
}
