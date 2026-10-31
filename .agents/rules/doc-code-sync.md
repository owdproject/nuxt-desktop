# Rules: coerenza documentazione ↔ codice

Questa regola nasce da un incidente reale, non da un principio astratto.

## L'incidente

31 ottobre 2026. Una ricognizione automatica ha affermato: *"il contratto
`DesktopExtensionMeta`, descritto in `.agents/AGENTS.md`, non esiste nel codice:
un grep su tutto il repo lo trova solo in `AGENTS.md`"*.

**Era falso.** Il contratto esiste, implementato e completo:

- `packages/nuxt/src/types/index.ts:121` — `export interface DesktopExtensionMeta`
- `packages/nuxt/src/kit/authoring.ts` — `DESKTOP_EXTENSION_DIRS` (riga 30),
  `parseDesktopExtensionName` (57), `readExtensionMeta` (280),
  `assertDesktopExtensionMeta` (299), `installDesktopPackage` (334),
  `defineDesktopModule` (372)

La conclusione sbagliata è stata poi riportata come se fosse accertata, e stava
per finire in una decisione. Nella stessa giornata, la prima versione del guard
`scripts/check-doc-symbols.mjs` dichiarava "zero derive" mentre la deriva la stava
cercando: certificava l'esistenza di un simbolo perché il proprio commento lo
nominava.

Due fallimenti simmetrici:

| | Chi | Errore | Perché è pericoloso |
|---|---|---|---|
| 1 | Ricognizione | "X non esiste" senza ricerca completa | Un agente ci costruisce sopra |
| 2 | Guard | "X esiste" perché si auto-citava | Il controllo dice il falso con sicurezza |

Regola che ne deriva: **un'affermazione di assenza è un'affermazione, non
un'osservazione.** È la più fragile di tutte, perché dipende dalla completezza
della ricerca invece che da un fatto trovato.

## Regole

### 1. Ogni affermazione sul codice porta una citazione verificabile

Formato: `path/file.ts:riga`. Senza citazione, un'affermazione sul codice non entra
in un documento, in un report, in una decisione o in un post.

Vale **sempre** per le affermazioni di assenza ("non esiste", "manca", "non è
implementato"), perché sono quelle su cui è più facile sbagliare e più costoso
fidarsi.

### 2. Per dire "non esiste", cerca in tutto il repo e dichiara il perimetro

Il comando di riferimento, da eseguire **prima** di scrivere una negazione:

```bash
grep -rn --include='*.ts' --include='*.vue' --include='*.mjs' -w 'SimboloDaCercare' \
  packages/*/src apps/*/src themes/*/src scripts/ \
  | grep -v node_modules
```

Se la ricerca usa filtri (estensione, directory, `--exclude`), **il filtro va
dichiarato insieme alla conclusione**. Un'assenza trovata con un filtro stretto non
è un'assenza: è un'assenza-nel-sottoinsieme.

### 3. Documenti che descrivono il futuro si dichiarano

Un documento che descrive uno stato *obiettivo* (un refactor da fare, un pacchetto
da creare) **deve** dichiararlo in testa:

```markdown
<!-- drift-guard: status=plan -->
```

Altrimenti un piano scritto al presente è indistinguibile da una descrizione del
presente — ed è esattamente la deriva che il guard deve fermare. Il marcatore va
tolto quando il lavoro è completo: da quel momento il documento torna a essere
verificato come descrizione del presente.

### 4. Simboli definiti altrove si dichiarano con un motivo

Un simbolo documentato qui ma definito in un altro repo va in
`scripts/doc-symbols.allow.json`, **con motivazione**. L'allowlist è una decisione,
non un pulsante per zittire il guard. Se il simbolo non è più documentato, la voce
si rimuove.

### 5. Il guard gira, e se è rosso si corregge la causa

```bash
pnpm run check:docs      # node scripts/check-doc-symbols.mjs --all
```

Gira in CI (`.github/workflows/ci.yml`). Quando fallisce, l'ordine dei rimedi è:

1. il simbolo esiste con un altro nome → **correggi la documentazione**;
2. il documento descrive il futuro → **aggiungi il marcatore `status=plan`**;
3. il simbolo vive altrove → **allowlist con motivo**.

Non esiste un quarto rimedio che consista nell'allargare l'allowlist per far
passare il check.

### 6. Il guard deve poter fallire

`check-doc-symbols.mjs` contiene `assertSelfCheck()`. Se il corpus dei simboli è
vuoto, se la funzione di riconoscimento è rotta, o se il guard stesso è l'unica
fonte di un simbolo, il guard **esce con errore** invece di dichiarare "tutto ok".
Un controllo che non può fallire non è un controllo. Vale per qualunque guard
venga aggiunto: va provato con un caso che deve fallire.

### 7. Non promettere in pubblico ciò che non esiste

Vale per i post social e per la documentazione pubblica come per il codice. La
regola di voce di `docs/`/`README` è la stessa di `persona.md` sull'account: niente
annunci di cose non rilasciate. Prima il contratto, poi il racconto.

## Nota su questo documento

Le citazioni al punto "L'incidente" sono state verificate. Se in futuro qualcuno
rinomina quei simboli, questo file va aggiornato insieme al codice: anche questo
documento è soggetto alla regola 1.
