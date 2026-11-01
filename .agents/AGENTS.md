> **Current v4 rule (supersedes legacy descriptions below):** the legacy **unscoped `nuxt-desktop`** package is deprecated — no OWD package may depend on or import it. The current scoped distribution **`@owdproject/nuxt-desktop`** (the renamed Nuxt desktop client) is allowed and is the intended entry point. Use `@owdproject/nuxt` for the Nuxt module and Vue shell APIs; `@owdproject/core` is the framework-independent engine. Run `node scripts/check-no-legacy-desktop.mjs` after migration work.
>
> **Framework-first naming:** Nuxt extension packages use `@owdproject/nuxt-{app,module,kit,theme}-*`; React extensions use `@owdproject/react-*`. The engine (`@owdproject/core`), the framework bindings (`@owdproject/nuxt`, `@owdproject/react`, …), the desktop distribution (`@owdproject/nuxt-desktop`) and `*-template` scaffolds are not extensions.

# Open Web Desktop (OWD) — Agent & contributor context

This document describes the **OWD client monorepo**: what it is, how it is organized, and how to extend it. Include `@AGENTS.md` in new sessions so assistants do not need the layout explained from scratch.

**Product positioning:** a framework-independent engine with framework bindings and a Nuxt desktop distribution for building **browser-based desktop experiences** (windows, shell, workspace). Themes shape the “OS” look and feel; apps register programs via `defineDesktopApp`. The repo is meant to be reusable, documented, and approachable for contributors and downstream teams.

**Module playground playbook** (Nuxt module authoring, `nuxt-module-build`, GitHub Pages): [`docs/agents/OWD_APP_MODULE_PLAYGROUND.md`](docs/agents/OWD_APP_MODULE_PLAYGROUND.md). In Cursor, see also `.cursor/rules/owd-app-module-playground.mdc` under `apps/**` and `themes/**`.

---

## One-sentence architecture

The Nuxt desktop distribution (`desktop/`) loads **`@owdproject/nuxt`**, which reads **`desktop.config.ts`**, installs **theme → optional modules → apps**, and provides Nuxt/Vue orchestration, shell components and stores (`packages/nuxt/src/module.ts:32`). **`@owdproject/core`** supplies framework-independent primitives (`packages/core/src/Desktop.ts:40`). Nuxt also retains its own application/window controllers sharing core machines; this is not evidence of complete runtime parity (`packages/nuxt/src/runtime/internal/controllers/ApplicationController.ts:39`). Themes own layout and chrome; apps register through **`defineDesktopApp`**.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| UI | **Vue 3**, **Nuxt 4** (monorepo desktop is typically SPA: `ssr: false`) |
| Workspace | **pnpm** workspaces; root scripts dispatch to `desktop/` |
| State | **Pinia** |
| Styling | **Tailwind** via `@owdproject/nuxt-kit-tailwind`; **PrimeVue** via `@owdproject/nuxt-kit-primevue` (theme installs the kit for its UI stack — the engine does not) |
| Icons / fonts | **@nuxt/icon**, **@nuxt/fonts** |
| i18n | **@nuxtjs/i18n** |
| Extension packages | **@nuxt/module-builder** → published **`dist/module.mjs`** |

---

## Repository map (root = `client/`)

```
client/
├── desktop/                 # @owdproject/nuxt-desktop — Nuxt desktop distribution (primary dev entry)
├── packages/
│   ├── core/                # @owdproject/core — framework-independent engine
│   ├── nuxt/                # @owdproject/nuxt — Nuxt/Vue binding + authoring helpers
│   ├── fs/                  # @owdproject/module-fs — framework-independent ZenFS engine
│   ├── owd-module-fs/       # @owdproject/nuxt-module-fs — Nuxt filesystem module
│   ├── owd-nuxt-module-persistence/ # @owdproject/nuxt-module-pinia-persistence
│   ├── owd-module-atproto*/ # @owdproject/nuxt-module-atproto*
│   ├── owd-kit-nuxt-primevue/  # @owdproject/nuxt-kit-primevue — PrimeVue + tailwindcss-primeui
│   ├── owd-kit-nuxt-tailwind/  # @owdproject/nuxt-kit-tailwind — Tailwind content registration
│   ├── owd-kit-nuxt-ui/     # @owdproject/nuxt-kit-nuxt-ui — Nuxt UI stack (no PrimeVue)
│   ├── react/               # @owdproject/react — React binding
│   └── owd-kit-react95/     # @owdproject/react-kit-react95
├── apps/                    # Desktop apps (@owdproject/nuxt-app-*)
├── themes/                  # Desktop themes (@owdproject/nuxt-theme-*)
├── plugins/                 # Optional workspace slot for future Nuxt plugins
├── template/                # Generated starter (npm create owd) — do not hand-edit
├── packages/core/template-blueprint/  # Maintainer source for generated starter
├── package.json
├── pnpm-workspace.yaml
└── scripts/
```

