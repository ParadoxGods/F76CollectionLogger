import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const imageRoot = path.join(rootDir, "assets", "images");
const apiBase = "https://fallout.fandom.com/api.php";
const communityApiBase = "https://fallout.wiki/api.php";

const sharedSources = [
  {
    label: "Display case (Fallout 76)",
    url: wikiUrl("Display case (Fallout 76)"),
    note: "Used to anchor which item types are CAMP-displayable."
  },
  {
    label: "Displayability",
    url: wikiUrl("Displayability"),
    note: "Reference for CAMP display rules."
  }
];

const rarityScale = [
  {
    label: "Mythic",
    rank: 1,
    note: "Extremely low-drop chase items and the rarest collector targets."
  },
  {
    label: "Ultra Rare",
    rank: 2,
    note: "Very low-probability rewards, rare vendor rolls, and top-end event drops."
  },
  {
    label: "Rare",
    rank: 3,
    note: "Limited-pool event rewards, randomized collectible spawns, and uncommon quest drops."
  },
  {
    label: "Uncommon",
    rank: 4,
    note: "Repeatable vendor, plan, token, or collectible unlock paths."
  },
  {
    label: "Common",
    rank: 5,
    note: "Reliable world-spawn and always-available world-object items."
  }
];

const rarityRankMap = Object.fromEntries(rarityScale.map((entry) => [entry.label, entry.rank]));
const tierRarityMap = {
  "Event Chase": "Mythic",
  "Event Rare": "Ultra Rare",
  "Daily Ops": "Ultra Rare",
  "Event Reward": "Rare",
  "Event Plan": "Rare",
  "Quest Reward": "Rare",
  "Random Spawn": "Rare",
  "Special Variant": "Rare",
  "Plan Unlock": "Uncommon",
  "NPC Unlock": "Uncommon",
  "Token Redemption": "Uncommon",
  "Collectible Reward": "Uncommon",
  "Vendor/World": "Uncommon",
  "World/Utility": "Uncommon",
  "World Spawn": "Common",
  "World Object": "Common"
};

async function main() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(imageRoot, { recursive: true });

  const [
    teddyBears,
    mrFuzzy,
    mrFuzzyPencils,
    bobbleheads,
    magazines,
    nukaCola,
    beerSteins,
    cryptidCards,
    snowGlobes,
    souvenirs,
    tabletopGames,
    giddyupParts,
    robotModels,
    outfits,
    fasnachtMasks
  ] = await Promise.all([
    buildTeddyBears(),
    buildMrFuzzy(),
    buildMrFuzzyPencils(),
    buildBobbleheads(),
    buildMagazines(),
    buildNukaCola(),
    buildBeerSteins(),
    buildCryptidCards(),
    buildSnowGlobes(),
    buildSouvenirs(),
    buildTabletopGames(),
    buildGiddyupParts(),
    buildRobotModels(),
    buildOutfits(),
    buildFasnachtMasks()
  ]);

  const items = [
    ...bobbleheads,
    ...magazines,
    ...teddyBears,
    ...mrFuzzy,
    ...mrFuzzyPencils,
    ...nukaCola,
    ...beerSteins,
    ...cryptidCards,
    ...snowGlobes,
    ...souvenirs,
    ...tabletopGames,
    ...giddyupParts,
    ...robotModels,
    ...outfits,
    ...fasnachtMasks
  ]
    .map(annotateItemRarity)
    .sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    if (a.group !== b.group) {
      return a.group.localeCompare(b.group);
    }
    return a.name.localeCompare(b.name);
    });

  const categories = Array.from(
    items.reduce((map, item) => {
      if (!map.has(item.categoryId)) {
        map.set(item.categoryId, {
          id: item.categoryId,
          label: item.category,
          displayType: item.displayType,
          count: 0
        });
      }
      map.get(item.categoryId).count += 1;
      return map;
    }, new Map()).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const dataset = {
    generatedAt: new Date().toISOString(),
    title: "Fallout 76 CAMP Collectibles Tracker",
    scope:
      "Distinct displayable collector sets, dedicated junk collectible families, chase apparel, and solo-obtainable outfits for CAMP presentation that still have a legitimate live in-game acquisition path today. Atomic Shop items, paid unlocks, external promo gear, retired rewards, and currently unavailable seasonal event items are excluded.",
    rarityScale,
    categories,
    sources: [
      ...sharedSources,
      {
        label: "Fallout 76 magazines",
        url: wikiUrl("Fallout 76 magazines"),
        note: "Issue list and magazine collection totals."
      },
      {
        label: "Vault-Tec bobblehead (Fallout 76)",
        url: wikiUrl("Vault-Tec bobblehead (Fallout 76)"),
        note: "Bobblehead types and effects."
      },
      {
        label: "Glowing Bobblehead",
        url: communityWikiUrl("Glowing Bobblehead"),
        note: "Ghoul bobblehead overview and the glowing variant family."
      },
      {
        label: "Fallout 76 bobblehead locations",
        url: wikiUrl("Fallout 76 bobblehead locations"),
        note: "Bobblehead spawn-route reference."
      },
      {
        label: "Teddy bear (Fallout 76)",
        url: wikiUrl("Teddy bear (Fallout 76)"),
        note: "Teddy bear variants and location notes."
      },
      {
        label: "Mr. Fuzzy",
        url: wikiUrl("Mr. Fuzzy"),
        note: "Mr. Fuzzy variants and redemption info."
      },
      {
        label: "Mr. Fuzzy pencil",
        url: wikiUrl("Mr. Fuzzy pencil"),
        note: "Three collectible Mr. Fuzzy pencil variants and Camden Park redemption details."
      },
      {
        label: "Nuka-Cola (Fallout 76)",
        url: wikiUrl("Nuka-Cola (Fallout 76)"),
        note: "Nuka-Cola variants and Appalachia sourcing."
      },
      {
        label: "Cryptid trading cards",
        url: wikiUrl("Cryptid trading cards"),
        note: "Event pools for the eight displayable cryptid cards."
      },
      {
        label: "Stein",
        url: communityWikiUrl("Stein"),
        note: "Current beer stein pages used to keep only the live-obtainable steins."
      },
      {
        label: "Snow Globe (Fallout 76)",
        url: communityWikiUrl("Snow Globe (Fallout 76)"),
        note: "Fallout 76 snow globe variants and the dedicated display case family."
      },
      {
        label: "Giddyup Buttercup parts (Fallout 76)",
        url: wikiUrl("Giddyup Buttercup parts (Fallout 76)"),
        note: "Four-piece collectible toy-part set with separate world spawns."
      },
      {
        label: "Chessboard (Fallout 76)",
        url: wikiUrl("Chessboard (Fallout 76)"),
        note: "Dedicated tabletop junk collectible with multiple repeatable world spawns."
      },
      {
        label: "Fallout 76 Outfits",
        url: communityWikiUrl("Fallout 76 Outfits"),
        note: "Current outfit overview used to audit mannequin displays and keep only live-obtainable entries."
      },
      {
        label: "Category:Fallout 76 outfits",
        url: communityWikiUrl("Category:Fallout 76 outfits"),
        note: "Live outfit category used to re-audit the full mannequin-displayable apparel pool against current acquisition paths."
      },
      {
        label: "Category:Fasnacht Masks",
        url: communityWikiUrl("Category:Fasnacht Masks"),
        note: "Current Fallout 76 Fasnacht mask and helmet category used to keep only masks with a live lootable path."
      }
    ],
    items
  };

  const output = `window.F76_COLLECTIBLES = ${JSON.stringify(dataset, null, 2)};\n`;
  await writeFile(path.join(dataDir, "collectibles.js"), output, "utf8");

  const summary = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  console.log("Generated dataset:", path.join("data", "collectibles.js"));
  console.log("Category counts:", summary);
  console.log("Total items:", items.length);
}

async function buildTeddyBears() {
  const pageTitle = "Teddy bear (Fallout 76)";
  const wikitext = await getWikitext(pageTitle);
  const variantsSection = extractSection(wikitext, "Variants");
  const locationBullets = extractBullets(extractSection(wikitext, "Locations"));
  const rows = parseWikiTableRows(variantsSection);
  const preferredNotes = pickBullets(locationBullets, [
    /each variant/i,
    /Camden Park/i,
    /Pleasant Valley Ski Resort/i
  ]);

  const items = [];
  for (const row of rows) {
    const fileName = parseFileName(row[0]);
    const link = parseWikiLink(row[1]);
    const image = await downloadWikiFile(
      fileName,
      path.join("teddy-bears", `${slugify(link.label || link.title)}${extnameFromFile(fileName)}`)
    );
    items.push({
      id: `teddy-${slugify(link.label || link.title)}`,
      name: link.label || link.title,
      categoryId: "teddy-bears",
      category: "Teddy Bears",
      group: "Collector Set",
      displayType: "Display Case",
      tier: "World Spawn",
      sourceSummary: "Static world spawns. Tyler County Fairgrounds is the best single spot because it has at least one of every variant.",
      locationNotes: preferredNotes,
      effect: "",
      image,
      wikiTitle: link.title,
      sourceLinks: [
        makeSource(pageTitle, "Variant list"),
        makeSource(link.title, "Item page")
      ]
    });
  }

  return items;
}

async function buildMrFuzzy() {
  const pageTitle = "Mr. Fuzzy";
  const wikitext = await getWikitext(pageTitle);
  const variantsSection = extractSection(wikitext, "Variants");
  const gallerySection = extractSection(wikitext, "Gallery");
  const locationBullets = extractBullets(extractSection(wikitext, "Locations"));
  const variantLines = variantsSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("* "));
  const galleryMap = parseGalleryMap(gallerySection);
  const preferredNotes = pickBullets(locationBullets, [/Camden Park/i, /20 .*token/i, /Smith farm/i]);

  const items = [];
  for (const line of variantLines) {
    const name = cleanWiki(line.replace(/^\*\s*/, ""));
    const fileName = galleryMap.get(name) || galleryMap.get(name.toLowerCase());
    const image = fileName
      ? await downloadWikiFile(
          fileName,
          path.join("mr-fuzzy", `${slugify(name)}${extnameFromFile(fileName)}`)
        )
      : await downloadPageImage("Mr. Fuzzy", path.join("mr-fuzzy", `${slugify(name)}.png`));

    items.push({
      id: `mr-fuzzy-${slugify(name)}`,
      name,
      categoryId: "mr-fuzzy",
      category: "Mr. Fuzzy Variants",
      group: "Collector Set",
      displayType: "Display Case",
      tier: /^Jumbo /i.test(name) ? "Token Redemption" : "World Spawn",
      sourceSummary: /^Jumbo /i.test(name)
        ? "Jumbo variants come from Mr. Fuzzy token redemption terminals at Camden Park."
        : "Most variants are static world spawns around Camden Park and a small number of off-route locations.",
      locationNotes: preferredNotes,
      effect: "",
      image,
      wikiTitle: pageTitle,
      sourceLinks: [makeSource(pageTitle, "Variant list and locations")]
    });
  }

  return items;
}

