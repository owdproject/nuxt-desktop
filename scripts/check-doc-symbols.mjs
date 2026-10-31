import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Doc/code drift guard.
 *
 * ## Il problema che risolve
 *
 * La documentazione che cita un simbolo di codice sta promettendo che quel simbolo
 * esiste. Quando la promessa e' falsa, chi legge (umano o agente) progetta su un
 * fantasma. E' la classe di errore piu' costosa in un repo guidato da agenti:
 * un agente legge la doc, ci costruisce sopra, e il costo si paga tre passaggi dopo.
 *
 * ## Cosa NON risolve
 *
 * Non giudica la semantica. Verifica solo l'*esistenza* del simbolo da qualche parte
 * nel codice. E' il controllo piu' economico che elimina la classe di errore piu'
 * costosa, non un type checker.
 *
 * ## Il fallimento silenzioso da cui questo file e' nato
 *
 * La prima versione estraeva i token anche dai *commenti*. Il file stesso citava
 * `DesktopExtensionMeta` nella propria docstring, quindi il simbolo risultava
 * "presente nel codice" e il guard dichiarava zero derive — proprio mentre una
 * ricognizione sosteneva che quel contratto non esistesse. Un guard che non puo'
 * fallire non e' un guard: vedi `assertSelfCheck()`.
 *
 * Uso:
 *   node scripts/check-doc-symbols.mjs              # documenti chiave
 *   node scripts/check-doc-symbols.mjs --all        # tutti i *.md del repo
 *   node scripts/check-doc-symbols.mjs --json
 *
 * Exit code 1 se trova simboli citati ma inesistenti. Da usare in CI.
 *
 * ## Convenzioni per i documenti
 *
 * - Un documento che descrive uno stato *futuro* deve dichiararlo in testa:
 *     <!-- drift-guard: status=plan -->
 *   I simboli assenti diventano avvisi, non errori. Senza questo marcatore, un piano
 *   scritto al presente e' indistinguibile da una descrizione del presente: ed e'
 *   esattamente la deriva che questo guard deve fermare.
 * - Un simbolo documentato qui ma definito in un altro repo va dichiarato in
 *   `scripts/doc-symbols.allow.json` **con una motivazione**.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CODE_DIRS = ['packages', 'apps', 'themes', 'scripts', 'template', 'desktop']
const CODE_EXT = new Set(['.ts', '.mts', '.cts', '.tsx', '.vue', '.js', '.mjs', '.cjs', '.jsx', '.json'])
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.nuxt', '.output', 'dist', '.data', '.cache',
  'coverage', '.verdaccio', 'playwright-report', 'test-results',
])

/** Documenti controllati di default: quelli che gli agenti leggono e seguono. */
const DEFAULT_DOCS = ['.agents/AGENTS.md', 'AGENTS.md', 'README.md', '.agents/rules', 'dev-blog']

/**
 * Parole che sembrano simboli ma non lo sono: nomi di prodotto, termini generici,
 * sigle. Cresce solo con una motivazione.
 */
const ALLOW_WORDS = new Set([
  'JavaScript', 'TypeScript', 'GitHub', 'GitLab', 'Bluesky', 'Nuxt', 'Vue', 'React',
  'Pinia', 'Tailwind', 'PrimeVue', 'ZenFS', 'WasmBoy', 'OpenWebDesktop', 'Nx',
  'README', 'CHANGELOG', 'LICENSE', 'MIT', 'TODO', 'API', 'CLI', 'MCP', 'SSR',
  'JSON', 'HTML', 'CSS', 'URL', 'URI', 'APIs', 'IDs', 'OK', 'OS', 'UI', 'UX',
])

const PLAN_MARKER = /<!--\s*drift-guard:\s*status=plan\s*-->/

/** Un token "sembra un simbolo di codice"? */
function looksLikeSymbol(token) {
  if (token.length < 4 || ALLOW_WORDS.has(token)) return false
  if (/^[A-Z][A-Z0-9_]+$/.test(token)) return true // SCREAMING_SNAKE
  if (/^[A-Z][A-Za-z0-9]*[A-Z]/.test(token)) return true // PascalCase con 2+ parole
  if (/^[a-z][a-z0-9]*[A-Z]/.test(token)) return true // camelCase
  return false
}

/** Restringe un token citato nell'MD al suo identificatore radice. */
function rootToken(raw) {
  return raw
    .replace(/<[^>]*>/g, '') // Hookable<X> -> Hookable
    .replace(/\(\)$/, '')
    .split(/[.:#(/]/)[0]
    .trim()
}

function* walkFiles(dir, test) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walkFiles(full, test)
    else if (test(full)) yield full
  }
}