**Folder convention:** a desktop distribution collects extensions from **`apps/`**, **`modules/`**, and **`themes/`** (see the extension contract below). The monorepo keeps framework modules under **`packages/*`** and exposes both slots in `DESKTOP_EXTENSION_DIRS`. The **`modules`** field in `desktop.config.ts` is a list of Nuxt module package names or local module paths, not a directory-discovery setting (`packages/nuxt/src/kit/authoring.ts:107`). `*-template` packages are scaffolds, not extensions.

### `desktop/` — monorepo shell

- **`nuxt.config.ts`** — registers `@owdproject/nuxt`, Nuxt options (host, i18n, `workspaceDir`, …).
- **`desktop.config.ts`** — declarative desktop config (`defineDesktopConfig`): `theme`, `modules`, `apps`.
- **`app/app.vue`** — minimal root; renders the active theme (e.g. `<Desktop />`).
- Window/app logic lives in **engine + framework binding + theme + loaded apps**, not in `desktop/` itself.

### Engine, bindings and CLI

Core repository instructions are not loaded transitively by imports. The following adapter entry points apply independently and route extension authors to their applicable contract.

- **`packages/core/` — `@owdproject/core`**: framework-independent desktop instances, managers, machines, geometry, hooks, IPC, sessions and pointer utilities. Start at [`packages/core/AGENTS.md`](../packages/core/AGENTS.md) and its [behavioral contract](../packages/core/docs/behavioral-contract.md). Evidence: `packages/core/src/index.ts:7`.
- **`packages/nuxt/` — `@owdproject/nuxt`**: Nuxt module, authoring helpers, Vue shell, stores/composables and framework controllers. Start at [`packages/nuxt/AGENTS.md`](../packages/nuxt/AGENTS.md) and its [extension contract](../packages/nuxt/docs/extension-contract.md). Evidence: `packages/nuxt/src/module.ts:32`.
- **`packages/react/` — `@owdproject/react`**: React subscriptions and pointer bindings to the engine. Start at [`packages/react/AGENTS.md`](../packages/react/AGENTS.md) and its [integration contract](../packages/react/docs/integration-contract.md). Evidence: `packages/react/src/index.ts:1`.
- **`packages/cli/` — `@owdproject/cli`**: `desktop` CLI (`packages/cli/package.json`). CLI behavior is separate from the engine.

Nuxt setup currently installs infrastructure, merges optional file config with inline options, then installs the theme, modules and apps. Missing file config is allowed; invalid loaded config fails. Shell auto-imports come from Nuxt runtime folders, excluding private internal controllers. Evidence: `packages/nuxt/src/module.ts:41`, `packages/nuxt/src/module.ts:80`, `packages/nuxt/src/module.ts:114`, `packages/nuxt/src/module.ts:188`.

### Optional packages (summary)

| Package | Role |
|---------|------|
| `@owdproject/nuxt-module-fs` | ZenFS mount + explorer composables; enable in `desktop.config.ts` → `modules`. |
| `@owdproject/nuxt-module-pinia-persistence` | Pinia persistence via IndexedDB. |
| `@owdproject/nuxt-kit-primevue` | PrimeVue UI integration; an explicit theme/consumer dependency. |
| `@owdproject/nuxt-kit-tailwind` | Tailwind build integration and content registration helpers. |

### `apps/*` — desktop applications

Each Nuxt app is an **`@owdproject/nuxt-app-*`** module:

- **`src/module.ts`** — `defineNuxtModule`, Tailwind paths, runtime config.
- **`src/runtime/plugin.ts`** — typically `defineDesktopApp` on `app:created` (client-only).
- **`src/runtime/app.config.ts`** — `ApplicationConfig` (id, title, windows, entries, commands).
- **`playground/`** — isolated Nuxt app for developing the module (`theme-paper` recommended).
- Build with **`nuxt-module-build`** → **`dist/module.mjs`**.

