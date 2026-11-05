/**
 * Point the profile's dependency at this plugin's GitHub tag. Git deps are
 * immutable by commit (the lockfile pins the resolved commit), so the app's
 * startup reconciliation reuses pnpm's store copy instead of re-extracting a
 * local tarball every launch.
 *
 * Run AFTER pushing the matching `v<version>` tag: the script refuses to
 * touch the profile until `git ls-remote` can see that tag.
 *
 * Usage:
 *   node scripts/switch-to-git.mjs                  # default profile
 *   node scripts/switch-to-git.mjs --profile <dir>  # or DSH_PROFILE
 */
import { readFile, readdir, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const PACKAGE = 'dsh-client-ui-session-panels'

let profile = process.env.DSH_PROFILE || join(homedir(), '.dsh', 'profiles', 'desktop')
const flag = process.argv.indexOf('--profile')
if (flag !== -1) {
  const value = process.argv[flag + 1]
  if (!value || value.startsWith('--')) {
    console.error('--profile requires a directory argument')
    process.exit(1)
  }
  profile = resolve(value)
}

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const repoUrl = (pkg.repository?.url ?? '').replace(/\.git$/, '')
const parsed = /github\.com[/:]([^/]+)\/([^/]+)$/.exec(repoUrl)
if (!parsed) {
  console.error(`package.json repository.url is not a GitHub repo: ${repoUrl || '(missing)'}`)
  process.exit(1)
}
const [, owner, repo] = parsed
const tag = `v${version}`
const spec = `github:${owner}/${repo}#${tag}`

// 1. Remote check first: a missing tag must leave the working install intact.
console.log(`checking ${repoUrl} for tag ${tag} ...`)
const ls = spawnSync('git', ['ls-remote', '--tags', repoUrl, `refs/tags/${tag}`], {
  encoding: 'utf8',
  timeout: 60_000,
})
if (ls.status !== 0 || !ls.stdout.trim()) {
  console.error(`tag ${tag} not found on ${repoUrl}`)
  if (ls.stderr?.trim()) console.error(`  ${ls.stderr.trim().split('\n')[0]}`)
  console.error('push it first:  git push origin main --tags')
  process.exit(1)
}
console.log(`  found ${tag}`)

// 2. pnpm owns the manifest + lockfile + node_modules rewrite.
console.log(`pnpm add ${spec} in ${profile}`)
const add = spawnSync('pnpm', ['-C', `"${profile}"`, 'add', spec], {
  stdio: 'inherit',
  shell: true,
})
if (add.status !== 0) {
  console.error('pnpm add failed; nothing to undo beyond what pnpm already restored')
  process.exit(1)
}

// 3. Prove the three layers now agree.
const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
const dep = manifest.dependencies?.[PACKAGE]
if (typeof dep !== 'string' || /^(file|link):/.test(dep) || dep.includes('vendor')) {
  console.error(`manifest is still not a git spec: ${dep}`)
  process.exit(1)
}
const installed = JSON.parse(
  await readFile(join(profile, 'node_modules', PACKAGE, 'package.json'), 'utf8')
)
if (installed.version !== version) {
  console.error(`installed copy is ${installed.version}, expected ${version}`)
  process.exit(1)
}
console.log(`  manifest   ${PACKAGE} = ${dep}`)
console.log(`  installed  ${installed.version}`)

// 4. The vendor tarball is unreferenced now. Best effort: a locked file
//    cannot make a completed switch look failed.
const vendorDir = join(profile, 'vendor')
let removed = 0
try {
  for (const name of await readdir(vendorDir)) {
    if (!name.startsWith(`${PACKAGE}-`) || !name.endsWith('.tgz')) continue
    await rm(join(vendorDir, name), { force: true })
    removed += 1
    console.log(`  vendor     removed ${name}`)
  }
} catch {
  // No vendor dir at all is the normal case on a fresh git install.
}
if (removed === 0) console.log('  vendor     nothing to remove')

console.log(`DONE. The profile now resolves this plugin from ${repoUrl}@${tag}.`)
console.log('Restart DSH to load it. From now on, a release is:')
console.log('  bump version -> commit -> git tag vX.Y.Z -> push --tags -> pnpm run switch:git')
