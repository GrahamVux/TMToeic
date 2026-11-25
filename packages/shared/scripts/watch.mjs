import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, watch, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isWatcherAlive, resolveTsupCli, syncDist } from './sync-dist.mjs'

const sharedRoot = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(sharedRoot, 'dist')
const pidFile = join(distDir, '.watch.pid')

// Ensure dist exists & is up-to-date when invoked standalone (no-op when already fresh)
const initCode = syncDist({ force: false })
if (initCode !== 0) process.exit(initCode)

if (isWatcherAlive()) {
  console.log('[shared] another watcher is already active; standing by.')
  setInterval(() => {}, 1 << 30)
} else {
  const tsupCli = resolveTsupCli()
  if (!tsupCli) {
    console.error('[shared] tsup CLI not found.')
    process.exit(1)
  }

  mkdirSync(distDir, { recursive: true })
  writeFileSync(pidFile, String(process.pid), 'utf8')

  const cleanup = () => {
    try {
      rmSync(pidFile, { force: true })
    } catch {}
  }
  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })

  let timer = null
  let building = false
  let queued = false

  const runBuild = () => {
    if (building) {
      queued = true
      return
    }
    building = true
    console.log('[shared] change detected — rebuilding @toeic/shared...')
    const child = spawn(process.execPath, [tsupCli], {
      cwd: sharedRoot,
      env: { ...process.env, TSUP_NO_CLEAN: '1' },
      stdio: 'inherit',
    })
    child.on('close', (code) => {
      building = false
      if (code !== 0) {
        console.error(`[shared] rebuild failed with exit code ${code}`)
      }
      if (queued) {
        queued = false
        runBuild()
      }
    })
  }

  const scheduleBuild = (_event, filename) => {
    if (filename && String(filename).endsWith('~')) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(runBuild, 150)
  }

  const srcDir = join(sharedRoot, 'src')
  try {
    watch(srcDir, { recursive: true }, scheduleBuild)
  } catch {
    watch(srcDir, scheduleBuild)
  }
  for (const file of ['package.json', 'tsup.config.ts']) {
    try {
      watch(join(sharedRoot, file), scheduleBuild)
    } catch {}
  }

  console.log('[shared] watching packages/shared for changes...')
}
