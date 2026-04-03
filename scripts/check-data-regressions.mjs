import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "data", "collectibles.js");

const expectedCategoryCounts = {
  "Beer Steins": 2,
  Bobbleheads: 40,
  "Cryptid Cards": 8,
  "Fasnacht Masks": 2,
  "Giddyup Buttercup Parts": 4,
  Magazines: 104,
  "Mr. Fuzzy Pencils": 3,
  "Mr. Fuzzy Variants": 14,
  "Nuka-Cola Variants": 12,
  Outfits: 140,
  "Robot Models": 8,
  "Snow Globes": 17,
  Souvenirs: 7,
  "Tabletop Games": 6,
  "Teddy Bears": 12
};

const requiredNames = [
  "Asylum Worker Uniform Red",
  "Ranger Outfit Clean",
  "Pastor's Vestments",
  "Redcoat Outfit",
  "Metal Beer Stein",
  "Wooden Beer Stein",
  "Fasnacht Blue Man Mask",
  "Fasnacht Man Mask"
];

const excludedNames = [
  "Alien Souvenir Beer Stein",
  "Whitespring Jumpsuit",
  "Ghost Skeleton Costume",
  "Treasure Hunter Outfit",
  "Ulysses Outfit",
  "Piper's Press Outfit",
  "Fasnacht Winter Man Mask",
  "Clown Outfit"
];

const bannedAcquisitionPatterns = [
  /Atomic Shop/i,
  /Fallout 1st/i,
  /Starter Bundle/i,
  /Prime Gaming/i,
  /Twitch Prime/i,
  /Spooky Scorched/i,
  /Treasure Hunters?/i,
  /Holiday Scorched/i,
  /Holiday Gift/i,
  /Meat Week/i,
  /Mothman Equinox/i,
  /Invaders from Beyond/i,
  /Mischief Night/i,
  /season rewards?/i,
  /scoreboard/i,
  /Nuclear Winter/i
];

async function main() {
  const source = await readFile(dataPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: dataPath });

  const dataset = context.window.F76_COLLECTIBLES;
  assert.ok(dataset, "Dataset was not assigned to window.F76_COLLECTIBLES.");
  assert.equal(dataset.title, "Fallout 76 CAMP Collectibles Tracker");

  const totalExpected = Object.values(expectedCategoryCounts).reduce((sum, count) => sum + count, 0);
  assert.equal(dataset.items.length, totalExpected, `Expected ${totalExpected} total items.`);
  assert.equal(dataset.categories.length, Object.keys(expectedCategoryCounts).length, "Unexpected category count.");

  for (const [label, expectedCount] of Object.entries(expectedCategoryCounts)) {
    const category = dataset.categories.find((entry) => entry.label === label);
    assert.ok(category, `Missing category ${label}.`);
    assert.equal(category.count, expectedCount, `Unexpected count for ${label}.`);
  }

  assert.ok(Array.isArray(dataset.rarityScale) && dataset.rarityScale.length === 5, "Missing rarity scale metadata.");

  for (const item of dataset.items) {
    assert.ok(item.id, "Each item must have an id.");
    assert.ok(item.name, "Each item must have a name.");
    assert.ok(item.image, `Item ${item.name} is missing an image.`);
    assert.ok(Array.isArray(item.locationNotes), `Item ${item.name} is missing location notes metadata.`);
    assert.ok(Array.isArray(item.sourceLinks) && item.sourceLinks.length > 0, `Item ${item.name} is missing source links.`);
    assert.ok(item.sourceSummary || item.locationNotes.length > 0, `Item ${item.name} is missing acquisition text.`);
    assert.ok(item.rarity, `Item ${item.name} is missing a rarity label.`);
    assert.equal(typeof item.rarityRank, "number", `Item ${item.name} is missing a numeric rarity rank.`);

    const acquisitionText = [item.tier, item.sourceSummary, ...(item.locationNotes || [])].filter(Boolean).join(" ");
    for (const pattern of bannedAcquisitionPatterns) {
      assert.ok(!pattern.test(acquisitionText), `Item ${item.name} matched banned acquisition pattern ${pattern}.`);
    }
  }

  const itemNames = new Set(dataset.items.map((item) => item.name));
  for (const name of requiredNames) {
    assert.ok(itemNames.has(name), `Expected item missing: ${name}.`);
  }
  for (const name of excludedNames) {
    assert.ok(!itemNames.has(name), `Excluded item unexpectedly present: ${name}.`);
  }

  console.log(`Regression check passed for ${dataset.items.length} items across ${dataset.categories.length} categories.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
