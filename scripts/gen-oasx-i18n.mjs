/**
 * 从原 Flutter 版 OASX 的 Dart 词条生成渲染层用的 TS 词条表。
 *
 *   node scripts/gen-oasx-i18n.mjs [OASX 仓库路径]
 *
 * 默认读 ../mzxyOASX，输出 src/renderer/src/i18n/oasx.ts。
 *
 * OASX 把词条拆成了 58 张表（_cn_ui / _cn_menu / _cn_script / 各任务配置…），
 * 同一句话在不同表里可能写法不同：菜单要「脚本」，配置页要「脚本设置」。
 * 所以这里出两份：
 *   OASX_ZH    全部表按顺序合并（后面的覆盖前面的）→ 配置页、字段描述用
 *   OASX_MENU  只取 _cn_menu                          → 二级菜单用
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(process.argv[2] ?? join(here, '..', '..', 'mzxyOASX'))
const srcFile = join(repo, 'lib/config/translation/i18n_cn.dart')
const outFile = join(here, '..', 'src/renderer/src/i18n/oasx.ts')

const raw = readFileSync(srcFile, 'utf-8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n')

/** 从 i 开始读一个 Dart 字符串字面量，返回 [值, 结束位置] */
function readString(text, i) {
  for (const quote of ["'''", '"""']) {
    if (text.startsWith(quote, i)) {
      const end = text.indexOf(quote, i + 3)
      return end < 0 ? [null, i] : [text.slice(i + 3, end), end + 3]
    }
  }
  const q = text[i]
  if (q !== "'" && q !== '"') return [null, i]

  const escapes = { n: '\n', t: '\t', r: '\r', "'": "'", '"': '"', '\\': '\\', $: '$' }
  let j = i + 1
  let out = ''
  while (j < text.length) {
    const c = text[j]
    if (c === '\\') {
      const next = text[j + 1] ?? ''
      out += escapes[next] ?? next
      j += 2
      continue
    }
    if (c === q) return [out, j + 1]
    out += c
    j += 1
  }
  return [null, i]
}

const KEY_RE = /(?:I18n\.(\w+)|'([^'\n]+)'|"([^"\n]+)")\s*:/g
const MAP_RE = /^final Map<String, String> (\w+) = \{/gm

const marks = [...raw.matchAll(MAP_RE)].map((m) => ({ name: m[1], at: m.index ?? 0 }))
const tables = []

for (let i = 0; i < marks.length; i += 1) {
  const body = raw.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : raw.length)
  const entries = {}
  KEY_RE.lastIndex = 0
  let m
  while ((m = KEY_RE.exec(body)) !== null) {
    const key = m[1] ?? m[2] ?? m[3]
    let j = m.index + m[0].length
    while (j < body.length && ' \t\r\n'.includes(body[j])) j += 1
    const [value, next] = readString(body, j)
    if (value === null) continue
    if (key && (/^[A-Za-z_]\w*$/.test(key) || key.includes('.'))) entries[key] = value
    KEY_RE.lastIndex = next
  }
  tables.push({ name: marks[i].name, entries })
}

const merged = Object.assign({}, ...tables.map((t) => t.entries))
const menu = tables.find((t) => t.name === '_cn_menu')?.entries ?? {}

const emit = (obj) =>
  Object.keys(obj)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(obj[k])},`)
    .join('\n')

writeFileSync(
  outFile,
  `/* eslint-disable */
// 由 scripts/gen-oasx-i18n.mjs 从 mzxyOASX/lib/config/translation/i18n_cn.dart 生成，请勿手改。

/** 全部中文词条（${tables.length} 张表合并，后面的覆盖前面的） */
export const OASX_ZH: Record<string, string> = {
${emit(merged)}
}

/** 菜单短标签：菜单里空间小，用「脚本」「重启」而不是「脚本设置」 */
export const OASX_MENU: Record<string, string> = {
${emit(menu)}
}
`,
  'utf-8'
)

console.log(`[gen-oasx-i18n] ${tables.length} 张表 → ${Object.keys(merged).length} 条，菜单 ${Object.keys(menu).length} 条`)
console.log(`[gen-oasx-i18n] 写入 ${outFile}`)