async function buildMrFuzzyPencils() {
  const pageTitle = "Mr. Fuzzy pencil";
  const wikitext = await getWikitext(pageTitle);
  const galleryMap = parseGalleryMap(extractSection(wikitext, "Gallery"));
  const locationBullets = extractBullets(extractSection(wikitext, "Locations"));
  const noteLines = extractBullets(extractSection(wikitext, "Notes"));
  const variantNames = ["Mr. Fuzzy pencil", "Yellow Mr. Fuzzy pencil", "Spooky Mr. Fuzzy pencil"];

  const items = [];
  for (const name of variantNames) {
    const fileName = name === "Mr. Fuzzy pencil" ? parseFirstImageFile(wikitext) : galleryMap.get(name);
    const image = fileName
      ? await downloadWikiFile(
          fileName,
          path.join("mr-fuzzy-pencils", `${slugify(name)}${extnameFromFile(fileName)}`)
        )
      : await downloadPageImage(pageTitle, path.join("mr-fuzzy-pencils", `${slugify(name)}.png`));

    items.push({
      id: `mr-fuzzy-pencil-${slugify(name)}`,
      name,
      categoryId: "mr-fuzzy-pencils",
      category: "Mr. Fuzzy Pencils",
      group: "Novelty Set",
      displayType: "Display Case",
      tier: "Token Redemption",
      sourceSummary:
        "Redeem five Mr. Fuzzy tokens at the Camden Park prize terminal. The terminal-randomized pencil variant can also rarely appear in random containers and on corpses.",
      locationNotes: [
        ...trimBullets(locationBullets, 2),
        noteLines[0] || "The prize-terminal reward is randomized each time, so duplicates are expected while finishing the three-pencil set."
      ],
      effect: "",
      image,
      wikiTitle: pageTitle,
      sourceLinks: [makeSource(pageTitle, "Variant page")]
    });
  }

  return items;
}

async function buildBobbleheads() {
  const itemPage = "Vault-Tec bobblehead (Fallout 76)";
  const routePage = "Fallout 76 bobblehead locations";
  const wikitext = await getWikitext(itemPage);
  const glowingOverviewTitle = "Glowing Bobblehead";
  const glowingOverview = await getCommunityWikitext(glowingOverviewTitle);
  const glowingTitles = (await getCommunityCategoryMembers("Category:Fallout 76 Glowing Bobbleheads"))
    .filter((title) => title !== glowingOverviewTitle)
    .sort((a, b) => a.localeCompare(b));

  const groups = [
    { heading: "S.P.E.C.I.A.L.", label: "S.P.E.C.I.A.L." },
    { heading: "Utility", label: "Utility" },
    { heading: "Weapons", label: "Weapons" }
  ];

  const items = [];
  for (const group of groups) {
    const section = extractSubheadingSection(wikitext, group.heading, 3);
    const rows = parseWikiTableRows(section);
    for (const row of rows) {
      const link = parseWikiLink(row[0]);
      const image = await downloadPageImage(
        link.title,
        path.join("bobbleheads", `${slugify(link.label || link.title)}.png`)
      );
      items.push({
        id: `bobblehead-${slugify(link.label || link.title)}`,
        name: link.label || link.title,
        categoryId: "bobbleheads",
        category: "Bobbleheads",
        group: group.label,
        displayType: "Bobblehead Stand",
        tier: "Random Spawn",
        sourceSummary:
          "Bobbleheads spawn randomly at fixed bobblehead points. Other players can loot them first, and they can roll off physics surfaces.",
        locationNotes: [
          "Use the dedicated bobblehead route page for spawn runs across Appalachia.",
          "Bobbleheads are randomized at known bobblehead points rather than guaranteed by type.",
          "Glowing bobbleheads are tracked separately in this checklist as the ghoul-era counterpart set."
        ],
        effect: cleanWiki(row[1]),
        image,
        wikiTitle: link.title,
        sourceLinks: [makeSource(itemPage, "Type and effect"), makeSource(routePage, "Spawn route")]
      });
    }
  }

  for (const title of glowingTitles) {
    const glowingText = await getCommunityWikitext(title);
    const image = await downloadCommunityPageImage(title, path.join("bobbleheads", `${slugify(title)}.png`));
    items.push({
      id: `bobblehead-${slugify(title)}`,
      name: title,
      categoryId: "bobbleheads",
      category: "Bobbleheads",
      group: classifyBobbleheadGroup(title),
      displayType: "Bobblehead Stand",
      tier: "Special Variant",
      sourceSummary:
        "Glowing bobbleheads are the ghoul counterpart set. Their overview page states that they use fixed bobblehead spawn locations and grant one-hour buffs.",
      locationNotes: [
        "The glowing bobblehead overview states that there are fixed locations where a bobblehead can potentially spawn.",
        "They are the ghoul equivalent of standard Vault-Tec bobbleheads and their buffs last one hour, or two with Curator.",
        "Use the glowing bobblehead overview and individual item page together when planning a second stand for the ghoul set."
      ],
      effect: cleanWiki(extractInfoboxField(glowingText, "effects")),
      image,
      wikiTitle: title,
      sourceLinks: [
        makeCommunitySource(glowingOverviewTitle, "Set overview"),
        makeCommunitySource(title, "Item page")
      ]
    });
  }

  return items;
}

async function buildMagazines() {
  const pageTitle = "Fallout 76 magazines";
  const wikitext = await getWikitext(pageTitle);
  const typesSection = extractSection(wikitext, "Types");
  const lines = typesSection.split("\n");

  const items = [];
  let currentPublication = null;
  let currentImage = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (line.startsWith("!colspan=\"2\"|")) {
      const link = parseWikiLink(line.replace(/^!colspan="2"\|/, ""));
      currentPublication = {
        title: link.title || cleanWiki(line.replace(/^!colspan="2"\|/, "")),
        label: cleanWiki(link.label || link.title || line.replace(/^!colspan="2"\|/, ""))
      };
      currentImage = await downloadPageImage(
        currentPublication.title,
        path.join("magazines", `${slugify(currentPublication.label)}.png`)
      );
      continue;
    }

    if (!currentPublication || !line.startsWith("| #")) {
      continue;
    }

    const nameLine = cleanWiki(line.replace(/^\|\s*/, ""));
    const bonusLine = cleanWiki((lines[index + 1] || "").replace(/^\|\s*/, ""));
    const issueName = `${currentPublication.label} ${nameLine}`;

    items.push({
      id: `magazine-${slugify(issueName)}`,
      name: issueName,
      categoryId: "magazines",
      category: "Magazines",
      group: currentPublication.label,
      displayType: "Magazine Rack",
      tier: "Random Spawn",
      sourceSummary:
        "Magazines spawn randomly from known magazine points. Fallout 76 currently has 12 publications and 104 collectible issues.",
      locationNotes: [
        "Issues pull from predetermined magazine spawn points instead of guaranteed fixed issue placements.",
        "Duplicates do not stack their effects, so the checklist is best used for completion tracking rather than buff stacking.",
        "The magazine article includes the full issue list and collection totals."
      ],
      effect: bonusLine,
      image: currentImage,
      wikiTitle: currentPublication.title,
      sourceLinks: [makeSource(pageTitle, "Issue list and location notes")]
    });

    index += 1;
  }

  const robcoImage = await downloadPageImage(
    "RobCo Fun (Fallout 76)",
    path.join("magazines", "robco-fun.png")
  );
  const robcoTitles = [
    "Atomic Command",
    "Automatron",
    "Nuka Tapper",
    "Pipfall",
    "Red Menace",
    "Wastelad",
    "Zeta Invaders"
  ];
  for (const title of robcoTitles) {
    items.push({
      id: `magazine-${slugify(`RobCo Fun ${title}`)}`,
      name: `RobCo Fun ${title}`,
      categoryId: "magazines",
      category: "Magazines",
      group: "RobCo Fun",
      displayType: "Magazine Rack",
      tier: "Random Spawn",
      sourceSummary:
        "RobCo Fun issues unlock reusable holotape games instead of temporary magazine buffs.",
      locationNotes: [
        "RobCo Fun issues are part of the Fallout 76 magazine collection total.",
        "They share the same random magazine-spawn ecosystem as the rest of the magazine set.",
        "Looting the magazine grants the associated holotape game permanently."
      ],
      effect: "Unlocks the holotape game permanently.",
      image: robcoImage,
      wikiTitle: "RobCo Fun (Fallout 76)",
      sourceLinks: [makeSource(pageTitle, "Magazine list and holotape section")]
    });
  }

  const grognakGameImage = await downloadPageImage(
    "Grognak the Barbarian (Fallout 76)",
    path.join("magazines", "grognak-the-barbarian-special.png")
  );
  items.push({
    id: "magazine-grognak-the-ruby-ruins",
    name: "Grognak the Barbarian Grognak & the Ruby Ruins",
    categoryId: "magazines",
    category: "Magazines",
    group: "Grognak the Barbarian",
    displayType: "Magazine Rack",
    tier: "Random Spawn",
    sourceSummary:
      "Grognak & the Ruby Ruins is a special magazine-entry collectible tied to the holotape game subsection.",
    locationNotes: [
      "This entry appears separately from the standard Grognak issue list in the holotape-games subsection.",
      "The magazine article counts it toward the total collectible issue count.",
      "Looting it grants +1 Strength for 1 hour."
    ],
    effect: "+1 Strength for 1 hour.",
    image: grognakGameImage,
    wikiTitle: "Grognak the Barbarian (Fallout 76)",
    sourceLinks: [makeSource(pageTitle, "Magazine list and holotape section")]
  });

  return items;
}

