# From one Nuxt client to framework-specific desktops

**Engineering note · 30 October 2026**

This is a follow-up to [Why we rebuilt the Web Desktop as a modular Nuxt framework](https://dev.to/dxlliv/why-we-rebuilt-the-web-desktop-as-a-modular-nuxt-framework-5h8o). That article remains as it was written: it describes the point when OWD was a Nuxt-first modular framework. This note records the next architectural step we are considering as the project grows beyond Nuxt.

## The client taught us what a desktop needs

OWD began with one Nuxt client. Its apps, modules and themes made a web desktop easier to change than a single, tightly coupled application. The client also gave contributors a real place to see those pieces working together.

As the project matured, those pieces began to have different jobs. Window and application management can live in a framework-independent engine. Nuxt-specific components, stores, authoring helpers and orchestration belong in a Nuxt adapter. Apps, themes and modules can then build on top of those contracts.

That separation is now visible in the package layout: `@owdproject/core` is the engine, while `@owdproject/nuxt` is the Nuxt integration. React and other framework adapters are part of the ecosystem too. Keeping the core free of Vue and Nuxt lets the same desktop concepts travel across frameworks instead of turning every adapter into a second engine.

## One adapter is not the whole desktop

The adapter and the finished desktop serve different needs. An adapter helps a developer use OWD inside a framework project. A desktop distribution gives them a working composition: a host application, a default theme, selected apps and modules, and a place to replace or add those pieces.

We are exploring a family of framework-specific desktop projects:

- `@owdproject/nuxt-desktop` as the evolution of the current Nuxt client;
- `@owdproject/react-desktop` as a React desktop built on the same core and React adapter;
- corresponding desktop projects for Angular, Svelte and Astro as those integrations mature.

In this model, each desktop collects extensions in familiar directories such as `/themes`, `/modules` and `/apps`. A Nuxt distribution could use a Nuxt UI-based theme and Nuxt modules. A React distribution could showcase a React UI kit—perhaps React95, or a kit we build for OWD—and React-specific apps. The choices make each desktop feel native to its framework while demonstrating what that framework’s ecosystem can do.

The desktop projects would be useful products in their own right and public examples of the adapters. They would not move framework UI into `core`; they would assemble framework-specific pieces around the shared engine.

## A folder convention needs a package contract

The `/themes`, `/modules` and `/apps` directories are a useful way to work in a desktop repository. At a larger scale, the folder names alone cannot tell a host what an extension supports or how to load it. Each extension will need clear metadata: its kind, framework, entry point, compatible adapter versions and package dependencies.

Discovery should happen through the framework’s build and configuration system. Nuxt and React bundle their own extensions using their respective adapters. The shared contract can describe what an extension is; each adapter handles how that extension joins a desktop. This leaves room for a desktop to combine local folders with independently installed packages, without making the browser search arbitrary directories at runtime.

The same distinction will help when the catalog grows. A hundred modules should still be discoverable by their package name, compatibility and dependencies, rather than by knowing which desktop repository happened to include them first.

## Names should show the layers

The naming question is part of the architecture. `@owdproject/nuxt` should keep describing the Nuxt adapter. `@owdproject/nuxt-desktop` would describe the assembled Nuxt desktop. The same pattern—`@owdproject/react` and `@owdproject/react-desktop`—makes the relationship visible across frameworks.

Some extension names are less natural. For example, `@owdproject/module-nuxt-pinia-persistence` puts the extension kind before the framework. A framework-first family such as `@owdproject/nuxt-module-pinia-persistence`, `@owdproject/nuxt-theme-paper` and `@owdproject/nuxt-app-terminal` may be easier to scan beside `@owdproject/react-*` packages. We should settle one rule and apply it consistently before the next public release, while checking existing npm names and dependencies before changing identities.

There is one historical wrinkle: `nuxt-desktop` was used for a deprecated package identity, and the current repository rules still prohibit importing or depending on that legacy package. The proposed scoped name `@owdproject/nuxt-desktop` is intended for the new desktop distribution. The guard and contributor instructions must distinguish those identities before implementation; this article records the direction, not a completed rename.

## Where the release work stands

Recent release preparation reported successful `npm pack --dry-run` checks for 35 candidate packages. That confirms their packaging lifecycle completed; it does not mean the packages have been published or that every combination works at runtime. The standalone Verdaccio test for the Paper theme and its playground passed. Nova’s isolated build exposed imports that still refer to composables moved in the Nuxt adapter, so Nova remains blocked until those references are updated and retested.

The `private: false` change for `@owdproject/module-nuxt-fs` is present in the local checkout as part of release preparation. No package publication is implied by that change, and no package has been published as part of these checks.

The next step is to settle the package map and then refactor the client into the Nuxt desktop collector. The other framework desktops can follow the same core and extension contracts as their adapters and UI kits become ready. This gives OWD a path from one useful Nuxt client to a family of desktops without losing the shared engine or the open extension model that led us here.
