/**
 * 本地发布前的防呆：同一个版本只允许发布一次。
 *
 *   node scripts/publish-guard.mjs
 *
 * 0.2.1 更新校验失败的根因就是同名资产被覆盖：本地发一次、CI 再发一次，
 * 两次 NSIS 产物 sha512 不同，latest.yml 与 exe 对不上，客户端 100% 后报
 * sha512 checksum mismatch。
 *
 * 命中任一情况即退出码 1：
 *   1. 远端已有 tag v<version>       —— tag push 会触发 CI 发布
 *   2. 远端已有该 tag 的 Release     —— 资产会被覆盖
 *
 * 确实要覆盖发布：MZXY_ALLOW_REPUBLISH=1 npm run dist:publish
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
const tag = `v${version}`

const publishCfg = readFileSync(join(root, 'electron-builder.yml'), 'utf-8')
const owner = publishCfg.match(/^\s*owner:\s*(\S+)/m)?.[1]
const repo = publishCfg.match(/^\s*repo:\s*(\S+)/m)?.[1]

function block(reason) {
  console.error(`\n[publish-guard] 拒绝发布 ${tag}：${reason}\n`)
  console.error('  覆盖同名 Release 资产会让已安装的客户端拿到与 latest.yml 不一致的安装包。')
  console.error('  要发新版本：先在 package.json 改版本号，再由 CI 发布。')
  console.error('  确实要覆盖：MZXY_ALLOW_REPUBLISH=1 npm run dist:publish\n')
  process.exit(1)
}

if (process.env.MZXY_ALLOW_REPUBLISH === '1') {
  console.warn(`[publish-guard] MZXY_ALLOW_REPUBLISH=1，跳过检查，${tag} 的远端资产将被覆盖`)
  process.exit(0)
}

// 网络不通时不拦发布，只提示：真正的一致性由 latest.yml 与上传的包共同决定
let remoteTag = ''
try {
  remoteTag = execFileSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], {
    cwd: root,
    encoding: 'utf-8'
  }).trim()
} catch (e) {
  console.warn(`[publish-guard] 查不到远端 tag（${e.message.split('\n')[0]}），跳过该项检查`)
}
if (remoteTag) block(`远端已存在 tag ${tag}`)

if (!owner || !repo) {
  console.warn('[publish-guard] 没解析出 electron-builder.yml 里的 owner/repo，跳过 Release 检查')
} else {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { accept: 'application/vnd.github+json' }
    })
    if (res.ok) block(`远端已存在 Release ${tag}`)
    if (res.status !== 404) {
      console.warn(`[publish-guard] Release 查询返回 HTTP ${res.status}，跳过该项检查`)
    }
  } catch (e) {
    console.warn(`[publish-guard] Release 查询失败（${e.message}），跳过该项检查`)
  }
}

console.log(`[publish-guard] ${tag} 尚未发布过，继续`)