**Flow:** `desktop.config.ts` lists the package under **`apps`** → Nuxt `installDesktopPackage` → app plugin → `defineDesktopApp` → entries appear in the shell.

### `themes/*` — desktop environments

Nuxt modules (e.g. `@owdproject/nuxt-theme-paper`, `@owdproject/nuxt-theme-win95`) that provide layout, chrome, styles, and i18n. They may conditionally load extra modules (e.g. FS explorer integration).

**`theme-paper`** is the **reference shell** for app/module playgrounds (Start menu, tray, dock). Smoke test: Start lists apps from the playground’s `desktop.config.ts`.

### `template/`

The CLI generator copies `packages/core/template-blueprint/` and selected desktop/workspace files into `template/` (`packages/cli/bin/lib/generateTemplate.js:248`). Edit the blueprint, then regenerate; do not hand-edit the generated starter. Root agent guidance is copied from the blueprint. App/module scaffolds carry their own role-specific guidance (`packages/cli/tests/scaffold-contracts.test.mjs`).

---

## Playground matrix (representative)

Full migration checklist: [`docs/agents/OWD_APP_MODULE_PLAYGROUND.md`](docs/agents/OWD_APP_MODULE_PLAYGROUND.md).

| Package | Playground | Base theme | Notes |
|---------|------------|------------|--------|
| `@owdproject/nuxt-app-about` | `apps/owd-nuxt-app-about/playground` | `nuxt-theme-paper` | Minimal app reference |
| `@owdproject/nuxt-app-wasmboy` | `apps/owd-nuxt-app-wasmboy/playground` | `nuxt-theme-paper` | Legacy migration example |
| Other `nuxt-app-*` | `apps/<pkg>/playground` | `nuxt-theme-paper` | Standalone repos often ship GitHub Pages |
| `@owdproject/nuxt-module-fs` | `packages/owd-module-fs/playground` | `nuxt-theme-paper` + FS demos | |
| `@owdproject/nuxt-module-pinia-persistence` | `packages/owd-nuxt-module-persistence/playground` | `nuxt-theme-paper` + `nuxt-app-todo` | |
| `@owdproject/nuxt-theme-paper` | `themes/owd-nuxt-theme-paper/playground` | (self) | Reference theme |
| `@owdproject/nuxt-theme-win95` | `themes/owd-nuxt-theme-win95/playground` | (self) + `nuxt-app-about` | Retro reference |
| `@owdproject/core` | No Nuxt package playground | — | Headless engine; desktop integration runs through the Nuxt binding |

**Monorepo dev vs publish**

| Command | When |
|---------|------|
| `pnpm install` (repo root) | Runs `prepare:stubs` for all workspace modules, then desktop `nuxt prepare` |
| `pnpm dev` | Root script starts the desktop workspace; no manual stub step |
| `npm publish` on `@owdproject/*` packages | `prepack` only (full build); never add `prepare` stub on publishable packages |
| `pnpm run dev:prepare` in a package | Isolated package playground only |

**New app/theme checklist (copy `themes/theme-paper` or `apps/app-about`):**

1. `package.json` scripts: `prepack`, `dev`, `dev:prepare`, `dev:generate` — **no** `prepare`.
2. `exports["."].development` → `./src/module.ts`; `import`/`default` → `./dist/module.mjs`.
3. `playground/` with `desktop.config.ts`, `nuxt.config.ts` (`ssr: false`, `@owdproject/nuxt`).
4. Before publish: `desktop validate .` in the package (fails on `prepare` or missing layout).
5. Monorepo: register path in `pnpm-workspace.yaml`; standalone repo: `pnpm dev` only (runs `dev:prepare`).

**Playground commands:** `dev:prepare`, `dev`, `dev:generate` with `NUXT_APP_BASE_URL=/<repo-slug>/`. Root helpers: `pnpm run prepare:stubs`, `prepare:apps`, `prepare:themes`.

**Standalone demos:** `.github/workflows/pages.yml` → artifact `playground/.output/public`.

---

## `desktop.config.ts`

Canonical Nuxt configuration file: **`desktop.config.ts`** next to `nuxt.config.ts`. Legacy **`owd.config.ts`** still works with a deprecation warning.

| Field | Meaning |
|--------|---------|
| `theme` | Optional theme package (Nuxt module defaults leave it undefined; `packages/nuxt/src/module.ts:32`) |
| `modules` | Extra Nuxt modules (FS, persistence, docs, …) |
| `apps` | Desktop apps to load |

