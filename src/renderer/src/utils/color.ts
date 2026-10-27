/** 十六进制颜色与 Element Plus 主色阶的计算 */

type RGB = [number, number, number]

/** 支持 #RGB / #RRGGBB（含 # 可选） */
export function parseHex(input: string): RGB | null {
  const hex = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16)
    ]
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ]
  }
  return null
}

function toHex([r, g, b]: RGB): string {
  const part = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** 与另一个颜色按比例混合，ratio 是 base 的占比 */
export function mix(color: string, base: string, ratio: number): string {
  const a = parseHex(color)
  const b = parseHex(base)
  if (!a || !b) return color
  const t = Math.max(0, Math.min(1, ratio))
  return toHex([
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t
  ])
}

/** 暗色模式下用来混 light 阶的底色，和 Element Plus 的 --el-bg-color 一致 */
const DARK_BASE = '#141414'

/**
 * 生成 Element Plus 的主色阶。
 *
 * 亮色：light-N = 主色向白色混 N/10
 * 暗色：light-N = 主色向 #141414 混 N/10（否则浅底会在暗色下亮成一块）
 * dark-2 则是反方向：亮色向黑、暗色向白。
 */
export function primaryRamp(primary: string, dark: boolean): Record<string, string> {
  const base = dark ? DARK_BASE : '#ffffff'
  const ramp: Record<string, string> = { '--el-color-primary': primary }
  for (const n of [3, 5, 7, 8, 9]) {
    ramp[`--el-color-primary-light-${n}`] = mix(primary, base, n / 10)
  }
  ramp['--el-color-primary-dark-2'] = dark
    ? mix(primary, '#ffffff', 0.2)
    : mix(primary, '#000000', 0.2)
  return ramp
}
