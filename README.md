# F76 Collection Logger

Static Fallout 76 collection logger for CAMP-displayable collectibles, chase apparel, and solo-obtainable outfits that still have a legitimate in-game acquisition path.

## What is included

- 456 tracked entries with local images
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
- Outfits for mannequin displays
- Fasnacht masks
- Atomic Shop, paid unlocks, external promo gear, and season-locked legacy rewards excluded

## Use

1. Open [index.html](./index.html) in a browser.
2. Use `Review Outfits` or `Missing Outfits` to jump into the mannequin list quickly.
3. Mark items as collected, or use `Collect + Next` in the detail panel to sweep through a review run.
4. Use the detail panel to jump to source pages for acquisition notes.

Progress is not stored in cookies, cache, or browser local storage. Save a JSON log file locally with `Save Log`, then load it back with `Load Log` whenever you want to continue.

## Refresh the data

Run:

```powershell
node scripts/build-data.mjs
```

That rebuilds [data/collectibles.js](./data/collectibles.js) and refreshes local images under [assets/images](./assets/images).

## Build a single shareable file

Run:

```powershell
cmd /c npm exec --yes --package=sharp node scripts/build-shareable-html.mjs
```

That emits [Fallout76-CAMP-Collectibles-Shareable.html](./Fallout76-CAMP-Collectibles-Shareable.html), a single self-contained tracker file with embedded images that can be sent directly.
