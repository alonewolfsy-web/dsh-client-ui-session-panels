/**
 * Deploy built code DIRECTLY into the DSH profile's installed plugin copy —
 * the dev-iteration path. No tgz, no vendor, no pnpm round-trip.
 *
 * Why unlink-then-copy (never write-through): the profile's installed files
 * are hard links into the pnpm content store (nlink=2). Writing content in
 * place would follow the link and corrupt the store's blobs; unlinking drops
 * only this one link and leaves the store intact.
 *
 * The profile manifest keeps pointing at vendor\*.tgz (transitional) or at the
 * published registry version. A later `pnpm install` in the profile restores
 * that source of truth and wipes this deploy; `pnpm run switch:registry`
 * retires the vendor path for good.
 *
 * Usage:
 *   node scripts/deploy.mjs                    # default ~/.dsh/profiles/desktop
 *   node scripts/deploy.mjs --profile <dir>    # or DSH_PROFILE env
 */
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const PACKAGE = 'dsh-client-ui-session-panels'

let profile =
  process.env.DSH_PROFILE || join(homedir(), '.dsh', 'profiles', 'desktop')
const flag = process.argv.indexOf('--profile')
if (flag !== -1) {
  const value = process.argv[flag + 1]
  if (!value || value.startsWith('--')) {
    console.error('--profile requires a directory argument')
    process.exit(1)
  }
  profile = resolve(value)
}

const target = join(profile, 'node_modules', PACKAGE)

/**
 * Refresh the vendor tarball the profile manifest points at, with the bits
 * just deployed. The app's package operations re-run pnpm against the
 * manifest, and pnpm re-extracts the vendor tarball over node_modules — a
 * stale vendor copy silently reverts every direct deploy on the next
 * operation or restart. Refreshing it in place (under the spec's own
 * filename, even if the version inside moved on) keeps the "source of truth"
 * and the deployed copy identical; switch:registry retires this transitional
 * vendor path entirely.
 */
