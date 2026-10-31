#!/usr/bin/env node
/**
 * Playground isolation guard.
 *
 * Demo apps/modules must live ONLY in a package's `playground/` (private, not
 * published). Installing a theme/app must never pull demo packages.
 *
 * Fails when, in any published (@owdproject) package:
 *   - `files` includes `playground`
 *   - `dependencies`/`peerDependencies`/`optionalDependencies` include an app
 *     (`@owdproject/nuxt-app-*` / `@owdproject/react-app-*`)
 *   - a `playground/` exists but its package.json is not private
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ignored = new Set(['node_modules', 'dist', '.git', '.nuxt', '.output', '.data', '.cache'])
const APP_RE = /^@owdproject\/(?:nuxt|react|vue|svelte|angular|astro)-app-/
const failures = []
let packages = 0

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue
    const p = join(dir, entry)
    if (!statSync(p).isDirectory()) continue
    const pkgPath = join(p, 'package.json')
    if (existsSync(pkgPath)) checkPackage(p, pkgPath)
    scan(p)
  }
}

function checkPackage(dir, pkgPath) {
  let pkg
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return
  }
  if (!pkg.name?.startsWith('@owdproject/') || pkg.private) return
  packages++

  if (Array.isArray(pkg.files) && pkg.files.some((f) => String(f).includes('playground'))) {
    failures.push(`${pkg.name}: \`files\` must not include playground/`)
  }

  for (const key of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dep of Object.keys(pkg[key] ?? {})) {
      if (APP_RE.test(dep)) {
        failures.push(`${pkg.name}: ${key} must not include demo app ${dep} (playground-only)`)
      }
    }
  }

  const pgPkg = join(dir, 'playground/package.json')
  if (existsSync(pgPkg)) {
    try {
      const pg = JSON.parse(readFileSync(pgPkg, 'utf8'))
      if (!pg.private) failures.push(`${pkg.name}: playground/package.json must be private`)
    } catch {
      /* ignore */
    }
  }
}

for (const base of ['packages', 'themes', 'apps']) {
  const dir = join(root, base)
  if (existsSync(dir)) scan(dir)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Playground isolation OK across ${packages} published package(s).`)
}