async function buildNukaCola() {
  const pageTitle = "Nuka-Cola (Fallout 76)";
  const wikitext = await getWikitext(pageTitle);
  const variantsSection = extractSection(wikitext, "Variants").split("\n===Cut variants===")[0];
  const lines = variantsSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(\*|\*\*)\s/.test(line));

  const variants = [];
  for (const line of lines) {
    if (/Fermentable/i.test(line)) {
      continue;
    }

    const cleaned = line.replace(/^\*+\s*/, "");
    const link = parseWikiLink(cleaned);
    const rawName = cleanWiki(link.label || link.title || cleaned);
    if (/Nukashine/i.test(rawName)) {
      continue;
    }
    const title = resolveNukaTitle(rawName, link.title);
    if (!title) {
      continue;
    }
    variants.push({ name: rawName, title });
  }

  const unique = dedupeBy(variants, (entry) => entry.title.toLowerCase());
  const items = [];

  for (const variant of unique) {
    const itemText = await getWikitextWithFallback(variant.title, `${variant.title} (Fallout 76)`);
    const resolvedTitle = itemText.title;
      const locationBullets = extractBullets(extractSection(itemText.wikitext, "Locations"));
      const image = await downloadPageImage(
        resolvedTitle,
        path.join("nuka-cola", `${slugify(variant.name)}.png`)
      );
      const notes = pickBullets(locationBullets, [/Kanawha/i, /Bubbles/i, /machine/i, /Collectron/i]);

      items.push({
      id: `nuka-${slugify(variant.name)}`,
      name: variant.name,
      categoryId: "nuka-cola",
      category: "Nuka-Cola Variants",
      group: "Bottle Collection",
      displayType: "Nuka-Cola Display Rack",
      tier: classifyNukaTier(locationBullets, variant.name),
        sourceSummary: summarizeBullets(
          locationBullets,
          "Kanawha Nuka-Cola plant, Bubbles at the Whitespring, and Nuka-Cola machines are the main sourcing lanes."
        ),
        locationNotes: notes.length
          ? notes
          : [
              "Check the item page for the clearest sourcing path for this variant.",
              "The main Nuka-Cola collection routes run through Kanawha Nuka-Cola plant, Bubbles, and machine spawns.",
              "Use the item page alongside the main Nuka-Cola article for rack planning."
            ],
      effect: "",
      image,
      wikiTitle: resolvedTitle,
      sourceLinks: [makeSource(pageTitle, "Variant list"), makeSource(resolvedTitle, "Item page")]
    });
  }

  return items;
}

async function buildBeerSteins() {
  const planMap = {
    "Alien Souvenir Beer Stein": "Plan: Alien souvenir beer stein",
    "Fasnacht Beer Stein": "Plan: Fasnacht beer stein",
    "Fasnacht Souvenir Beer Stein": "Plan: Fasnacht souvenir beer stein",
    "Fasnacht Veggie Man Beer Stein": "Plan: Fasnacht veggie man beer stein",
    "Meat Week Souvenir Beer Stein": "Plan: Meat Week souvenir beer stein",
    "Mischief Night Stein": "Plan: Mischief Night Stein",
    "Mothman Equinox Stein": "Plan: Mothman Equinox souvenir beer stein",
    "Scorchbeast Queen Beer Stein": "Plan: Scorchbeast queen beer stein"
  };

  const titles = (await getCommunityCategoryMembers("Category:Fallout 76 Steins"))
    .filter((title) => title !== "Stein" && title !== "Porcelain Stein")
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    titles.map(async (title) => {
      const wikitext = await getCommunityWikitext(title);
      const locationSection = firstNonEmpty(
        extractSection(wikitext, "Location"),
        extractSection(wikitext, "Locations")
      );
      const locationBullets = extractBullets(locationSection);
      const locationText = cleanWiki(locationSection);
      const craftingText = cleanWiki(extractSection(wikitext, "Crafting"));
      const gameplayText = cleanWiki(extractSection(wikitext, "Gameplay"));
      const acquiredField = cleanWiki(extractInfoboxField(wikitext, "acquired"));
      if (/unused content/i.test(acquiredField)) {
        return null;
      }
      if (!isSoloObtainableBeerStein(title, wikitext, locationText, gameplayText, acquiredField)) {
        return null;
      }
      const categories = extractCategories(wikitext).filter(
        (category) => !/Fallout 76 Steins|world objects|workshop objects|miscellaneous items/i.test(category)
      );
      const rewardCategory = categories.find((category) => /Rewards|Fasnacht|Mothman|Nuka-World|Invaders/i.test(category)) || categories[0] || "";
      const notes = buildSteinNotes(title, locationBullets, locationText, craftingText, rewardCategory, planMap[title]);
      const image = await downloadCommunityPageImage(title, path.join("beer-steins", `${slugify(title)}.png`));
      const sourceLinks = [makeCommunitySource(title, "Item page")];
      if (planMap[title]) {
        sourceLinks.push(makeSource(planMap[title], "Plan page"));
      }
      sourceLinks.push(makeCommunitySource("Stein", "Set overview"));

      return {
        id: `beer-stein-${slugify(title)}`,
        name: title,
        categoryId: "beer-steins",
        category: "Beer Steins",
        group: "Stein Collection",
        displayType: "Beer Stein Display Case",
        tier: classifySteinTier(title, acquiredField, locationText, rewardCategory),
        sourceSummary: summarizeStein(title, locationBullets, locationText, craftingText, rewardCategory),
        locationNotes: notes,
        effect: "",
        image,
        wikiTitle: title,
        sourceLinks
      };
    })
  ).then((items) => items.filter(Boolean));
}

async function buildCryptidCards() {
  const pageTitle = "Cryptid trading cards";
  const mainText = await getWikitext(pageTitle);
  const setLocationText = cleanWiki(extractSection(mainText, "Locations"));
  const foilNote = "Foil variants exist, but they are not currently set to drop within the live game.";
  const titles = [
    "Beast of Beckley card",
    "Blue Devil card",
    "Flatwoods monster card",
    "Grafton Monster card",
    "Jersey Devil card",
    "Mothman card",
    "Ogua card",
    "Sheepsquatch card"
  ];

  return Promise.all(
    titles.map(async (title) => {
      const wikitext = await getWikitext(title);
      const locationText = cleanWiki(extractSection(wikitext, "Locations"));
      const image = await downloadPageImage(title, path.join("cryptid-cards", `${slugify(title)}.png`));
      const group = /Safe and Sound/i.test(locationText) ? "Safe and Sound" : "Beasts of Burden";
      return {
        id: `cryptid-card-${slugify(title)}`,
        name: title,
        categoryId: "cryptid-cards",
        category: "Cryptid Cards",
        group,
        displayType: "Cryptid Cards Wall Display",
        tier: "Event Reward",
        sourceSummary: locationText || setLocationText,
        locationNotes: [
          locationText || setLocationText,
          foilNote,
          "Tradeable duplicates can be bought from other players if you want to finish the wall display faster."
        ],
        effect: "",
        image,
        wikiTitle: title,
        sourceLinks: [
          makeSource(pageTitle, "Set overview"),
          makeSource(title, "Item page")
        ]
      };
    })
  );
}

async function buildSnowGlobes() {
  const sourceOverrides = {
    "Most Wanted Snow Globe": {
      summary: "Reward from Most Wanted.",
      notes: ["Reward from Most Wanted."],
      sources: [
        makeSource("Plan: Most Wanted snow globe", "Plan page"),
        makeSource("Most Wanted (Fallout 76)", "Event page")
      ]
    },
    "Nuka Launcher Snowglobe": {
      summary: "Potential reward for completing Seismic Activity.",
      notes: ["Potential reward for completing Seismic Activity."],
      sources: [
        makeSource("Plan: Nuka Launcher snow globe", "Plan page"),
        makeSource("Seismic Activity", "Event page")
      ]
    },
    "Nuka-Cade Snowglobe": {
      summary: "Redeem 1,600 Nuka-Cade points for Plan: Nuka-Cade Snowglobe at Cappy's Nuka-Cade.",
      notes: ["Redeem 1,600 Nuka-Cade points for Plan: Nuka-Cade Snowglobe at Cappy's Nuka-Cade."],
      sources: [
        makeSource("Plan: Nuka-Cade snow globe", "Plan page"),
        makeCommunitySource("Cappy's Nuka-Cade", "Prize terminal")
      ]
    },
    "Spin the Wheel Snow Globe": {
      summary: "Reward from Spin the Wheel.",
      notes: ["Reward from Spin the Wheel."],
      sources: [
        makeSource("Plan: Spin the Wheel snow globe", "Plan page"),
        makeSource("Spin the Wheel", "Event page")
      ]
    },
    "Tunnel of Love Snow Globe": {
      summary: "May be awarded upon completion of Tunnel of Love as one of the event-exclusive plans.",
      notes: ["May be awarded upon completion of Tunnel of Love as one of the event-exclusive plans."],
      sources: [
        makeSource("Plan: Tunnel of Love snow globe", "Plan page"),
        makeSource("Tunnel of Love", "Event page")
      ]
    }
  };
  const titles = (await getCommunityCategoryMembers("Category:Fallout 76 snow globes"))
    .filter((title) => title !== "Snow Globe (Fallout 76)")
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    titles.map(async (title) => {
      const wikitext = await getCommunityWikitext(title);
      const locationSection = firstNonEmpty(
        extractSection(wikitext, "Location"),
        extractSection(wikitext, "Locations")
      );
      const locationText = cleanWiki(locationSection);
      const craftingText = cleanWiki(extractSection(wikitext, "Crafting"));
      const gameplayText = cleanWiki(extractSection(wikitext, "Gameplay"));
      const override = sourceOverrides[title];
      if (hasAtomField(wikitext) && !override) {
        return null;
      }
      const categories = extractCategories(wikitext).filter(
        (category) => !/Fallout 76 snow globes|Snow globes/i.test(category)
      );
      const rewardCategory = categories.find((category) => /Rewards/i.test(category)) || categories[0] || "";
      const notes = override
        ? dedupePlain(trimBullets([...override.notes, ...buildSnowGlobeNotes(title, locationText, craftingText, gameplayText, rewardCategory)], 3))
        : buildSnowGlobeNotes(title, locationText, craftingText, gameplayText, rewardCategory);
      const image = await downloadCommunityPageImage(title, path.join("snow-globes", `${slugify(title)}.png`));
      const sourceLinks = [
        makeCommunitySource("Snow Globe (Fallout 76)", "Set overview"),
        makeCommunitySource(title, "Item page"),
        ...(override?.sources || [])
      ];

      return {
        id: `snow-globe-${slugify(title)}`,
        name: title,
        categoryId: "snow-globes",
        category: "Snow Globes",
        group: "Snow Globe Collection",
        displayType: "Skyline Valley Snowglobe Display Case",
        tier: classifySnowGlobeTier(title, locationText, craftingText, rewardCategory),
        sourceSummary: override?.summary || summarizeSnowGlobe(title, locationText, craftingText, gameplayText, rewardCategory),
        locationNotes: notes,
        effect: "",
        image,
        wikiTitle: title,
        sourceLinks
      };
    })
  ).then((items) => items.filter(Boolean));
}

