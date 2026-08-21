# AGENTS.md

Blix is a static Vite + TypeScript SPA. It matches iPhone EXIF/GPS onto film scans **in the browser** and exports a ZIP. The GitHub repo may still be named `film-photo-sync`; the product name is **Blix**.

## Constraints

- Keep photo processing client-side. Do not upload scans or iPhone photos to a server.
- Stay vanilla DOM. Do not add React, Vue, Tailwind, or a component library.
- HTML element **ids** are the UI contract with `src/main.ts`. Do not rename them without updating the script.
- Auto-Match (`#auto-match-btn`) is a stub (`alert`). Do not pretend it works.

## File map

| Path | Role |
|------|------|
| `index.html` | All markup: landing + 5-step wizard. Ids must stay stable. |
| `src/main.ts` | All app logic: landing, load, match, interpolate, EXIF, export |
| `src/style.css` | All styles. Swiss editorial tokens; no other stylesheet |
| `public/logo.svg` | Geometric B monogram (source). `logo.png` / `favicon.png` are raster exports |

There is no auth and no server API. Deploy as a static Vite site.

## Wizard data

Types in `src/main.ts`:

- `PhotoItem` — file, preview URL, optional `date` / GPS / `tzOffset`
- `Assignment` — `{ date, matchedTo?, method: "matched" | "interpolated" | "clamped" }`
- `RenameConfig` — `{ prefix, startNumber }`

Flow: upload iPhone + film → start/end anchors → drag-match on the iPhone timeline → `buildAssignments()` interpolates unmatched frames between neighboring matches (or clamps to the nearest) → optional rename → ZIP (`blix.zip`).

- JPEG EXIF via `piexifjs`: preserve existing tags, patch dates, replace the GPS IFD when iPhone coordinates are available
- TIFF DateTime + GPS via the custom IFD writer in `main.ts`
- TIFF preview decode via `utif`

## UI

First screen is `#landing`. `#start-btn` hides it and shows `#app`. Step visibility is `.hidden` on `#upload-section` … `#export-section`. `setSectionVisible` also toggles `.is-current` on `[data-step-target]` in the app bar.

Visual system: off-white paper, black ink, signal red `#e6322b`, Instrument Sans + IBM Plex Mono. No emoji, glows, or card soup. See `.cursor/rules/ui.mdc`.