/**
 * File che non devono certificare l'esistenza di un simbolo: contengono per forza
 * di cose i nomi che il guard cerca, e includerli renderebbe il guard compiacente.
 */
const NEVER_SOURCE_OF_TRUTH = new Set([
  'scripts/check-doc-symbols.mjs',
  'scripts/doc-symbols.allow.json',
])

/**
 * Tutti i token presenti nel codice del repo.
 *
 * Vengono rimossi commenti e stringhe: un simbolo citato in un commento o dentro
 * una stringa non e' un simbolo che esiste. Senza questo passaggio il guard si
 * auto-inganna — la prima versione di questo file citava `DesktopExtensionMeta`
 * nella propria docstring e dichiarava "zero derive" mentre una ricognizione
 * sosteneva che quel contratto non esistesse affatto.
 *
 * Limite noto: un simbolo che vive *solo* come stringa (es. `{ name: 'FooBar' }`)
 * risulta assente. Il costo e' un falso positivo da rivedere; il costo opposto
 * sarebbe un falso negativo silenzioso, che e' peggio.
 */
function collectCodeSymbols() {
  const symbols = new Set()
  const scan = (file) => {
    const rel = relative(root, file)
    // Il nome del file e' un simbolo legittimo: la doc che cita `utilExternalFileImport`
    // sta nominando un modulo, non invocando un'API. Senza questo, ogni nome di file
    // citato in un README diventa un falso positivo.
    if (!NEVER_SOURCE_OF_TRUTH.has(rel)) {
      symbols.add(relative(root, file).split(/[\\/]/).join('/'))
      const base = file.split(/[\\/]/).pop() ?? ''
      if (base) symbols.add(base.replace(/\.[^.]+$/, ''))
    }
    if (NEVER_SOURCE_OF_TRUTH.has(rel)) return
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      return
    }
    text = text.replace(/:\/\//g, '\u0000SLASH\u0000') // protegge `://` dagli URL
    text = text.replace(/\/\*[\s\S]*?\*\//g, ' ')
    text = text.replace(/\/\/[^\n]*/g, ' ')
    text = text.replace(/\u0000SLASH\u0000/g, '://')
    // stringhe a riga singola (singole, doppie, template)
    text = text.replace(/(['"])(?:\\.|(?!\1)[^\\\n])*\1/g, ' ')
    text = text.replace(/`(?:[^`\\\n]|\\.)*`/g, ' ')
    for (const m of text.matchAll(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g)) symbols.add(m[0])
  }
  for (const dir of CODE_DIRS) {
    for (const file of walkFiles(join(root, dir), (f) => CODE_EXT.has(extname(f)))) scan(file)
  }
  for (const name of ['package.json', 'vitest.workspace.ts', 'tsconfig.base.json']) {
    if (existsSync(join(root, name))) scan(join(root, name))
  }
  return symbols
}

/** Nomi dei package realmente presenti nei manifest del repo. */
function collectPackageNames() {
  const names = new Set()
  for (const dir of CODE_DIRS) {
    for (const file of walkFiles(join(root, dir), (f) => f.endsWith('package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(file, 'utf8'))
        if (pkg.name) names.add(pkg.name)
      } catch {
        /* manifest non leggibile: irrilevante per il guard */
      }
    }
  }
  return names
}

function loadAllowlist() {
  const file = join(root, 'scripts', 'doc-symbols.allow.json')
  if (!existsSync(file)) return { symbols: {} }
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  return { symbols: parsed.symbols ?? {} }
}

/**
 * Il guard deve poter fallire. Se il corpus dei simboli fosse vuoto o la funzione
 * di riconoscimento rotta, il controllo passerebbe sempre "senza derive" e
 * direbbe una bugia con la faccia seria.
 */
function assertSelfCheck(codeSymbols) {
  const failures = []
  if (!looksLikeSymbol('DesktopExtensionMeta')) failures.push('looksLikeSymbol() non riconosce un PascalCase reale')
  if (looksLikeSymbol('theme')) failures.push('looksLikeSymbol() accetta una parola generica')
  if (codeSymbols.size < 1000) failures.push(`corpus dei simboli sospettosamente piccolo (${codeSymbols.size})`)
  if (!codeSymbols.has('DesktopExtensionMeta')) failures.push("il corpus non vede 'DesktopExtensionMeta', che esiste in packages/nuxt/src")
  if (codeSymbols.has('ZzzSymbolThatMustNotExistInThisRepo')) failures.push('il corpus contiene un simbolo inventato')

  if (failures.length) {
    console.error('Self-check del guard fallito:')
    for (const f of failures) console.error(`  - ${f}`)
    console.error('\nIl guard non e\' affidabile: correggilo prima di fidarti del suo esito.')
    process.exit(1)
  }
}

function docFiles(all) {
  if (all) {
    // I CHANGELOG sono documenti storici: citare un'API poi rimossa e' corretto li'.
    return [...walkFiles(root, (f) => extname(f) === '.md' && !f.includes('/.agents/skills/') && !f.endsWith('CHANGELOG.md'))]
  }
  const files = []
  for (const entry of DEFAULT_DOCS) {
    const full = join(root, entry)
    if (!existsSync(full)) continue
    if (statSync(full).isDirectory()) files.push(...walkFiles(full, (f) => extname(f) === '.md'))
    else files.push(full)
  }
  return files
}

function main() {
  const args = new Set(process.argv.slice(2))
  const asJson = args.has('--json')

  const codeSymbols = collectCodeSymbols()
  assertSelfCheck(codeSymbols)
  const packageNames = collectPackageNames()
  const allow = loadAllowlist()

  const errors = []
  const planned = []
  const external = []
  const packages = []
  let citations = 0
  let planDocs = 0

  for (const file of docFiles(args.has('--all'))) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(root, file)
    const isPlan = PLAN_MARKER.test(text)
    if (isPlan) planDocs++

    for (const [index, line] of text.split('\n').entries()) {
      for (const m of line.matchAll(/`([^`\n]+)`/g)) {
        const raw = m[1].trim()
        if (!raw || raw.includes(' ')) continue

        const pkg = /(@[a-z0-9-]+\/[a-z0-9-]+)/i.exec(raw)
        if (pkg) {
          const name = pkg[1]
          // I pattern documentali (`@owdproject/nuxt-app-`, `@owdproject/react-*`) non sono nomi.
          if (name.endsWith('-') || raw.includes('*')) continue
          if (name.startsWith('@owdproject/') && !packageNames.has(name)) {
            packages.push({ file: rel, line: index + 1, name })
          }
          continue
        }

        if (raw.includes('/') || raw.includes('*')) continue
        if (/\.(md|ts|vue|json|mjs|js|css|scss|yml|yaml)$/.test(raw)) continue

        const token = rootToken(raw)
        if (!looksLikeSymbol(token)) continue
        citations++
        if (codeSymbols.has(token)) continue

        const row = { file: rel, line: index + 1, token, raw }
        if (allow.symbols[token]) external.push({ ...row, reason: allow.symbols[token] })
        else if (isPlan) planned.push(row)
        else errors.push(row)
      }
    }
  }

  const unique = (rows, key) => {
    const seen = new Set()
    return rows.filter((r) => {
      const k = key(r)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  const uniqErrors = unique(errors, (r) => `${r.token}@${r.file}`)
  const uniqPlanned = unique(planned, (r) => `${r.token}@${r.file}`)
  const uniqExternal = unique(external, (r) => r.token)
  const uniqPackages = unique(packages, (r) => r.name)

  if (asJson) {
    console.log(JSON.stringify(
      { citations, planDocs, errors: uniqErrors, planned: uniqPlanned, external: uniqExternal, packages: uniqPackages },
      null,
      2,
    ))
  } else {
    if (uniqErrors.length) {
      console.log('ERRORE — simboli citati come esistenti ma assenti dal codice:\n')
      for (const r of uniqErrors) console.log(`  ${r.file}:${r.line}  \`${r.raw}\``)
      console.log('\n  Rimedi, in ordine di preferenza:')
      console.log('    1. il simbolo esiste ma con un altro nome  -> correggi la doc')
      console.log('    2. il documento descrive uno stato futuro  -> aggiungi <!-- drift-guard: status=plan -->')
      console.log('    3. il simbolo vive in un altro repo        -> dichiaralo in scripts/doc-symbols.allow.json\n')
    }
    if (uniqPlanned.length) {
      console.log(`Avviso — citati in documenti marcati status=plan (${planDocs} documenti):\n`)
      for (const r of uniqPlanned) console.log(`  ${r.file}:${r.line}  \`${r.raw}\``)
      console.log('')
    }
    if (uniqExternal.length) {
      console.log('Dichiarati come definiti altrove (allowlist):\n')
      for (const r of uniqExternal) console.log(`  \`${r.token}\` — ${r.reason}`)
      console.log('')
    }
    if (uniqPackages.length) {
      console.log('Package @owdproject/* citati senza manifest in questo repo:\n')
      for (const r of uniqPackages) console.log(`  ${r.name}  (${r.file}:${r.line})`)
      console.log('')
    }
    console.log(
      `${citations} citazioni di simboli controllate, ${uniqErrors.length} errate, ` +
        `${uniqPlanned.length} in piani, ${uniqExternal.length} esterne, ${uniqPackages.length} package non risolti.`,
    )
  }

  if (uniqErrors.length) process.exitCode = 1
}

main()