async function buildSouvenirs() {
  const titles = (await getAllPagesByPrefix("Souvenir_"))
    .filter((title) => /\(Fallout 76\)$/.test(title))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    titles.map(async (title) => {
      const wikitext = await getWikitext(title);
      const locationBullets = extractBullets(extractSection(wikitext, "Locations"));
      const image = await downloadPageImage(title, path.join("souvenirs", `${slugify(title)}.png`));
      return {
        id: `souvenir-${slugify(title)}`,
        name: stripDisambiguation(title),
        categoryId: "souvenirs",
        category: "Souvenirs",
        group: "Novelty Set",
        displayType: "Display Case",
        tier: "World Spawn",
        sourceSummary: summarizeBullets(
          locationBullets,
          "Souvenirs are static novelty world spawns and work well as display-case fillers."
        ),
        locationNotes: trimBullets(locationBullets, 3),
        effect: "",
        image,
        wikiTitle: title,
        sourceLinks: [makeSource(title, "Item page")]
      };
    })
  );
}

async function buildTabletopGames() {
  const entries = [
    { title: "Autopsy board game", group: "Board Game" },
    { title: "Blast Radius board game (Fallout 76)", group: "Board Game" },
    { title: "Catch the Commie board game", group: "Board Game" },
    { title: "Rad Poker board game", group: "Board Game" },
    { title: "Unstoppables! board game", group: "Board Game" },
    { title: "Chessboard (Fallout 76)", group: "Game Board" }
  ];

  return Promise.all(
    entries.map(async ({ title, group }) => {
      const wikitext = await getWikitext(title);
      const locationBullets = extractBullets(extractSection(wikitext, "Locations"));
      const image = await downloadPageImage(title, path.join("board-games", `${slugify(title)}.png`));
      const notes = trimBullets(locationBullets, 3);
      const isChessboard = /Chessboard/i.test(title);
      return {
        id: isChessboard ? `game-board-${slugify(title)}` : `board-game-${slugify(title)}`,
        name: stripDisambiguation(title),
        categoryId: "board-games",
        category: "Tabletop Games",
        group,
        displayType: "Display Case",
        tier: "World Spawn",
        sourceSummary: summarizeBullets(
          locationBullets,
          isChessboard
            ? "Chessboards are dedicated tabletop junk displays with dense repeatable spawns around Foundation, Eastern Regional Penitentiary, and the Burrows."
            : "Tabletop games are junk-item collectors' pieces and fit standard display cases."
        ),
        locationNotes: notes.length
          ? notes
          : [
              isChessboard
                ? "The wiki page does not include a dedicated location section for the chessboard."
                : "The wiki page does not include a dedicated location section for this tabletop item.",
              "Treat it as a standard world-spawn junk collectible and use the item page as the reference.",
              "Display it in a normal display case."
            ],
        effect: "",
        image,
        wikiTitle: title,
        sourceLinks: [makeSource(title, "Item page")]
      };
    })
  );
}

async function buildGiddyupParts() {
  const pageTitle = "Giddyup Buttercup parts (Fallout 76)";
  const wikitext = await getWikitext(pageTitle);
  const galleryMap = parseGalleryMap(extractSection(wikitext, "Gallery"));
  const variants = [
    {
      name: "Giddyup Buttercup head",
      key: "Giddyup Buttercup head",
      fallbackPattern: /Giddyup Buttercup head/i,
      locations: trimBullets(extractBullets(extractSubheadingSection(wikitext, "Giddyup Buttercup head", 4)), 3)
    },
    {
      name: "Giddyup Buttercup front leg",
      key: "Front leg",
      fallbackPattern: /front leg/i,
      locations: trimBullets(extractBullets(extractSubheadingSection(wikitext, "Giddyup Buttercup front leg", 4)), 3)
    },
    {
      name: "Giddyup Buttercup back leg",
      key: "Back leg",
      fallbackPattern: /back leg/i,
      locations: trimBullets(extractBullets(extractSubheadingSection(wikitext, "Giddyup Buttercup back leg", 4)), 3)
    },
    {
      name: "Giddyup Buttercup body",
      key: "Body",
      fallbackPattern: /Giddyup Buttercup body/i,
      locations: trimBullets(extractBullets(extractSubheadingSection(wikitext, "Giddyup Buttercup body", 4)), 3)
    }
  ];

  const items = [];
  for (const variant of variants) {
    const fileName =
      galleryMap.get(variant.key) ||
      galleryMap.get(variant.key.toLowerCase()) ||
      extractGalleryFileByCaption(wikitext, variant.fallbackPattern) ||
      parseFirstImageFile(wikitext);
    const image = fileName
      ? await downloadWikiFile(
          fileName,
          path.join("giddyup-parts", `${slugify(variant.name)}${extnameFromFile(fileName)}`)
        )
      : await downloadPageImage(pageTitle, path.join("giddyup-parts", `${slugify(variant.name)}.png`));

    items.push({
      id: `giddyup-part-${slugify(variant.name)}`,
      name: variant.name,
      categoryId: "giddyup-parts",
      category: "Giddyup Buttercup Parts",
      group: "Toy Parts Set",
      displayType: "Display Case",
      tier: "World Spawn",
      sourceSummary:
        "Giddyup Buttercup parts are split across separate world spawns, with Gorge Junkyard and the road trailer near Watoga covering most of the set.",
      locationNotes: variant.locations.length
        ? variant.locations
        : [
            "Use the Giddyup Buttercup parts page for the exact locations tied to this part.",
            "Gorge Junkyard and the roadside trailer northwest of Watoga Civic Center are the main repeatable farming stops.",
            "Display the four parts together as a reconstructed toy-part set."
          ],
      effect: "",
      image,
      wikiTitle: pageTitle,
      sourceLinks: [makeSource(pageTitle, "Part locations")]
    });
  }

  return items;
}

async function buildRobotModels() {
  const titles = [
    "Eyebot model (Fallout 76)",
    "Mr. Gutsy model (Fallout 76)",
    "Mr. Handy model (Fallout 76)",
    "Protectron model (Fallout 76)",
    "Sentry bot model (Fallout 76)"
  ];

  const directModels = await Promise.all(
    titles.map(async (title) => {
      const wikitext = await getWikitext(title);
      const locationBullets = extractBullets(extractSection(wikitext, "Locations"));
      const image = await downloadPageImage(title, path.join("robot-models", `${slugify(title)}.png`));
      return {
        id: `robot-model-${slugify(title)}`,
        name: stripDisambiguation(title),
        categoryId: "robot-models",
        category: "Robot Models",
        group: "Model Set",
        displayType: "Display Case",
        tier: "World Spawn",
        sourceSummary: summarizeBullets(
          locationBullets,
          "Robot models are classic desk-display collectibles with fixed world spawns."
        ),
        locationNotes: trimBullets(locationBullets, 3),
        effect: "",
        image,
        wikiTitle: title,
        sourceLinks: [makeSource(title, "Item page")]
      };
    })
  );

  const partsTitle = "Robot parts model (Fallout 76)";
  const partsText = await getWikitext(partsTitle);
  const partsImage = await downloadPageImage(partsTitle, path.join("robot-models", "robot-parts-model.png"));
  const partsNotes = trimBullets(extractBullets(extractSection(partsText, "Locations")), 3);
  const partsVariants = extractBullets(extractSection(partsText, "Characteristics"));
  const labels = ["Model A", "Model B", "Model C"];
  const partsModels = partsVariants.map((variant, index) => ({
    id: `robot-model-robot-parts-${slugify(labels[index])}`,
    name: `Robot parts ${labels[index]}`,
    categoryId: "robot-models",
    category: "Robot Models",
    group: "Model Set",
    displayType: "Display Case",
    tier: "World Spawn",
    sourceSummary: `Robot parts ${labels[index]} is part of the three-piece robot parts model sub-set.`,
    locationNotes: partsNotes.length
      ? partsNotes
      : [
          "All three robot parts models can be found at the Retreat.",
          "Model B also has extra copies at Van Lowe Taxidermy and Big Bend Tunnel east.",
          variant
        ],
    effect: "",
    image: partsImage,
    wikiTitle: partsTitle,
    sourceLinks: [makeSource(partsTitle, "Item page")]
  }));

  return [...directModels, ...partsModels];
}

async function buildOutfits() {
  const titles = dedupeBy(
    (await getCommunityCategoryMembers("Category:Fallout 76 outfits")).filter(
      (title) => title !== "Fallout 76 Outfits" && title !== "Costume"
    ),
    (title) => title.toLowerCase()
  ).sort((a, b) => a.localeCompare(b));

  const items = [];

  for (let start = 0; start < titles.length; start += 12) {
    const batchItems = await Promise.all(
      titles.slice(start, start + 12).map(async (title) => {
        const wikitext = await getCommunityWikitext(title);
        if (isOutfitAggregatePage(title, wikitext)) {
          return [];
        }

        const variants = extractOutfitVariants(title, wikitext);
        if (!variants.length) {
          return [];
        }

        const categories = extractCategories(wikitext);
        const context = buildOutfitAcquisitionContext(wikitext, categories);
        const implicitPlanTitle = extractImplicitOutfitPlanTitle(wikitext);
        if (hasNegativeOutfitSignals(wikitext, context)) {
          return [];
        }

        return Promise.all(
          variants.map(async (variant) => {
            if (isExcludedOutfitName(variant.name)) {
              return null;
            }
            const planTitle = resolvePlanTitle(variant.plan) || implicitPlanTitle;
            const planSourceLines = await getCurrentOutfitPlanSourceLines(planTitle);
            const variantContext = {
              ...context,
              planSourceLines
            };
            if (!hasPositiveOutfitSignals(variantContext)) {
              return null;
            }
            const image = await downloadOutfitImage(title, variant.name, variant.imageFile);
            return {
              id: `outfit-${slugify(variant.name)}`,
              name: variant.name,
              categoryId: "outfits",
              category: "Outfits",
              group: classifyOutfitGroup(variant.name, variantContext),
              displayType: "Mannequin",
              tier: classifyOutfitTier(variant.name, variantContext),
              sourceSummary: summarizeOutfit(variant.name, variantContext),
              locationNotes: buildOutfitNotes(variant, variantContext),
              effect:
                variant.headwear && !/^none$/i.test(variant.headwear) ? `Pairs with ${variant.headwear}.` : "",
              image,
              wikiTitle: title,
              sourceLinks: dedupeSources([
                makeCommunitySource(title, "Item page"),
                planTitle ? makeCommunitySource(planTitle, "Plan page") : null
              ])
            };
          })
        );
      })
    );

    items.push(...batchItems.flat());
  }

  return dedupeBy(items.filter(Boolean), (item) => item.id);
}