Merged into **`runtimeConfig.public.desktop`** and **`appConfig.desktop`** for runtime overrides.

---

## Common commands (repo root)

| Command | Purpose |
|---------|--------|
| `pnpm install` | Install workspace |
| `pnpm run prepare:modules` | `dev:prepare` on apps/themes/packages where defined |
| `pnpm desktop` | Control panel TUI (catalog, install, dev server) |
| `pnpm desktop dev` | Foreground dev server |
| `pnpm run dev` | pnpm → desktop → `nuxt dev` |
| `pnpm run generate` | Static generate for desktop |
| `pnpm desktop template` | Regenerate `template/` (maintainers) |
| `pnpm run validate:modules` | `desktop validate` across workspace modules |

After changing **module source**, run `dev:prepare` or `prepack` in that package so `dist/` is current.

---

## Creating a new app module (short)

See the full playbook. In brief:

1. `src/module.ts` + `src/runtime/` + `playground/` with `@owdproject/nuxt` and a compatible theme (for example **`nuxt-theme-paper`**).
2. Client plugin `name: 'owd-app-<slug>-register'` calling **`defineDesktopApp`**.
3. **`registerTailwindPath`** from `@owdproject/nuxt-kit-tailwind/kit/registerTailwindPath` + `"@owdproject/nuxt-kit-tailwind"` in app **`dependencies`**.
4. Scripts `dev:prepare`, `dev:generate`; register `apps/<pkg>/playground` in `pnpm-workspace.yaml`.
5. Optional: add to `desktop/desktop.config.ts`; add `pages.yml` for standalone GitHub Pages.

**Validation:** `desktop validate .` from the package directory. Check the CLI validator for the target package kind; engine and adapters are not Nuxt extensions.

---

## Human-facing documentation