async function refreshVendorTarball(profile, srcPkg) {
  const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
  const spec = manifest.dependencies?.[srcPkg.name]
  if (typeof spec !== 'string' || !spec.replace(/\\/g, '/').includes('vendor/')) {
    console.log('  vendor  git/link spec — nothing to refresh')
    if (typeof spec === 'string' && !/^(file|link):/.test(spec)) {
      console.log('  note    app-side pnpm restores the PUBLISHED tag on the next start;')
      console.log('          direct deploys do not survive it — push a new tag instead.')
    }
    return
  }
  const expected = basename(spec.replace(/\\/g, '/'))

  // Stage the exact file set npm pack would ship: package.json, README.md,
  // cordis.patch.yml, lib/ — inside a `package/` folder, npm-layout.
  const stage = await mkdtemp(join(tmpdir(), 'session-panels-pack-'))
  try {
    const pkgDir = join(stage, 'package')
    await mkdir(pkgDir, { recursive: true })
    await copyFile(join(root, 'package.json'), join(pkgDir, 'package.json'))
    for (const name of ['README.md', 'cordis.patch.yml']) {
      if (existsSync(join(root, name))) await copyFile(join(root, name), join(pkgDir, name))
    }
    await cp(join(root, 'lib'), join(pkgDir, 'lib'), { recursive: true })
    const tgz = 'out.tgz'
    // Relative names only: GNU tar reads a `C:\...` argument as host:remote.
    const run = spawnSync('tar', ['-czf', tgz, 'package'], { cwd: stage, stdio: 'pipe' })
    if (run.status !== 0) throw new Error(`tar failed: ${run.stderr?.toString() ?? 'exit ' + run.status}`)

    const vendorDir = join(profile, 'vendor')
    await mkdir(vendorDir, { recursive: true })
    await rm(join(vendorDir, expected), { force: true })
    await copyFile(join(stage, tgz), join(vendorDir, expected))
    const note =
      srcPkg.version === expected.match(/-(\d+\.\d+\.\d+)\.tgz$/)?.[1]
        ? ''
        : ` (spec name pins an older version — switch:registry retires this path)`
    console.log(`  vendor  refreshed ${expected} with deployed v${srcPkg.version} bits${note}`)
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

async function main() {
  const srcPkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

  // Guard: deploy only over an existing pnpm-registered copy of THIS package.
  // First-time registration is the registry's job (publish + switch:registry);
  // after that, direct file replacement needs no tarball at all.
  let installed
  try {
    installed = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
  } catch {
    console.error(`no installed copy at ${target}`)
    console.error('install it once from the registry first:')
    console.error('  npm publish ./dsh-client-ui-session-panels-<version>.tgz && pnpm run switch:registry')
    console.error('after that this script can update it directly, no tarball needed.')
    process.exit(1)
  }
  if (installed.name !== srcPkg.name) {
    console.error(
      `target holds "${installed.name}" — refusing to deploy "${srcPkg.name}" over it`
    )
    process.exit(1)
  }

  console.log(`deploy ${PACKAGE}: ${installed.version} -> ${srcPkg.version}`)
  console.log(`target: ${target}`)

  // lib/: stage beside the old copy, then swap by rename. Staging means any
  // failure (a locked file, disk full) leaves the installed lib untouched —
  // rm-then-copy could leave it half-deleted. The final whole-dir unlink is
  // also what breaks pnpm-store hard links safely.
  const libSrc = join(root, 'lib')
  const libTarget = join(target, 'lib')
  let libNew = join(target, 'lib.new')
  let libOld = join(target, 'lib.old')
  // Stale staging dirs from an earlier run must not block this one; if one
  // cannot be removed (locked), pick a unique name for this run instead.
  for (const [role, dir] of [
    ['new', libNew],
    ['old', libOld],
  ]) {
    try {
      await rm(dir, { recursive: true, force: true })
    } catch {
      if (role === 'new') libNew = join(target, `lib.new.${process.pid}`)
      else libOld = join(target, `lib.old.${process.pid}`)
    }
  }
  await mkdir(libNew, { recursive: true })
  for (const name of await readdir(libSrc)) {
    await copyFile(join(libSrc, name), join(libNew, name))
    console.log(`  lib/${name}  staged`)
  }
  // Verify the STAGED copy before it replaces the installed one — a broken
  // build must fail here, not after the swap.
  const stagedClient = await readFile(join(libNew, 'client.js'), 'utf8')
  for (const marker of ['window.__ModuleLoader__', 'osp-ghost']) {
    if (!stagedClient.includes(marker)) throw new Error(`staged client.js missing marker: ${marker}`)
  }
  const stagedHost = await readFile(join(libNew, 'index.js'), 'utf8')
  if (!stagedHost.includes('/session-panels/mcp')) throw new Error('staged index.js missing route marker')
  const hadLib = existsSync(libTarget)
  if (hadLib) await rename(libTarget, libOld)
  try {
    await rename(libNew, libTarget)
  } catch (err) {
    // The swap failed with the old lib already renamed away: put it back,
    // and if even the restore fails, say where the old lib ended up.
    if (hadLib) {
      try {
        await rename(libOld, libTarget)
      } catch (restoreErr) {
        throw new Error(
          `swap failed (${err.message}); restore also failed (${restoreErr.message}) — old lib left at ${libOld}`
        )
      }
    }
    throw err
  }
  try {
    await rm(libOld, { recursive: true, force: true })
  } catch {
    // Cleanup only — the new lib is already in place, so a locked leftover
    // must not turn a successful deploy into a reported failure.
    console.log('  lib.old  could not be removed now (locked?); harmless leftover')
  }
  console.log('  lib  swapped in place')

  // Single files: unlink-then-copy, never write through an existing hard link
  for (const name of ['package.json', 'cordis.patch.yml', 'README.md']) {
    const src = join(root, name)
    if (!existsSync(src)) continue
    const dst = join(target, name)
    await rm(dst, { force: true })
    await copyFile(src, dst)
    console.log(`  ${name}  copied`)
  }

  // Verify what landed: version realignment, and that the swap really took.
  // Content markers were already checked on the staged copy, before the swap.
  const deployed = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
  if (deployed.version !== srcPkg.version) {
    throw new Error(`version mismatch after deploy: ${deployed.version}`)
  }
  for (const f of ['lib/client.js', 'lib/index.js', 'package.json']) {
    const s = await stat(join(target, f))
    console.log(`  verify ${f}  ${s.size} bytes`)
  }

  // Keep the vendor tarball identical to the deployed bits, so the app's own
  // pnpm re-resolution reproduces this deploy instead of reverting it.
  await refreshVendorTarball(profile, srcPkg)

  console.log(`DONE. ${installed.version} -> ${deployed.version} deployed in place.`)
  console.log('Restart DSH (or toggle the plugin in plugin manager) to load it.')
  console.log(
    'Note: vendor tarball refreshed in place — app-side pnpm re-resolution now reproduces this deploy.'
  )
}

main().catch((err) => {
  console.error(`deploy failed: ${err.message}`)
  process.exit(1)
})