async function buildFasnachtMasks() {
  const aliasMap = new Map([["Winterman T-45 Helmet", "Fasnacht Father Winter helmet"]]);
  const titles = dedupeBy(
    (await getCommunityCategoryMembers("Category:Fasnacht Masks")).filter(
      (title) => title !== "Fasnacht Masks" && /mask|helmet/i.test(title) && !/display/i.test(title)
    ),
    (title) => title.toLowerCase()
  ).sort((a, b) => a.localeCompare(b));

  return Promise.all(
    titles.map(async (title) => {
      const wikitext = await getCommunityWikitext(title);
      const locationSection = firstNonEmpty(extractSection(wikitext, "Locations"), extractSection(wikitext, "Location"));
      const locationText = cleanWiki(locationSection);
      const locationBullets = extractBullets(locationSection);
      const textLines = wikitext.split("\n").map((line) => cleanWiki(line.trim()));
      const eventLines = textLines.filter((line) => /Fasnacht Day|chance to be received|Atomic Shop/i.test(line));
      const name = aliasMap.get(title) || title;
      const currentNotes = getCurrentFasnachtLocationNotes(locationBullets);
      const acquisitionText = currentNotes.join(" ");
      if (!isSoloObtainableFasnachtMask(name, locationText, eventLines.join(" "), currentNotes)) {
        return null;
      }
      const image = await downloadCommunityPageImage(title, path.join("fasnacht-masks", `${slugify(title)}.png`));
      const notes = trimBullets(currentNotes, 3);
      return {
        id: `fasnacht-${slugify(name)}`,
        name,
        categoryId: "fasnacht-masks",
        category: "Fasnacht Masks",
        group: classifyFasnachtGroup(name),
        displayType: "Fasnacht Mask Display",
        tier: classifyFasnachtTier(name, acquisitionText, wikitext),
        sourceSummary: summarizeBullets(currentNotes, "This mask can still be looted from a live world location."),
        locationNotes: notes.length ? notes : ["This mask can still be looted from a live world location."],
        effect: "",
        image,
        wikiTitle: title,
        sourceLinks: [
          makeCommunitySource(title, "Item page"),
          makeCommunitySource("Fasnacht Day", "Event page"),
          makeCommunitySource("Category:Fasnacht Masks", "Category page")
        ]
      };
    })
  ).then((items) => items.filter(Boolean));
}

async function getAllPagesByPrefix(prefix) {
  let next = null;
  const titles = [];

  do {
    const data = await apiQuery({
      action: "query",
      list: "allpages",
      apprefix: prefix,
      aplimit: "max",
      format: "json",
      ...(next ? { apcontinue: next } : {})
    });
    for (const page of data.query.allpages) {
      titles.push(page.title);
    }
    next = data.continue?.apcontinue || null;
  } while (next);

  return titles;
}

async function getWikitext(title) {
  const resolvedTitle = await resolveWikiTitle(title);
  const data = await apiQuery({
    action: "parse",
    page: resolvedTitle,
    prop: "wikitext",
    format: "json"
  });
  return data.parse.wikitext["*"];
}

async function getCommunityWikitext(title) {
  const data = await apiQueryAt(communityApiBase, {
    action: "parse",
    page: title,
    prop: "wikitext",
    format: "json"
  });
  return data.parse.wikitext["*"];
}

async function getCommunityCategoryMembers(categoryTitle) {
  let next = null;
  const titles = [];

  do {
    const data = await apiQueryAt(communityApiBase, {
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmlimit: "500",
      format: "json",
      ...(next ? { cmcontinue: next } : {})
    });
    for (const page of data.query.categorymembers) {
      if (page.ns === 0) {
        titles.push(page.title);
      }
    }
    next = data.continue?.cmcontinue || null;
  } while (next);

  return titles;
}

async function getWikitextWithFallback(...titles) {
  for (const title of titles) {
    try {
      const resolvedTitle = await resolveWikiTitle(title);
      const data = await apiQuery({
        action: "parse",
        page: resolvedTitle,
        prop: "wikitext",
        format: "json"
      });
      return { title: resolvedTitle, wikitext: data.parse.wikitext["*"] };
    } catch (error) {
      continue;
    }
  }
  throw new Error(`Unable to resolve page: ${titles.join(", ")}`);
}

async function downloadPageImage(title, relativePath) {
  const resolvedTitle = await resolveWikiTitle(title);
  let url = await getPageThumbnailUrl(resolvedTitle);
  if (!url) {
    try {
      const wikitext = await getWikitext(resolvedTitle);
      const infoboxImages = extractInfoboxImageFiles(wikitext);
      if (infoboxImages.length) {
        url = await getWikiFileUrl(infoboxImages[0]);
      }
    } catch (error) {
      return "";
    }
  }
  if (!url) {
    url = await getCommunityThumbnailUrl(toTitleCase(resolvedTitle));
  }
  if (!url) {
    return "";
  }
  return downloadToRelative(url, relativePath);
}

async function downloadCommunityPageImage(title, relativePath) {
  let url = await getCommunityThumbnailUrl(title);
  if (!url) {
    try {
      const wikitext = await getCommunityWikitext(title);
      const files = extractInfoboxImageFiles(wikitext);
      if (files.length) {
        url = await getCommunityFileUrl(files[0]);
      }
    } catch (error) {
      return "";
    }
  }
  if (!url) {
    return "";
  }
  return downloadToRelative(url, relativePath);
}

async function downloadWikiFile(fileName, relativePath) {
  const url = await getWikiFileUrl(fileName);
  if (!url) {
    return "";
  }
  return downloadToRelative(url, relativePath);
}

async function downloadToRelative(url, relativePath) {
  const targetPath = path.join(imageRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Fallout76-Camp-Collectibles-Tracker/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(targetPath, buffer);
  return path.posix.join("assets/images", relativePath.split(path.sep).join("/"));
}

async function getPageThumbnailUrl(title) {
  const data = await apiQuery({
    action: "query",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "640",
    titles: title,
    format: "json"
  });
  const page = Object.values(data.query.pages)[0];
  return page?.thumbnail?.source || "";
}

async function resolveWikiTitle(title) {
  const data = await apiQuery({
    action: "query",
    titles: title,
    redirects: "1",
    format: "json"
  });
  const page = Object.values(data.query.pages)[0];
  return page?.title || title;
}

async function getCommunityThumbnailUrl(title) {
  const data = await apiQueryAt(communityApiBase, {
    action: "query",
    titles: title,
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "640",
    format: "json"
  });
  const page = Object.values(data.query.pages)[0];
  return page?.thumbnail?.source || "";
}

async function getWikiFileUrl(fileName) {
  const data = await apiQuery({
    action: "query",
    prop: "imageinfo",
    iiprop: "url",
    titles: `File:${fileName}`,
    format: "json"
  });
  const page = Object.values(data.query.pages)[0];
  return page?.imageinfo?.[0]?.url || "";
}

async function getCommunityFileUrl(fileName) {
  const data = await apiQueryAt(communityApiBase, {
    action: "query",
    prop: "imageinfo",
    iiprop: "url",
    titles: `File:${fileName}`,
    format: "json"
  });
  const page = Object.values(data.query.pages)[0];
  return page?.imageinfo?.[0]?.url || "";
}

async function apiQuery(params) {
  return apiQueryAt(apiBase, params);
}

async function apiQueryAt(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Fallout76-Camp-Collectibles-Tracker/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${url}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`${data.error.code}: ${data.error.info}`);
  }
  return data;
}

function extractSection(wikitext, heading) {
  const escaped = escapeRegex(heading);
  const pattern = new RegExp(`==${escaped}==\\n([\\s\\S]*?)(?=\\n==[^=]|\\n\\[\\[Category:|$)`, "i");
  return (wikitext.match(pattern) || [])[1] || "";
}

function extractSubheadingSection(wikitext, heading, depth = 3) {
  const markers = "=".repeat(depth);
  const escaped = escapeRegex(heading);
  const pattern = new RegExp(
    `${markers}${escaped}${markers}\\n([\\s\\S]*?)(?=\\n${markers}[^=]|\\n==[^=]|\\n\\[\\[Category:|$)`,
    "i"
  );
  return (wikitext.match(pattern) || [])[1] || "";
}

function parseWikiTableRows(section) {
  const lines = section.split("\n");
  const rows = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("|-")) {
      if (current && current.length) {
        rows.push(current);
      }
      current = [];
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("|}")) {
      if (current.length) {
        rows.push(current);
      }
      current = null;
      continue;
    }
    if (line.startsWith("| ")) {
      current.push(line.slice(2).trim());
      continue;
    }
    if (line.startsWith("|")) {
      current.push(line.slice(1).trim());
    }
  }

  if (current && current.length) {
    rows.push(current);
  }

  return rows;
}

function parseWikiLink(value) {
  const match = value.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
  if (!match) {
    return {
      title: cleanWiki(value),
      label: cleanWiki(value)
    };
  }
  return {
    title: match[1].trim(),
    label: cleanWiki((match[2] || match[1]).trim())
  };
}

function parseFileName(value) {
  const match = value.match(/\[\[File:([^|\]]+)/i);
  return match ? match[1].trim() : "";
}

function parseGalleryMap(section) {
  const map = new Map();
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("<gallery") || line.startsWith("</gallery")) {
      continue;
    }
    const parts = line.split("|");
    if (parts.length < 2) {
      continue;
    }
    const key = cleanWiki(parts[1]);
    map.set(key, parts[0].trim());
    map.set(key.toLowerCase(), parts[0].trim());
  }
  return map;
}

function parseFirstImageFile(wikitext) {
  return extractInfoboxImageFiles(wikitext)[0] || "";
}

function extractGalleryFileByCaption(wikitext, captionPattern) {
  const gallerySection = extractSection(wikitext, "Gallery");
  for (const rawLine of gallerySection.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("<gallery") || line.startsWith("</gallery")) {
      continue;
    }
    const parts = line.split("|");
    if (parts.length < 2) {
      continue;
    }
    const caption = cleanWiki(parts.slice(1).join("|"));
    if (captionPattern.test(caption)) {
      return parts[0].trim();
    }
  }
  return "";
}

function hasAtomField(wikitext) {
  return /\|\s*atom\d*\s*=/i.test(wikitext);
}

function hasScoreLearnMethod(wikitext) {
  return /learn method\s*=\s*score/i.test(wikitext);
}

function extractInfoboxImageFiles(wikitext) {
  const lines = wikitext.split("\n");
  const files = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!/^\|image\d*\s*=/.test(line)) {
      continue;
    }

    const value = line.replace(/^\|image\d*\s*=\s*/, "").trim();
    if (/\[\[File:/i.test(value)) {
      const fileName = parseFileName(value);
      if (fileName) {
        files.push(fileName);
      }
      continue;
    }

    if (/^<gallery>/i.test(value) || value === "<gallery>") {
      for (let inner = index + 1; inner < lines.length; inner += 1) {
        const galleryLine = lines[inner].trim();
        if (/^<\/gallery>/i.test(galleryLine)) {
          break;
        }
        const candidate = galleryLine.split("|")[0].trim();
        if (candidate) {
          files.push(candidate);
          break;
        }
      }
      continue;
    }

    if (value && /\.(png|webp|jpg|jpeg|gif)$/i.test(value)) {
      files.push(value);
    }
  }

  return files;
}