- Root **`README.md`** — install, community, links ([owdproject.org](https://owdproject.org)).
- Product docs live in the **`owd-docs`** sibling repo (Docus, **English only**). Useful paths: `/getting-started/introduction`, `/architecture/overview`, `/apps/overview`, `/themes/overview`, `/setup/owd-cli`, `/internals/boot-sequence`.
- Keep **`AGENTS.md`** aligned with the repo when architecture or defaults change.

---

## Design notes (for planning, not blockers)

- **Themes as the UX surface** for different “OS” metaphors while keeping **app APIs** stable.
- **Version alignment** across Nuxt, core, and extension packages (`peerDependencies`, CI).
- **CI contracts** — `dev:prepare` + playground build per published module.
- Document **theme × module × app** compatibility (e.g. FS + explorer + classic themes).

Update this file when conventions change so agents and contributors share one source of truth.

---

## UI kits & theme stacks (CRITICAL FOR AGENTS)

Do **not** assume every theme installs PrimeVue or that `registerTailwindPath` lives in `nuxt-kit-primevue`.

### Two UI stacks

| Stack | Example theme | Theme installs | PrimeVue auto-import? |
|-------|---------------|----------------|------------------------|
| **PrimeVue** | `theme-paper`, `theme-win95`, … | `@owdproject/nuxt-kit-primevue` | Yes — `<InputText>`, `<Button>`, dialogs, … |
| **Nuxt UI** | `@owdproject/nuxt-theme-ui` (optional external repo) | `@owdproject/nuxt-kit-nuxt-ui` | **No** |

`@owdproject/nuxt-theme-ui`, `@owdproject/nuxt-kit-nuxt-ui`, and `@owdproject/nuxt-kit-tailwind` are **optional** packages (not required client skeleton submodules). Install via registry or `desktop add` when needed.

### Layering: Tailwind vs PrimeVue

| Package | Role |
|---------|------|
| **`@owdproject/nuxt-kit-tailwind`** | `registerTailwindPath` / `registerThemeTailwindPath`, installs `@nuxtjs/tailwindcss`, merges `desktopTailwindContent` globs |
| **`@owdproject/nuxt-kit-primevue`** | PrimeVue module, `tailwindcss-primeui`, dialogs, optional explorer UI — **should** wrap/install `nuxt-kit-tailwind` (today duplicates Tailwind setup; refactor pending) |

**Apps with Tailwind utility classes in Vue:**

- Import `registerTailwindPath` from **`@owdproject/nuxt-kit-tailwind/kit/registerTailwindPath`**
- Declare **`"@owdproject/nuxt-kit-tailwind": "workspace:*"`** (or semver) in app **`dependencies`**
- This is **build-time** for the app module — independent of which theme is active

**Apps using PrimeVue components in templates** (`InputText`, `Button`, …):

- Do **not** add `nuxt-kit-primevue` to the app for that alone
- Components resolve at **runtime** only when the theme ran `installModule('@owdproject/nuxt-kit-primevue')`
- Apps using PrimeVue markup are **incompatible** with `@owdproject/nuxt-theme-ui` unless refactored to Nuxt UI or plain HTML

**Playground with `nuxt-theme-paper`:** transitively loads `nuxt-kit-primevue` — do not treat that as proof that all themes provide PrimeVue.

---

## Desktop extension contract

A **desktop distribution** (`@owdproject/nuxt-desktop` today; `@owdproject/react-desktop`,
`@owdproject/svelte-desktop`, … later) collects **extensions** from three directories and composes
them into a ready-to-use workspace:

| Directory | Kind | Package convention |
|-----------|------|--------------------|
| `apps/` | `app` | `@owdproject/<framework>-app-*` |
| `modules/` (monorepo: `packages/`) | `module` | `@owdproject/<framework>-module-*` |
| `themes/` | `theme` | `@owdproject/<framework>-theme-*` |
| — (explicitly installed by consumers/themes) | `kit` | `@owdproject/<framework>-kit-*` |

The declarative type is `DesktopExtensionMeta` (`packages/nuxt/src/types/index.ts:121`). Metadata is resolved through Nuxt's module loader and `getMeta()`; `installDesktopPackage` validates explicitly declared extension contracts before setup and forwards `configKey` options (`packages/nuxt/src/kit/authoring.ts:266`, `packages/nuxt/src/kit/authoring.ts:330`):

| Field | Meaning |
|-------|---------|
| `kind` | `app` \| `module` \| `theme` \| `kit` |
| `framework` | `nuxt` \| `vue` \| `react` \| `svelte` \| `angular` \| `astro` — the adapter the extension targets |
| `packageName` | Full package name (framework-first convention) |
| `configKey` | Runtime namespace on `runtimeConfig.public.desktop[...]` |
| `entry` | Build-time entry (Nuxt module); defaults to the package root export |
| `adapter` | Binding required at runtime, e.g. `@owdproject/nuxt` |
| `requires` | Kits/modules the extension expects the theme/desktop to provide |

Helpers available through `@owdproject/nuxt/kit` (`packages/nuxt/src/kit/authoring.ts:30`):

- `DESKTOP_EXTENSION_DIRS` — default `{ apps, modules, themes }` collection slots.
- `parseDesktopExtensionName(shortName)` — parses `nuxt-app-todo` → `{ framework, kind, name }`.
- `readExtensionMeta(packageName)` — reads the contract from a package's module `meta`.
- `assertDesktopExtensionMeta(meta, pkg)` — validates declared kind/framework and optional field shapes (`packages/nuxt/src/kit/authoring.ts:275`).

`defineDesktopModule` / `defineDesktopTheme` keep accepting `meta.configKey`; name/configKey-only modules remain supported. Declaring extension-specific contract fields opts into kind/framework validation. The Nuxt host rejects other declared frameworks/adapters and checks `requires` against prior installed integration records, excluding explicitly disabled modules (`packages/nuxt/src/kit/authoring.ts:302`). This does not install dependencies, reorder modules, prove runtime readiness or negotiate versions. Nested direct Nuxt installers are not recursively gated. See the [Nuxt extension contract](../packages/nuxt/docs/extension-contract.md) for exact limits and standalone verification requirements.

---

## Workspace & Override Rules (CRITICAL FOR AGENTS)

* **No ad-hoc overrides in `pnpm-workspace.yaml`**: The OWD client repository is designed to be cloned empty of optional extension packages, themes, and apps (with required engine/binding/tooling packages and without requiring optional extensions).
* Do **NOT** add overrides (e.g. forcing `workspace:*` for optional packages like `@owdproject/nuxt-module-pinia-persistence` or other modules/apps/themes) in `pnpm-workspace.yaml` or other core configuration files.
* Downstream projects and developers should be able to install and load external/optional packages dynamically without requiring modifications to the client skeleton/workspace files.
* If a package is being resolved from the npm registry instead of a local path during development, the correct approach is to run `pnpm install` or use the `workspace:` protocol in the specific test/theme `package.json` that requires it, rather than setting up workspace-wide overrides.
