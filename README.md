# F76 Collection Logger

Static Fallout 76 collection logger for CAMP-displayable collectibles, chase apparel, and solo-obtainable outfits that still have a legitimate live in-game acquisition path today.

## What is included

- 379 tracked entries with local images
- Full magazine set: 104 issues
- Standard and glowing bobbleheads
- Teddy bears
- Mr. Fuzzy pencils
- Mr. Fuzzy variants
- Nuka-Cola variants
- Beer steins
- Snow globes
- Cryptid cards
- Souvenirs
- Tabletop games
- Giddyup Buttercup parts
- Robot models
- Outfits for mannequin displays: 140 current entries
- Lootable Fasnacht masks with live world spawns
- Atomic Shop, paid unlocks, external promo gear, retired rewards, and currently unavailable seasonal event items excluded
- Explicit rarity metadata on every item for filtering and rarest-first review runs
- The clown outfit is intentionally excluded from the tracker build

## Use

1. Open [index.html](./index.html) in a browser.
2. Pick or create a local profile in the sidebar. The active profile auto-loads in the same browser next time.
3. Use `Review Outfits` or `Missing Outfits` to jump into the mannequin list quickly.
4. Use the `Rarity` filter or `Rarity` sort to surface chase items first.
5. Mark items as collected, or use `Collect + Next` in the detail panel to sweep through a review run.
6. Use the detail panel to jump to source pages for acquisition notes.

Progress is not stored in cookies, cache, or `localStorage`. The site stores each profile locally with IndexedDB on the current machine and browser. `Save Log` exports the active profile to a JSON backup file, and `Load Log` imports a JSON backup back into the active profile.

Use `New Profile`, `Rename`, and `Delete` to manage multiple local logs on the same device. `Reset Profile` clears only the active profile.

## Refresh the data

Run:

```powershell
node scripts/build-data.mjs
```

That rebuilds [data/collectibles.js](./data/collectibles.js) and refreshes local images under [assets/images](./assets/images).

## Run the regression check

Run:

```powershell
node scripts/check-data-regressions.mjs
```

This verifies the current audited dataset counts, required include/exclude items, banned acquisition sources, and the presence of rarity metadata.

## Build a single shareable file

Run:

```powershell
cmd /c npm exec --yes --package=sharp node scripts/build-shareable-html.mjs
```

That emits [Fallout76-CAMP-Collectibles-Shareable.html](./Fallout76-CAMP-Collectibles-Shareable.html), a single self-contained tracker file with embedded images that can be sent directly.