function extractInfoboxField(wikitext, fieldName) {
  const pattern = new RegExp(`^\\|${escapeRegex(fieldName)}\\s*=\\s*(.+)$`, "mi");
  return (wikitext.match(pattern) || [])[1] || "";
}

function extractCategories(wikitext) {
  return Array.from(wikitext.matchAll(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/g)).map((match) => cleanWiki(match[1]));
}

function extractBullets(section) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\*+ /.test(line))
    .map((line) => cleanWiki(line.replace(/^\*+\s*/, "")))
    .filter(Boolean);
}

function trimBullets(bullets, count = 3) {
  return bullets.slice(0, count);
}

function pickBullets(bullets, patterns) {
  const picked = [];
  for (const pattern of patterns) {
    const match = bullets.find((bullet) => pattern.test(bullet));
    if (match && !picked.includes(match)) {
      picked.push(match);
    }
  }
  if (!picked.length) {
    return trimBullets(bullets, 3);
  }
  return picked;
}

function summarizeBullets(bullets, fallback) {
  return bullets.length ? bullets[0] : fallback;
}

function summarizeStein(title, locationBullets, locationText, craftingText, rewardCategory) {
  if (locationBullets.length) {
    return locationBullets[0];
  }
  if (locationText && !/^Can only be crafted by the player\.?$/i.test(locationText)) {
    return locationText;
  }
  if (/reward during|available as a reward from/i.test(locationText)) {
    return locationText;
  }
  if (rewardCategory) {
    return `${title} is tied to ${rewardCategory}.`;
  }
  if (craftingText) {
    return firstSentence(craftingText);
  }
  return `${title} is part of the dedicated beer stein collection.`;
}

function buildSteinNotes(title, locationBullets, locationText, craftingText, rewardCategory, planTitle) {
  const notes = [];
  if (locationBullets.length) {
    notes.push(...trimBullets(locationBullets, 3));
  } else if (locationText) {
    notes.push(locationText);
  }
  if (/Can only be crafted by the player/i.test(locationText)) {
    notes.push("Craft it after you unlock the associated plan or season reward.");
  }
  if (rewardCategory) {
    notes.push(`Reward family: ${rewardCategory}.`);
  }
  if (planTitle) {
    notes.push(`Unlock path is documented on ${planTitle}.`);
  }
  return dedupePlain(trimBullets(notes, 3));
}

function classifySteinTier(title, acquiredField, locationText, rewardCategory) {
  const combined = `${title} ${locationText} ${rewardCategory}`;
  if (/Wooden Beer Stein|Metal Beer Stein/i.test(title)) {
    return "World Spawn";
  }
  if (/Alien|Fasnacht|Meat Week|Mothman Equinox|Mischief Night|Scorchbeast Queen/i.test(combined)) {
    return "Event Reward";
  }
  if (/plan/i.test(acquiredField) || /unlock path/i.test(locationText)) {
    return "Event Plan";
  }
  if (/reward during|reward from|Rewards/i.test(combined)) {
    return "Season Reward";
  }
  return "Collectible Reward";
}

function summarizeSnowGlobe(title, locationText, craftingText, gameplayText, rewardCategory) {
  if (locationText && !/^Can only be crafted by the player\.?$/i.test(locationText)) {
    return locationText;
  }
  if (/dialogue with/i.test(craftingText)) {
    return firstSentence(craftingText);
  }
  if (rewardCategory) {
    return `${title} is tied to ${rewardCategory}.`;
  }
  if (gameplayText) {
    return firstSentence(gameplayText);
  }
  return `${title} is part of the Fallout 76 snow globe collection.`;
}

function buildSnowGlobeNotes(title, locationText, craftingText, gameplayText, rewardCategory) {
  const notes = [];
  if (locationText) {
    notes.push(locationText);
  }
  if (/dialogue with/i.test(craftingText)) {
    notes.push(firstSentence(craftingText));
  } else if (craftingText) {
    notes.push(firstSentence(craftingText));
  }
  if (rewardCategory) {
    notes.push(`Related category: ${rewardCategory}.`);
  }
  if (gameplayText) {
    notes.push(firstSentence(gameplayText));
  }
  if (!notes.length) {
    notes.push(`${title} is part of the dedicated Fallout 76 snow globe collection.`);
  }
  return dedupePlain(trimBullets(notes, 3));
}

function classifySnowGlobeTier(title, locationText, craftingText, rewardCategory) {
  const combined = `${title} ${locationText} ${craftingText} ${rewardCategory}`;
  if (/dialogue with/i.test(craftingText)) {
    return "NPC Unlock";
  }
  if (/Most Wanted|Spin the Wheel|Tunnel of Love|Seismic Activity|Nuka-Cade/i.test(combined)) {
    return "Event Reward";
  }
  if (/Rewards/i.test(rewardCategory)) {
    return "Season Reward";
  }
  if (/world objects/i.test(rewardCategory) || /Can be found/i.test(locationText)) {
    return "World Object";
  }
  return "Collectible Reward";
}

function extractIndexedInfoboxField(wikitext, fieldName, index = 1) {
  const suffix = index === 1 ? "" : index;
  return extractInfoboxField(wikitext, `${fieldName}${suffix}`);
}

function parseInfoboxImageFile(value) {
  if (!value) {
    return "";
  }
  if (/\[\[File:/i.test(value)) {
    return parseFileName(value);
  }
  return value.split("|")[0].trim();
}

function formatOutfitName(rawName, fallbackName) {
  const cleaned = cleanWiki(rawName);
  if (!cleaned) {
    return fallbackName;
  }
  if (cleaned.toLowerCase() === fallbackName.toLowerCase()) {
    return fallbackName;
  }
  return /[a-z]/.test(cleaned) ? toTitleCase(cleaned) : cleaned;
}

function resolvePlanTitle(value) {
  if (!value || /^(no|none|n\/a)$/i.test(cleanWiki(value))) {
    return "";
  }
  const match = value.match(/\[\[([^|\]]+)/);
  return match ? match[1].trim() : cleanWiki(value);
}

function extractImplicitOutfitPlanTitle(wikitext) {
  const match = wikitext.match(/\{\{plan\|([^}|]+)/i);
  if (!match) {
    return "";
  }
  const title = cleanWiki(match[1]);
  if (!title) {
    return "";
  }
  return /^Plan:/i.test(title) ? title : `Plan: ${title}`;
}

function dedupeSources(sources) {
  const map = new Map();
  for (const source of sources.filter(Boolean)) {
    if (!map.has(source.url)) {
      map.set(source.url, source);
    }
  }
  return Array.from(map.values());
}

function isOutfitAggregatePage(title, wikitext) {
  if (title === "Costume" || title === "Fallout 76 Outfits") {
    return true;
  }
  if (/\{\{#dpl:/i.test(wikitext)) {
    return true;
  }
  const type = cleanWiki(extractIndexedInfoboxField(wikitext, "type"));
  const slots = cleanWiki(extractIndexedInfoboxField(wikitext, "slots"));
  return /\{\{Infobox gameplay/i.test(wikitext) && !type && !slots;
}

function extractOutfitVariants(title, wikitext) {
  const fallbackName = stripDisambiguation(title);
  const variants = [];

  for (let index = 1; index <= 4; index += 1) {
    const nameField = extractIndexedInfoboxField(wikitext, "name", index);
    const type = cleanWiki(extractIndexedInfoboxField(wikitext, "type", index));
    const slots = cleanWiki(extractIndexedInfoboxField(wikitext, "slots", index));
    const imageField = extractIndexedInfoboxField(wikitext, "image", index);
    const headwear = cleanWiki(extractIndexedInfoboxField(wikitext, "headwear", index));
    const plan = extractIndexedInfoboxField(wikitext, "plan", index);
    const displayable = cleanWiki(extractIndexedInfoboxField(wikitext, "displayable", index));

    if (!nameField && !type && !slots && !imageField && !headwear && !plan && !displayable) {
      if (index > 1) {
        continue;
      }
      if (!/\{\{Infobox clothing FO76/i.test(wikitext)) {
        continue;
      }
    }

    const isOutfit = /coverall/i.test(slots) || /outfit|clothing/i.test(type) || index === 1;
    if (!isOutfit) {
      continue;
    }

    variants.push({
      name: formatOutfitName(nameField, fallbackName),
      headwear,
      plan,
      imageFile: parseInfoboxImageFile(imageField)
    });
  }

  if (!variants.length && /\{\{Infobox clothing FO76/i.test(wikitext)) {
    variants.push({
      name: fallbackName,
      headwear: "",
      plan: "",
      imageFile: parseInfoboxImageFile(extractIndexedInfoboxField(wikitext, "image"))
    });
  }

  return dedupeBy(variants, (variant) => variant.name.toLowerCase());
}

function buildOutfitAcquisitionContext(wikitext, categories) {
  const atomFields = [];
  const atomsFields = [];
  const seasonFields = [];
  const planFields = [];
  const costFields = [];

  for (let index = 1; index <= 4; index += 1) {
    atomFields.push(extractIndexedInfoboxField(wikitext, "atom", index));
    atomsFields.push(extractIndexedInfoboxField(wikitext, "atoms", index));
    seasonFields.push(extractIndexedInfoboxField(wikitext, "season", index));
    planFields.push(extractIndexedInfoboxField(wikitext, "plan", index));
    costFields.push(extractIndexedInfoboxField(wikitext, "cost", index));
  }

  const acquiredSection = extractSection(wikitext, "Acquired");
  const locationSection = firstNonEmpty(extractSection(wikitext, "Locations"), extractSection(wikitext, "Location"));
  const gameplaySection = extractSection(wikitext, "Gameplay");
  const craftingSection = extractSection(wikitext, "Crafting");
  const acquiredBullets = extractBullets(acquiredSection);
  const locationBullets = extractBullets(locationSection);
  const gameplayBullets = extractBullets(gameplaySection);
  const craftingBullets = extractBullets(craftingSection);
  const rawText = [
    ...atomFields,
    ...atomsFields,
    ...seasonFields,
    ...planFields,
    ...costFields,
    acquiredSection,
    locationSection,
    gameplaySection,
    craftingSection
  ]
    .filter(Boolean)
    .join(" ");

  return {
    categories,
    rawText,
    text: cleanWiki(rawText),
    atomFields: atomFields.filter(Boolean),
    atomsFields: atomsFields.filter(Boolean),
    seasonFields: seasonFields.filter(Boolean),
    planFields: planFields.filter(Boolean),
    costFields: costFields.filter(Boolean),
    acquiredSection,
    locationSection,
    gameplaySection,
    craftingSection,
    acquiredBullets,
    locationBullets,
    gameplayBullets,
    craftingBullets
  };
}

const LIMITED_TIME_OUTFIT_PATTERN =
  /\b(?:Fasnacht Day|Spooky Scorched|Treasure Hunter(?:s)?|Holiday Scorched|Holiday Gift|Grahm's Meat-Cook|Meat Week|The Mothman Equinox|Mothman Equinox|Cultist High Priest Pack|Invaders from Beyond|Mischief Night|The Big Bloom|Call to Axe-ion|Fortifying ATLAS|seasonal event|seasonal community event|season rewards?|scoreboard|Nuclear Winter|Prime Gaming|Twitch Prime|Spread the Love|anniversary|television series|legacy content|{{Removed}})\b/i;

const EVERGREEN_OUTFIT_EVENT_PATTERN =
  /\b(?:Daily Ops|Encryptid|Riding Shotgun|Project Paradise|Dangerous Pastimes|Most Wanted|Seismic Activity|Spin the Wheel|Tunnel of Love|Safe and Sound|Beasts of Burden|Scorched Earth|A Colossal Problem|Final Departure|Strength in Numbers|Forbidden Knowledge|Into the Fire|Mistaken Identity|Back to Basic|Officer on Deck|Pleasant Valley Claim Ticket)\b/i;

function getOutfitSourceLines(context) {
  const lines = [
    ...context.acquiredBullets,
    ...context.locationBullets,
    ...context.gameplayBullets,
    ...context.craftingBullets,
    firstSentence(context.acquiredSection),
    firstSentence(context.locationSection),
    firstSentence(context.gameplaySection),
    firstSentence(context.craftingSection)
  ]
    .map((line) => cleanWiki(line || ""))
    .filter(Boolean);

  return dedupePlain(lines);
}

function isLimitedTimeOutfitLine(line) {
  return LIMITED_TIME_OUTFIT_PATTERN.test(line);
}

function isCurrentOutfitLocationLine(line) {
  return /(world spawn|can be found|found in|found at|sold by|vendor|merchant|trader|random encounter|technical data|claim ticket|purchased from|turning in|redeem|redeeming|portable toilet|underneath a table|on the second floor|inside the|behind a locked|at the Whitespring Resort|Transmission Station 1AT-U03|Dolly Sods Wilderness|Flatwoods|Fort Defiance|Black Mountain Ordnance Works|Charleston Station|Camden Park|Forest events|Savage Divide events|Ash Heap events|Toxic Valley|The Mire|Cranberry Bog|Idle Explosives|Play Time|Queen of the Hunt|Always Vigilant|Waste Not|Daily Ops|Daily Op|Riding Shotgun)/i.test(
    line
  );
}

function isCurrentOutfitEventLine(line) {
  if (
    !/(reward from|reward for|possible reward|rare reward|drop chance|awarded upon completion|awarded|possible vendor listing|chance to be rewarded|can only be obtained|only obtainable)/i.test(
      line
    )
  ) {
    return false;
  }
  return EVERGREEN_OUTFIT_EVENT_PATTERN.test(line);
}

function isCurrentOutfitSourceLine(line) {
  if (!line) {
    return false;
  }
  if (/^worn by /i.test(line)) {
    return false;
  }
  if (isLimitedTimeOutfitLine(line) && !isCurrentOutfitLocationLine(line) && !isCurrentOutfitEventLine(line)) {
    return false;
  }
  return isCurrentOutfitLocationLine(line) || isCurrentOutfitEventLine(line);
}

function isWeakOutfitSourceLine(line) {
  return /^worn by /i.test(line) || /^can only be crafted by the player\.?$/i.test(line) || /^plan:/i.test(line) || /the plan unlocks crafting/i.test(line);
}

function extractCurrentOutfitAcquisitionLines(lines, { loose = false } = {}) {
  return dedupePlain(
    lines
      .map((line) => cleanWiki(line || ""))
      .filter(Boolean)
      .filter((line) => {
        if (isWeakOutfitSourceLine(line)) {
          return false;
        }
        if (isLimitedTimeOutfitLine(line) && !isCurrentOutfitLocationLine(line) && !isCurrentOutfitEventLine(line)) {
          return false;
        }
        if (isCurrentOutfitLocationLine(line) || isCurrentOutfitEventLine(line)) {
          return true;
        }
        return loose;
      })
  );
}

const outfitPlanSourceCache = new Map();

async function getCurrentOutfitPlanSourceLines(planTitle) {
  if (!planTitle) {
    return [];
  }
  if (!outfitPlanSourceCache.has(planTitle)) {
    outfitPlanSourceCache.set(
      planTitle,
      (async () => {
        try {
          const wikitext = await getCommunityWikitext(planTitle);
          const planContext = buildOutfitAcquisitionContext(wikitext, extractCategories(wikitext));
          return extractCurrentOutfitAcquisitionLines(
            [
              ...planContext.acquiredBullets,
              ...planContext.locationBullets,
              firstSentence(planContext.acquiredSection),
              firstSentence(planContext.locationSection),
              ...planContext.gameplayBullets,
              firstSentence(planContext.gameplaySection)
            ],
            { loose: true }
          );
        } catch (error) {
          return [];
        }
      })()
    );
  }
  return outfitPlanSourceCache.get(planTitle);
}

function getCurrentOutfitSourceLines(context) {
  return dedupePlain([
    ...extractCurrentOutfitAcquisitionLines(
      [
        ...context.acquiredBullets,
        ...context.locationBullets,
        firstSentence(context.acquiredSection),
        firstSentence(context.locationSection)
      ],
      { loose: true }
    ),
    ...extractCurrentOutfitAcquisitionLines(
      [
        ...context.gameplayBullets,
        ...context.craftingBullets,
        firstSentence(context.gameplaySection),
        firstSentence(context.craftingSection)
      ],
      { loose: false }
    ),
    ...(context.planSourceLines || [])
  ]);
}

function getOutfitClassificationText(context) {
  const lines = getCurrentOutfitSourceLines(context);
  return lines.length ? lines.join(" ") : context.text;
}

function hasNegativeOutfitSignals(wikitext, context) {
  const raw = context.rawText;
  const text = context.text;
  const categoryText = context.categories.join(" ");
  if (/\{\{icon\|fo1st/i.test(raw) || /fallout 1st/i.test(text)) {
    return true;
  }
  if (/\{\{icon\|score/i.test(raw) || /\bscoreboard\b/i.test(text)) {
    return true;
  }
  if (/\{\{atom(?:\|[^}]*)?\}\}/i.test(raw) || /\{\{icon\|atom/i.test(raw) || /atomic shop/i.test(text)) {
    return true;
  }
  if (/\{\{acquired\|FO76(?:LR|SV|RD|CS)\}\}/i.test(raw)) {
    return true;
  }
  if (
    /\|season\d*\s*=\s*(?!\s*(?:<!--N\/A-->|no)?\s*$)/i.test(wikitext) ||
    /\|cost\d*\s*=.*tickets/i.test(wikitext) ||
    /\bseason\s+\d+\b/i.test(text) ||
    /\bseason rewards?\b/i.test(text) ||
    /shoot for the stars|heart of steel|dread island tale|the legendary run|blood x rust|duel with the devil|the big score|cold steel|the city of steel|the scribe of avalon|escape from the 42nd century|appalachian modern living|gone fission|the unwritten rule|rip daring and the cryptid hunt/i.test(
      text
    )
  ) {
    return true;
  }
  if (/\{\{icon\|(?:free,limited|limited,free)/i.test(raw)) {
    return true;
  }
  if (
    /\blegacy content\b|nuclear winter|twitch prime|prime gaming|free in-game bundle|starter bundle|anniversary|quakecon|gamescom|spread the love|limited time|played prior to wastelanders|television series|premier of the fallout television series|call to axe-ion|fortifying atlas/i.test(
      text
    )
  ) {
    return true;
  }
  return /Rip Daring and the Cryptid Hunt Rewards|Pioneer Scouts .+ Rewards|The Scribe of Avalon Rewards|Zorbo's Revenge/i.test(
    categoryText
  );
}

function hasPositiveOutfitSignals(context) {
  return getCurrentOutfitSourceLines(context).length > 0;
}

function isSoloObtainableOutfit(wikitext, context) {
  if (hasNegativeOutfitSignals(wikitext, context)) {
    return false;
  }
  return hasPositiveOutfitSignals(context);
}

function isChaseOutfit(name, combined) {
  if (
    /Asylum Worker Uniform (Red|Pink|Forest|Yellow)|Forest Camo Jumpsuit|BOS Jumpsuit|White Powder Jumpsuit|Whitespring Jumpsuit|Leather Coat|Traveling Leather Coat|Responder Fireman Uniform|Hunter's Long Coat|Longshoreman Outfit/i.test(
      combined
    )
  ) {
    return true;
  }
  return /extremely rare|0\.\d+%|rare reward|possible vendor listing|random vendor listing/i.test(combined);
}

function classifyOutfitGroup(name, context) {
  const combined = `${name} ${getOutfitClassificationText(context)}`;
  if (/Asylum Worker Uniform/i.test(name)) {
    return "Asylum Uniforms";
  }
  if (
    /Treasure Hunter|Spooky Scorched|Holiday Scorched|Holiday Gift|High Priest Pack|Mothman Equinox|Grahm's Meat-Cook/i.test(
      combined
    )
  ) {
    return "Seasonal Event Rewards";
  }
  if (/Daily Ops|Dangerous Pastimes|Project Paradise|Riding Shotgun|Most Wanted|Seismic Activity|public event/i.test(combined)) {
    return "Event Rewards";
  }
  if (/Vendor bot Responder|Scavenger Trader|sold by|vendor|merchant|trader|Betty Hill|Flauresca|MODUS/i.test(combined)) {
    return "Vendor and Random Encounter";
  }
  if (/Plan:|can be crafted|Armor Workbench/i.test(combined)) {
    return "Plan Unlocks";
  }
  if (/quest|questline|completion|Forbidden Knowledge|Into the Fire|Mistaken Identity|Back to Basic|Officer on Deck/i.test(combined)) {
    return "Quest Rewards";
  }
  if (/Jumpsuit/i.test(name)) {
    return "Jumpsuits";
  }
  if (context.locationSection) {
    return "World Spawns";
  }
  if (/World Spawn|can be found|found in|spawn/i.test(combined)) {
    return "World Spawns";
  }
  return "Distinct Apparel";
}

function classifyOutfitTier(name, context) {
  const combined = `${name} ${getOutfitClassificationText(context)}`;
  if (isChaseOutfit(name, combined)) {
    return "Event Chase";
  }
  if (/Daily Ops/i.test(combined)) {
    return "Daily Ops";
  }
  if (/Treasure Hunter|Spooky Scorched|Holiday Scorched|Holiday Gift|High Priest Pack|Mothman Equinox|Grahm's Meat-Cook/i.test(combined)) {
    return "Seasonal Event";
  }
  if (/Dangerous Pastimes|Project Paradise|Riding Shotgun|Most Wanted|Seismic Activity|public event|events?:/i.test(combined)) {
    return "Event Reward";
  }
  if (/Vendor bot Responder|Scavenger Trader|sold by|vendor|merchant|trader|Betty Hill|Flauresca|MODUS/i.test(combined)) {
    return "Vendor/World";
  }
  if (/Plan:|can be crafted|Armor Workbench/i.test(combined)) {
    return "Plan Unlock";
  }
  if (/quest|questline|completion|Forbidden Knowledge|Into the Fire|Mistaken Identity|Back to Basic|Officer on Deck/i.test(combined)) {
    return "Quest Reward";
  }
  if (context.locationSection) {
    return "World Spawn";
  }
  if (/World Spawn|can be found|found in|spawn/i.test(combined)) {
    return "World Spawn";
  }
  return "Collectible Reward";
}

function isExcludedOutfitName(name) {
  return /^Clown Outfit$/i.test(name);
}

function annotateItemRarity(item) {
  const rarity = classifyItemRarity(item);
  return {
    ...item,
    rarity,
    rarityRank: rarityRankMap[rarity] || 99
  };
}

function classifyItemRarity(item) {
  const combined = [
    item.name,
    item.category,
    item.group,
    item.displayType,
    item.tier,
    item.sourceSummary,
    ...(item.locationNotes || []),
    item.effect
  ]
    .filter(Boolean)
    .join(" ");

  if (/\b0\.\d+%|\bextremely rare\b|\bultra[- ]rare\b|\bsuper rare\b/i.test(combined)) {
    return "Mythic";
  }

  if (/\brare reward\b|\bvery rare\b|\bpossible vendor listing\b|\brandom vendor listing\b|\btechnical data\b|\bclaim ticket\b/i.test(combined)) {
    return "Ultra Rare";
  }

  if (tierRarityMap[item.tier]) {
    return tierRarityMap[item.tier];
  }

  if (/\brandom spawn\b|\brandomized\b|\brandomly\b/i.test(combined)) {
    return "Rare";
  }

  if (/\bsold by\b|\bvendor\b|\bmerchant\b|\bredeem\b|\bcraft(?:ed|ing)?\b/i.test(combined)) {
    return "Uncommon";
  }

  if (/\bworld spawn\b|\bworld object\b|\bcan be found\b|\bfound in\b|\bfound at\b/i.test(combined)) {
    return "Common";
  }

  return "Rare";
}

function summarizeOutfit(name, context) {
  const currentLines = getCurrentOutfitSourceLines(context);
  const summary =
    currentLines[0] ||
    firstNonEmpty(
      context.acquiredBullets[0],
      context.locationBullets[0],
      context.gameplayBullets[0],
      context.craftingBullets[0],
      firstSentence(context.acquiredSection),
      firstSentence(context.locationSection),
      firstSentence(context.gameplaySection),
      firstSentence(context.craftingSection)
    );

  return summary || `${name} is a solo-obtainable outfit that can be staged on a mannequin display.`;
}

function buildOutfitNotes(variant, context) {
  const currentLines = getCurrentOutfitSourceLines(context);
  const notes = currentLines.length
    ? [...trimBullets(currentLines, 3)]
    : [
        ...trimBullets(context.acquiredBullets, 2),
        ...trimBullets(context.locationBullets, 2),
        ...trimBullets(context.gameplayBullets, 1),
        ...trimBullets(context.craftingBullets, 1)
      ];

  if (!notes.length) {
    notes.push(
      ...[
        firstSentence(context.acquiredSection),
        firstSentence(context.locationSection),
        firstSentence(context.gameplaySection),
        firstSentence(context.craftingSection)
      ].filter(Boolean)
    );
  }

  const planTitle = resolvePlanTitle(variant.plan);
  if (planTitle) {
    notes.push(`Plan unlock: ${planTitle}.`);
  }
  if (variant.headwear && !/^none$/i.test(variant.headwear)) {
    notes.push(`Pairs with ${variant.headwear}.`);
  }

  return dedupePlain(trimBullets(notes, 3));
}

async function downloadOutfitImage(title, name, imageFile) {
  if (imageFile) {
    try {
      return await downloadCommunityFile(
        imageFile,
        path.join("outfits", `${slugify(name)}${extnameFromFile(imageFile)}`)
      );
    } catch (error) {
      // Fall back to the page thumbnail when a direct file fetch is unavailable.
    }
  }
  return downloadCommunityPageImage(title, path.join("outfits", `${slugify(name)}.png`));
}

function cleanWiki(value) {
  return value
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/''+/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveNukaTitle(name, linkedTitle) {
  if (linkedTitle) {
    return linkedTitle;
  }
  const directMap = {
    "Nuka-Cola": "Nuka-Cola (Fallout 76)",
    "Nuka-Cola Cranberry": "Nuka-Cola Cranberry",
    "Nuka-Cherry": "Nuka-Cherry (Fallout 76)",
    "Nuka-Cola Dark": "Nuka-Cola Dark (Fallout 76)",
    "Nuka-Cola Orange": "Nuka-Cola Orange (Fallout 76)",
    "Nuka-Cola Quantum": "Nuka-Cola Quantum (Fallout 76)",
    "Nuka-Cola Twist": "Nuka-Cola Twist",
    "Nuka-Cola Wild": "Nuka-Cola Wild (Fallout 76)",
    "Nuka-Cola Vaccinated": "Nuka-Cola Vaccinated",
    "Nuka-Cola Scorched": "Nuka-Cola Scorched",
    "Nuka-Cola My Blood's In It": "Nuka-Cola My Blood's In It",
    "Nuka-Grape": "Nuka-Grape (Fallout 76)"
  };
  return directMap[name] || "";
}

function classifyNukaTier(locationBullets, name) {
  const haystack = locationBullets.join(" ");
  if (/Bubbles|vendor/i.test(haystack)) {
    return "Vendor/World";
  }
  if (/Collectron|mystery machine/i.test(haystack)) {
    return "World/Utility";
  }
  if (/Kanawha/i.test(haystack)) {
    return "World Spawn";
  }
  if (/My Blood's In It|Scorched/i.test(name)) {
    return "Special Variant";
  }
  return "World Spawn";
}

function classifyBobbleheadGroup(title) {
  if (/Agility|Charisma|Endurance|Intelligence|Luck|Perception|Strength/i.test(title)) {
    return "S.P.E.C.I.A.L.";
  }
  if (/Barter|Lockpick|Medicine|Repair|Sneak|Speech/i.test(title)) {
    return "Utility";
  }
  return "Weapons";
}

function isSoloObtainableBeerStein(title, wikitext, locationText, gameplayText, acquiredField) {
  if (/Wooden Beer Stein|Metal Beer Stein/i.test(title)) {
    return true;
  }

  const combined = `${locationText} ${gameplayText} ${acquiredField}`;
  if (hasAtomField(wikitext) || hasScoreLearnMethod(wikitext)) {
    return false;
  }
  if (
    /scoreboard|ranking up on|reward during armor ace|available on the .*scoreboard|Alien|Fasnacht|Meat Week|Mothman Equinox|Mischief Night|Scorchbeast Queen|Invaders from Beyond/i.test(
      combined
    )
  ) {
    return false;
  }
  return /(can be found|found in|Helvetia|Whitespring|Sunnytop)/i.test(combined);
}

function isShopOnlyFasnachtLocation(locationText) {
  if (!locationText || !/Atomic Shop/i.test(locationText)) {
    return false;
  }
  return !/Fasnacht Day|chance to|earned from|can be found|found in|reward|seasonal event|best performance/i.test(
    locationText
  );
}

function getCurrentFasnachtLocationNotes(locationBullets) {
  return dedupePlain(
    locationBullets.filter((line) => /Fort Defiance|Trainyard|found in|can be found|mask is found/i.test(line))
  );
}

function isSoloObtainableFasnachtMask(title, locationText, eventText, currentNotes) {
  const acquisitionText = `${locationText} ${eventText}`.trim();
  if (!acquisitionText || !currentNotes.length) {
    return false;
  }
  if (isShopOnlyFasnachtLocation(locationText) || isShopOnlyFasnachtLocation(acquisitionText)) {
    return false;
  }
  if (
    /standard mask/i.test(acquisitionText) &&
    /Atomic Shop/i.test(acquisitionText) &&
    /Red|Blue|Green|Yellow|Old Man Summer|Rail Splitter|Fasnachtler/i.test(title)
    ) {
    return false;
  }
  return true;
}

function classifyFasnachtTier(title, acquisitionText, wikitext) {
  if (isShopOnlyFasnachtLocation(acquisitionText)) {
    return "Atomic Shop";
  }
  if (/glowing/i.test(title)) {
    return "Event Chase";
  }
  if (/best performance|chance to be received/i.test(acquisitionText)) {
    return "Event Rare";
  }
  if (/earned from participating|chance to drop as a reward|Fasnacht Day/i.test(acquisitionText)) {
    return "Seasonal Event";
  }
  if (/Fort Defiance|Trainyard|can be found|found in|Helvetia/i.test(acquisitionText)) {
    return "World Spawn";
  }
  if (/Atomic Shop|value type2\s*=\s*atom/i.test(wikitext)) {
    return "Atomic Shop";
  }
  return "Seasonal Event";
}

function classifyFasnachtGroup(title) {
  if (/glowing/i.test(title)) {
    return "Glowing Masks";
  }
  if (/Father Winter|Winterman/i.test(title)) {
    return "Special Headwear";
  }
  return "Mask Set";
}

function wikiUrl(title) {
  return `https://fallout.fandom.com/wiki/${title.replace(/ /g, "_")}`;
}

function communityWikiUrl(title) {
  return `https://fallout.wiki/wiki/${title.replace(/ /g, "_")}`;
}

function makeSource(title, label) {
  return { label, url: wikiUrl(title) };
}

function makeCommunitySource(title, label) {
  return { label, url: communityWikiUrl(title) };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripDisambiguation(title) {
  return title.replace(/\s+\(Fallout 76\)$/i, "");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extnameFromFile(fileName) {
  const ext = path.extname(fileName);
  return ext || ".png";
}

function firstNonEmpty(...values) {
  return values.find((value) => value && value.trim()) || "";
}

function firstSentence(value) {
  const cleaned = cleanWiki(value);
  const match = cleaned.match(/.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : cleaned;
}

function toTitleCase(value) {
  return value.replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase());
}

function dedupePlain(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeBy(values, keyFn) {
  const map = new Map();
  for (const value of values) {
    const key = keyFn(value);
    if (!map.has(key)) {
      map.set(key, value);
    }
  }
  return Array.from(map.values());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
