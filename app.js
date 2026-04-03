(function () {
  const data = window.F76_COLLECTIBLES;
  const FALLBACK_SELECTION = data.items[0]?.id || "";
  const OUTFIT_CATEGORY = "Outfits";
  const OUTFIT_DISPLAY_TYPE = "Mannequin";
  const AUTO_SAVE_DB_NAME = "f76-collection-logger";
  const AUTO_SAVE_STORE = "logs";
  const LEGACY_AUTO_SAVE_KEY = "current-log";
  const AUTO_SAVE_INDEX_KEY = "profiles:index";
  const AUTO_SAVE_ACTIVE_PROFILE_KEY = "profiles:active";
  const AUTO_SAVE_PROFILE_PREFIX = "profile:";
  const DEFAULT_PROFILE_NAME = "Main";
  const sessionState = {
    fileHandle: null,
    fileName: "",
    fileAction: "",
    fileActionAt: "",
    autoSaveAt: "",
    autoSaveError: "",
    autoSavePending: false,
    autoSaveDbPromise: null,
    autoSavePromise: Promise.resolve(),
    profiles: [],
    activeProfileId: "",
    profilesLoaded: false
  };

  const fallbackRarityScale = [
    { label: "Mythic", rank: 1 },
    { label: "Ultra Rare", rank: 2 },
    { label: "Rare", rank: 3 },
    { label: "Uncommon", rank: 4 },
    { label: "Common", rank: 5 }
  ];
  const rarityScale = Array.isArray(data.rarityScale) && data.rarityScale.length ? data.rarityScale : fallbackRarityScale;
  const rarityOrder = Object.fromEntries(rarityScale.map((entry) => [entry.label, entry.rank]));

  const tierOrder = {
    "Event Chase": 1,
    "Event Rare": 2,
    "Event Reward": 3,
    "Daily Ops": 4,
    "Quest Reward": 5,
    "Plan Unlock": 6,
    "NPC Unlock": 7,
    "Token Redemption": 8,
    "Collectible Reward": 9,
    "Atomic Shop": 10,
    "Random Spawn": 11,
    "Vendor/World": 12,
    "World/Utility": 13,
    "Seasonal Event": 14,
    "Special Variant": 15,
    "World Spawn": 16,
    "World Object": 17
  };

  const state = {
    query: "",
    category: "all",
    displayType: "all",
    tier: "all",
    rarity: "all",
    status: "all",
    sort: "category",
    selectedId: FALLBACK_SELECTION,
    collected: loadProgress()
  };

  const refs = {
    scopeText: document.getElementById("scopeText"),
    sidebarStats: document.getElementById("sidebarStats"),
    overallProgressLabel: document.getElementById("overallProgressLabel"),
    overallProgressPercent: document.getElementById("overallProgressPercent"),
    overallProgressBar: document.getElementById("overallProgressBar"),
    categoryList: document.getElementById("categoryList"),
    sourceList: document.getElementById("sourceList"),
    logStatus: document.getElementById("logStatus"),
    heroStats: document.getElementById("heroStats"),
    reviewCopy: document.getElementById("reviewCopy"),
    searchInput: document.getElementById("searchInput"),
    categorySelect: document.getElementById("categorySelect"),
    displaySelect: document.getElementById("displaySelect"),
    tierSelect: document.getElementById("tierSelect"),
    raritySelect: document.getElementById("raritySelect"),
    statusSelect: document.getElementById("statusSelect"),
    sortSelect: document.getElementById("sortSelect"),
    activeFilters: document.getElementById("activeFilters"),
    visibleCountLabel: document.getElementById("visibleCountLabel"),
    collectionGrid: document.getElementById("collectionGrid"),
    detailPanel: document.getElementById("detailPanel"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    reviewOutfitsButton: document.getElementById("reviewOutfitsButton"),
    reviewMissingOutfitsButton: document.getElementById("reviewMissingOutfitsButton"),
    nextMissingButton: document.getElementById("nextMissingButton"),
    profileSelect: document.getElementById("profileSelect"),
    profileNameInput: document.getElementById("profileNameInput"),
    createProfileButton: document.getElementById("createProfileButton"),
    renameProfileButton: document.getElementById("renameProfileButton"),
    deleteProfileButton: document.getElementById("deleteProfileButton"),
    exportButton: document.getElementById("exportButton"),
    importButton: document.getElementById("importButton"),
    resetButton: document.getElementById("resetButton"),
    importInput: document.getElementById("importInput")
  };

  initialize().catch(() => {
    renderLogStatus();
    render();
  });

  async function initialize() {
    refs.scopeText.textContent = data.scope;
    populateSelect(refs.categorySelect, "All Categories", data.categories.map((entry) => entry.label));
    populateSelect(refs.displaySelect, "All Display Types", uniqueValues(data.items.map((item) => item.displayType)));
    populateSelect(refs.tierSelect, "All Tiers", uniqueValues(data.items.map((item) => item.tier)).sort(compareTierLabels));
    populateSelect(refs.raritySelect, "All Rarity", rarityScale.map((entry) => entry.label));
    renderSources();
    renderProfiles();
    renderLogStatus();
    bindEvents();
    render();
    requestPersistentStorage();
    await restoreAutoSave();
  }

  function bindEvents() {
    refs.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      render();
    });

    refs.categorySelect.addEventListener("change", (event) => {
      state.category = event.target.value;
      render();
    });

    refs.displaySelect.addEventListener("change", (event) => {
      state.displayType = event.target.value;
      render();
    });

    refs.tierSelect.addEventListener("change", (event) => {
      state.tier = event.target.value;
      render();
    });

    refs.raritySelect.addEventListener("change", (event) => {
      state.rarity = event.target.value;
      render();
    });

    refs.statusSelect.addEventListener("change", (event) => {
      state.status = event.target.value;
      render();
    });

    refs.sortSelect.addEventListener("change", (event) => {
      state.sort = event.target.value;
      render();
    });

    refs.categoryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) {
        return;
      }
      state.category = button.dataset.category;
      refs.categorySelect.value = state.category;
      render();
    });

    refs.collectionGrid.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-toggle-id]");
      if (toggle) {
        toggleCollected(toggle.dataset.toggleId);
        return;
      }

      const card = event.target.closest("[data-item-id]");
      if (!card) {
        return;
      }
      state.selectedId = card.dataset.itemId;
      renderDetail();
      renderCollectionGrid();
    });

    refs.detailPanel.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-detail-toggle]");
      if (toggle) {
        toggleCollected(toggle.dataset.detailToggle);
        return;
      }

      const advance = event.target.closest("[data-detail-advance]");
      if (advance) {
        collectAndAdvance(advance.dataset.detailAdvance);
      }
    });

    refs.clearFiltersButton.addEventListener("click", () => {
      state.query = "";
      state.category = "all";
      state.displayType = "all";
      state.tier = "all";
      state.rarity = "all";
      state.status = "all";
      state.sort = "category";
      syncControls();
      render();
    });

    refs.reviewOutfitsButton.addEventListener("click", () => applyOutfitReviewMode({ missingOnly: false }));
    refs.reviewMissingOutfitsButton.addEventListener("click", () => applyOutfitReviewMode({ missingOnly: true }));
    refs.nextMissingButton.addEventListener("click", jumpToNextMissingVisible);
    refs.profileSelect.addEventListener("change", (event) => switchProfile(event.target.value));
    refs.profileNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        renameActiveProfile();
      }
    });
    refs.createProfileButton.addEventListener("click", createProfile);
    refs.renameProfileButton.addEventListener("click", renameActiveProfile);
    refs.deleteProfileButton.addEventListener("click", deleteActiveProfile);
    refs.exportButton.addEventListener("click", exportProgress);
    refs.importButton.addEventListener("click", () => refs.importInput.click());
    refs.importInput.addEventListener("change", importProgress);
    refs.resetButton.addEventListener("click", resetProgress);
  }

  function render() {
    const visibleItems = getVisibleItems();
    ensureSelection(visibleItems);
    renderSidebar(visibleItems);
    renderHero(visibleItems);
    renderReviewStrip(visibleItems);
    renderFilters();
    renderCollectionGrid(visibleItems);
    renderDetail();
  }

  function renderSidebar(visibleItems) {
    const collectedCount = countCollected(data.items);
    const totalCount = data.items.length;
    const percent = totalCount ? Math.round((collectedCount / totalCount) * 100) : 0;

    refs.overallProgressLabel.textContent = `${collectedCount} / ${totalCount}`;
    refs.overallProgressPercent.textContent = `${percent}%`;
    refs.overallProgressBar.style.width = `${percent}%`;

    const sidebarStats = [
      { label: "Visible", value: visibleItems.length },
      { label: "Collected", value: collectedCount },
      { label: "Remaining", value: totalCount - collectedCount },
      { label: "Displays", value: uniqueValues(data.items.map((item) => item.displayType)).length }
    ];

    refs.sidebarStats.innerHTML = sidebarStats
      .map(
        (entry) => `
          <div class="summary-item">
            <span>${entry.label}</span>
            <strong>${entry.value}</strong>
          </div>
        `
      )
      .join("");

    const allCategoryButton = buildCategoryButton({
      label: "All Categories",
      value: "all",
      current: state.category,
      collected: collectedCount,
      total: totalCount
    });

    refs.categoryList.innerHTML =
      allCategoryButton +
      data.categories
        .map((category) => {
          const items = data.items.filter((item) => item.category === category.label);
          return buildCategoryButton({
            label: category.label,
            value: category.label,
            current: state.category,
            collected: countCollected(items),
            total: items.length
          });
        })
        .join("");
  }

  function buildCategoryButton({ label, value, current, collected, total }) {
    const percent = total ? Math.round((collected / total) * 100) : 0;
    return `
      <button class="category-button ${current === value ? "active" : ""}" data-category="${escapeHtml(value)}" type="button">
        <div class="category-topline">
          <span class="category-name">${escapeHtml(label)}</span>
          <span class="category-count">${collected}/${total}</span>
        </div>
        <div class="mini-rail">
          <div class="mini-fill" style="width:${percent}%"></div>
        </div>
      </button>
    `;
  }

  function renderSources() {
    refs.sourceList.innerHTML = data.sources
      .map(
        (source) => `
          <div class="source-item">
            <a href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>
            <p>${escapeHtml(source.note || "")}</p>
          </div>
        `
      )
      .join("");
  }

  function renderHero(visibleItems) {
    const totalCollected = countCollected(data.items);
    const visibleCollected = countCollected(visibleItems);
    const outfitItems = getOutfitItems();
    const outfitCollected = countCollected(outfitItems);
    const heroStats = isOutfitReviewActive()
      ? [
          { label: "Outfits Tracked", value: outfitItems.length },
          { label: "Outfits Collected", value: outfitCollected },
          { label: "Outfits Missing", value: outfitItems.length - outfitCollected },
          { label: "Visible Outfits", value: visibleItems.length },
          { label: "Visible Missing", value: visibleItems.filter((item) => !state.collected[item.id]).length }
        ]
      : [
          { label: "Tracked", value: data.items.length },
          { label: "Collected", value: totalCollected },
          { label: "Remaining", value: data.items.length - totalCollected },
          { label: "Visible Results", value: visibleItems.length },
          { label: "Visible Collected", value: visibleCollected }
        ];

    refs.heroStats.innerHTML = heroStats
      .map(
        (entry) => `
          <div class="stat-card">
            <span class="label">${escapeHtml(entry.label)}</span>
            <span class="value">${entry.value}</span>
          </div>
        `
      )
      .join("");
  }

  function renderReviewStrip(visibleItems) {
    const outfitItems = getOutfitItems();
    const outfitCollected = countCollected(outfitItems);
    const outfitMissing = outfitItems.length - outfitCollected;
    const visibleMissing = visibleItems.filter((item) => !state.collected[item.id]).length;

    refs.reviewCopy.textContent = isOutfitReviewActive()
      ? `Outfit review is active. ${visibleItems.length} visible, ${visibleMissing} still missing. Use Collect + Next to work through the mannequin list faster.`
      : `${outfitItems.length} outfit entries are tracked. ${outfitCollected} collected, ${outfitMissing} still missing.`;
    refs.nextMissingButton.disabled = !getNextMissingItem(visibleItems, state.selectedId);
  }

  function renderFilters() {
    const chips = [];
    if (state.query) {
      chips.push({ label: "Search", value: state.query });
    }
    if (state.category !== "all") {
      chips.push({ label: "Category", value: state.category });
    }
    if (state.displayType !== "all") {
      chips.push({ label: "Display", value: state.displayType });
    }
    if (state.tier !== "all") {
      chips.push({ label: "Tier", value: state.tier });
    }
    if (state.rarity !== "all") {
      chips.push({ label: "Rarity", value: state.rarity });
    }
    if (state.status !== "all") {
      chips.push({ label: "Status", value: refs.statusSelect.selectedOptions[0].textContent });
    }
    if (state.sort !== "category") {
      chips.push({ label: "Sort", value: refs.sortSelect.selectedOptions[0].textContent });
    }

    refs.activeFilters.innerHTML = chips.length
      ? chips
          .map(
            (chip) => `
              <div class="filter-chip">
                <span>${escapeHtml(chip.label)}</span>
                <strong>${escapeHtml(chip.value)}</strong>
              </div>
            `
          )
          .join("")
      : '<div class="filter-chip"><span>Filters</span><strong>None</strong></div>';
  }

  function renderCollectionGrid(passedItems) {
    const visibleItems = passedItems || getVisibleItems();
    refs.visibleCountLabel.textContent = `${visibleItems.length} result${visibleItems.length === 1 ? "" : "s"}`;

    if (!visibleItems.length) {
      refs.collectionGrid.innerHTML = `
        <div class="empty-state">
          No collectibles match the current filters. Clear the filters or widen the search.
        </div>
      `;
      return;
    }

    refs.collectionGrid.innerHTML = visibleItems
      .map((item) => {
        const collected = Boolean(state.collected[item.id]);
        const selected = item.id === state.selectedId;
        const summary = item.effect || item.sourceSummary;
        return `
          <article class="collection-card ${collected ? "collected" : ""} ${selected ? "selected" : ""}" data-item-id="${item.id}" tabindex="0">
            <div class="card-image">
              <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy">
            </div>
            <div class="card-topline">
              <span>${escapeHtml(item.group)}</span>
              <span>${escapeHtml(item.displayType)}</span>
            </div>
            <h3 class="card-title">${escapeHtml(item.name)}</h3>
            <p class="card-copy">${escapeHtml(summary)}</p>
            <div class="badge-row">
              <span class="badge rarity">${escapeHtml(item.rarity || "Rare")}</span>
              <span class="badge tier">${escapeHtml(item.tier)}</span>
              <span class="badge">${escapeHtml(item.category)}</span>
              ${item.effect ? '<span class="badge effect">Effect</span>' : ""}
            </div>
            <div class="card-actions">
              <button class="collection-toggle ${collected ? "collected" : ""}" data-toggle-id="${item.id}" type="button">
                ${collected ? "Collected" : "Collect"}
              </button>
              <button class="detail-toggle" type="button">Details</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderDetail() {
    const item = data.items.find((entry) => entry.id === state.selectedId);
    if (!item) {
      refs.detailPanel.innerHTML = `
        <div class="detail-empty">
          <p class="eyebrow">Detail View</p>
          <h2>Select an item</h2>
          <p class="panel-copy">Pick a collectible from the grid to inspect where it comes from and mark it collected.</p>
        </div>
      `;
      return;
    }

    const collected = Boolean(state.collected[item.id]);
    const nextMissing = getNextMissingItem(getVisibleItems(), item.id);
    const advanceLabel = collected
      ? nextMissing
        ? "Next Missing"
        : "Review Complete"
      : nextMissing
        ? "Collect + Next"
        : "Collect + Finish";
    refs.detailPanel.innerHTML = `
      <div class="detail-topline">
        <span>${escapeHtml(item.category)}</span>
        <span>${escapeHtml(item.group)}</span>
      </div>

      <div class="detail-image">
        <img src="${item.image}" alt="${escapeHtml(item.name)}">
      </div>

      <div class="detail-block">
        <h2>${escapeHtml(item.name)}</h2>
        <div class="badge-row">
          <span class="badge rarity">${escapeHtml(item.rarity || "Rare")}</span>
          <span class="badge tier">${escapeHtml(item.tier)}</span>
          <span class="badge">${escapeHtml(item.displayType)}</span>
          ${item.effect ? '<span class="badge effect">Effect Item</span>' : ""}
        </div>
      </div>

      <div class="detail-actions">
        <button class="detail-toggle ${collected ? "collected" : ""}" data-detail-toggle="${item.id}" type="button">
          ${collected ? "Collected" : "Collect"}
        </button>
        <button class="action-button emphasis" data-detail-advance="${item.id}" type="button" ${
          collected && !nextMissing ? "disabled" : ""
        }>
          ${advanceLabel}
        </button>
        <a class="action-button" href="${item.sourceLinks[0]?.url || "#"}" target="_blank" rel="noreferrer">Open Source</a>
      </div>

      <div class="detail-block">
        <h3>Acquisition Summary</h3>
        <p class="detail-copy">${escapeHtml(item.sourceSummary)}</p>
      </div>

      ${
        item.effect
          ? `
            <div class="detail-block">
              <h3>Effect</h3>
              <p class="detail-effect">${escapeHtml(item.effect)}</p>
            </div>
          `
          : ""
      }

      <div class="detail-block">
        <h3>Where To Look</h3>
        <div class="detail-list">
          ${item.locationNotes
            .map(
              (note) => `
                <div class="detail-list-item">${escapeHtml(note)}</div>
              `
            )
            .join("")}
        </div>
      </div>

      <div class="detail-block">
        <h3>Source Links</h3>
        <div class="detail-links">
          ${item.sourceLinks
            .map(
              (link) => `
                <div class="detail-link-item">
                  <a href="${link.url}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>
                  <span>${escapeHtml(stripProtocol(link.url))}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function getVisibleItems() {
    const query = normalize(state.query);
    return [...data.items]
      .filter((item) => {
        if (state.category !== "all" && item.category !== state.category) {
          return false;
        }
        if (state.displayType !== "all" && item.displayType !== state.displayType) {
          return false;
        }
        if (state.tier !== "all" && item.tier !== state.tier) {
          return false;
        }
        if (state.rarity !== "all" && item.rarity !== state.rarity) {
          return false;
        }
        if (state.status === "collected" && !state.collected[item.id]) {
          return false;
        }
        if (state.status === "missing" && state.collected[item.id]) {
          return false;
        }
        if (query) {
          const haystack = normalize(
            [
              item.name,
              item.category,
              item.group,
              item.displayType,
              item.tier,
              item.rarity,
              item.effect,
              item.sourceSummary,
              ...(item.locationNotes || [])
            ].join(" ")
          );
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort(compareItems);
  }

  function compareItems(left, right) {
    switch (state.sort) {
      case "name":
        return left.name.localeCompare(right.name);
      case "tier":
        return left.tier.localeCompare(right.tier) || left.name.localeCompare(right.name);
      case "rarity":
        return (
          compareRarityLabels(left.rarity, right.rarity) ||
          compareTierLabels(left.tier, right.tier) ||
          left.name.localeCompare(right.name)
        );
      case "display":
        return left.displayType.localeCompare(right.displayType) || left.name.localeCompare(right.name);
      case "category":
      default:
        return (
          left.category.localeCompare(right.category) ||
          left.group.localeCompare(right.group) ||
          left.name.localeCompare(right.name)
        );
    }
  }

  function compareTierLabels(left, right) {
    const leftWeight = tierOrder[left] || 99;
    const rightWeight = tierOrder[right] || 99;
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return left.localeCompare(right);
  }

  function compareRarityLabels(left, right) {
    const leftWeight = rarityOrder[left] || 99;
    const rightWeight = rarityOrder[right] || 99;
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return String(left || "").localeCompare(String(right || ""));
  }

  function toggleCollected(id) {
    state.collected[id] = !state.collected[id];
    saveProgress();
    render();
  }

  function collectAndAdvance(id) {
    if (!state.collected[id]) {
      state.collected[id] = true;
      saveProgress();
    }

    const nextMissing = getNextMissingItem(getVisibleItems(), id);
    if (nextMissing) {
      state.selectedId = nextMissing.id;
    }
    render();
    scrollSelectionIntoView();
  }

  function jumpToNextMissingVisible() {
    const nextMissing = getNextMissingItem(getVisibleItems(), state.selectedId);
    if (!nextMissing) {
      return;
    }
    state.selectedId = nextMissing.id;
    render();
    scrollSelectionIntoView();
  }

  function getNextMissingItem(items, currentId) {
    if (!items.length) {
      return null;
    }

    const startIndex = items.findIndex((item) => item.id === currentId);
    for (let offset = 1; offset <= items.length; offset += 1) {
      const item = items[(Math.max(startIndex, 0) + offset) % items.length];
      if (!state.collected[item.id]) {
        return item;
      }
    }
    return null;
  }

  function applyOutfitReviewMode({ missingOnly }) {
    state.query = "";
    state.category = OUTFIT_CATEGORY;
    state.displayType = OUTFIT_DISPLAY_TYPE;
    state.tier = "all";
    state.rarity = "all";
    state.status = missingOnly ? "missing" : "all";
    state.sort = "rarity";
    syncControls();
    render();
  }

  function syncControls() {
    refs.searchInput.value = state.query;
    refs.categorySelect.value = state.category;
    refs.displaySelect.value = state.displayType;
    refs.tierSelect.value = state.tier;
    refs.raritySelect.value = state.rarity;
    refs.statusSelect.value = state.status;
    refs.sortSelect.value = state.sort;
  }

  function getOutfitItems() {
    return data.items.filter((item) => item.category === OUTFIT_CATEGORY);
  }

  function isOutfitReviewActive() {
    return state.category === OUTFIT_CATEGORY || state.displayType === OUTFIT_DISPLAY_TYPE;
  }

  function scrollSelectionIntoView() {
    const card = refs.collectionGrid.querySelector(`[data-item-id="${state.selectedId}"]`);
    if (!card) {
      return;
    }
    card.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function ensureSelection(visibleItems) {
    if (!visibleItems.length) {
      state.selectedId = "";
      return;
    }
    if (!visibleItems.some((item) => item.id === state.selectedId)) {
      state.selectedId = visibleItems[0].id;
    }
  }

  function loadProgress() {
    return createBlankCollectedMap();
  }

  function saveProgress() {
    persistAutoSave();
    renderProfiles();
    renderLogStatus();
  }

  function countCollected(items) {
    return items.reduce((total, item) => total + (state.collected[item.id] ? 1 : 0), 0);
  }

  function countCollectedFromMap(collected) {
    return data.items.reduce((total, item) => total + (collected?.[item.id] ? 1 : 0), 0);
  }

  function createBlankCollectedMap() {
    return Object.fromEntries(data.items.map((item) => [item.id, false]));
  }

  function supportsAutoSave() {
    return typeof window.indexedDB !== "undefined";
  }

  function requestPersistentStorage() {
    if (!navigator.storage?.persist) {
      return;
    }
    navigator.storage.persist().catch(() => {});
  }

  function buildProgressSnapshot(overrides = {}) {
    const activeProfile = getActiveProfileSummary();
    const hasSavedAtOverride = Object.prototype.hasOwnProperty.call(overrides, "savedAt");
    const savedAt = hasSavedAtOverride ? overrides.savedAt : new Date().toISOString();
    const createdAt =
      overrides.createdAt || activeProfile?.createdAt || savedAt || new Date().toISOString();
    return {
      id: overrides.id || activeProfile?.id || makeProfileId(),
      name: overrides.name || activeProfile?.name || DEFAULT_PROFILE_NAME,
      createdAt,
      savedAt,
      title: data.title,
      version: 2,
      collected: mergeCollected(overrides.collected || state.collected)
    };
  }

  function mergeCollected(incoming) {
    const nextCollected = createBlankCollectedMap();
    for (const item of data.items) {
      if (typeof incoming?.[item.id] === "boolean") {
        nextCollected[item.id] = incoming[item.id];
      }
    }
    return nextCollected;
  }

  function buildProfileSummary(profile) {
    return {
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt || "",
      savedAt: profile.savedAt || "",
      collectedCount: profile.collected ? countCollectedFromMap(profile.collected) : Number(profile.collectedCount) || 0
    };
  }

  function normalizeProfileSummaries(profiles) {
    return Array.isArray(profiles)
      ? profiles
          .filter((profile) => profile && typeof profile.id === "string")
          .map((profile) => ({
            id: profile.id,
            name: normalizeProfileName(profile.name) || DEFAULT_PROFILE_NAME,
            createdAt: profile.createdAt || "",
            savedAt: profile.savedAt || "",
            collectedCount: Number(profile.collectedCount) || 0
          }))
      : [];
  }

  function replaceProfileSummary(summary) {
    return replaceProfileSummaryInList(sessionState.profiles, summary);
  }

  function replaceProfileSummaryInList(profiles, summary) {
    const found = profiles.some((profile) => profile.id === summary.id);
    return found
      ? profiles.map((profile) => (profile.id === summary.id ? summary : profile))
      : [...profiles, summary];
  }

  function getActiveProfileSummary() {
    return sessionState.profiles.find((profile) => profile.id === sessionState.activeProfileId) || null;
  }

  function getProfileStorageKey(profileId) {
    return `${AUTO_SAVE_PROFILE_PREFIX}${profileId}`;
  }

  function makeProfileId() {
    return window.crypto?.randomUUID?.() || `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeProfileName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
  }

  function makeUniqueProfileName(value, excludeId = "") {
    const baseName = normalizeProfileName(value) || DEFAULT_PROFILE_NAME;
    let candidate = baseName;
    let suffix = 2;
    while (
      sessionState.profiles.some(
        (profile) => profile.id !== excludeId && profile.name.toLowerCase() === candidate.toLowerCase()
      )
    ) {
      candidate = `${baseName} ${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  function buildNextProfileName() {
    return makeUniqueProfileName("Profile");
  }

  function buildProfileOptionLabel(profile) {
    return `${profile.name} (${profile.collectedCount}/${data.items.length})`;
  }

  function renderProfiles() {
    if (!refs.profileSelect || !refs.profileNameInput) {
      return;
    }

    if (!sessionState.profilesLoaded) {
      refs.profileSelect.innerHTML = '<option value="">Loading local profiles...</option>';
      refs.profileSelect.disabled = true;
      refs.profileNameInput.value = "";
      refs.profileNameInput.disabled = true;
      refs.createProfileButton.disabled = true;
      refs.renameProfileButton.disabled = true;
      refs.deleteProfileButton.disabled = true;
      return;
    }

    if (!sessionState.profiles.length) {
      refs.profileSelect.innerHTML = `<option value="">${escapeHtml(DEFAULT_PROFILE_NAME)}</option>`;
      refs.profileSelect.disabled = true;
      refs.profileNameInput.value = DEFAULT_PROFILE_NAME;
      refs.profileNameInput.disabled = true;
      refs.createProfileButton.disabled = true;
      refs.renameProfileButton.disabled = true;
      refs.deleteProfileButton.disabled = true;
      return;
    }

    refs.profileSelect.innerHTML = sessionState.profiles
      .map(
        (profile) =>
          `<option value="${escapeHtml(profile.id)}">${escapeHtml(buildProfileOptionLabel(profile))}</option>`
      )
      .join("");
    refs.profileSelect.value = sessionState.activeProfileId;
    refs.profileSelect.disabled = !supportsAutoSave();

    const activeProfile = getActiveProfileSummary();
    const currentInputProfileId = refs.profileNameInput.dataset.profileId || "";
    if (activeProfile) {
      if (document.activeElement !== refs.profileNameInput || currentInputProfileId !== activeProfile.id) {
        refs.profileNameInput.value = activeProfile.name;
      }
      refs.profileNameInput.dataset.profileId = activeProfile.id;
    } else {
      refs.profileNameInput.value = "";
      refs.profileNameInput.dataset.profileId = "";
    }

    refs.profileNameInput.disabled = !supportsAutoSave() || !activeProfile;
    refs.createProfileButton.disabled = !supportsAutoSave();
    refs.renameProfileButton.disabled = !supportsAutoSave() || !activeProfile;
    refs.deleteProfileButton.disabled = !supportsAutoSave() || !activeProfile;
  }

  async function restoreAutoSave() {
    if (!supportsAutoSave()) {
      const fallbackProfile = buildProgressSnapshot({
        id: "browser-session",
        name: DEFAULT_PROFILE_NAME,
        createdAt: new Date().toISOString(),
        savedAt: "",
        collected: createBlankCollectedMap()
      });
      sessionState.profiles = [buildProfileSummary(fallbackProfile)];
      sessionState.activeProfileId = fallbackProfile.id;
      sessionState.profilesLoaded = true;
      state.collected = mergeCollected(fallbackProfile.collected);
      renderProfiles();
      renderLogStatus();
      return;
    }

    try {
      let profiles = normalizeProfileSummaries(await readAutoSaveKey(AUTO_SAVE_INDEX_KEY));
      let activeProfileId = await readAutoSaveKey(AUTO_SAVE_ACTIVE_PROFILE_KEY);
      let activeProfile = null;

      if (!profiles.length) {
        const legacySnapshot = await readAutoSaveKey(LEGACY_AUTO_SAVE_KEY);
        activeProfile = buildProgressSnapshot({
          id: makeProfileId(),
          name: DEFAULT_PROFILE_NAME,
          createdAt: legacySnapshot?.savedAt || legacySnapshot?.exportedAt || new Date().toISOString(),
          savedAt: legacySnapshot?.savedAt || legacySnapshot?.exportedAt || "",
          collected: legacySnapshot?.collected || createBlankCollectedMap()
        });
        profiles = [buildProfileSummary(activeProfile)];
        activeProfileId = activeProfile.id;
        await writeAutoSaveKey(getProfileStorageKey(activeProfile.id), activeProfile);
        await writeAutoSaveKey(AUTO_SAVE_INDEX_KEY, profiles);
        await writeAutoSaveKey(AUTO_SAVE_ACTIVE_PROFILE_KEY, activeProfileId);
      } else {
        if (!profiles.some((profile) => profile.id === activeProfileId)) {
          activeProfileId = profiles[0].id;
        }

        const activeSummary = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
        activeProfile = await readStoredProfile(activeSummary);
        profiles = replaceProfileSummaryInList(profiles, buildProfileSummary(activeProfile));
        await writeAutoSaveKey(getProfileStorageKey(activeProfile.id), activeProfile);
        await writeAutoSaveKey(AUTO_SAVE_INDEX_KEY, profiles);
        await writeAutoSaveKey(AUTO_SAVE_ACTIVE_PROFILE_KEY, activeProfileId);
      }

      sessionState.profiles = profiles;
      sessionState.activeProfileId = activeProfileId;
      sessionState.profilesLoaded = true;
      state.collected = mergeCollected(activeProfile.collected);
      sessionState.autoSaveAt = activeProfile.savedAt || activeProfile.exportedAt || "";
      renderProfiles();
      renderLogStatus();
      render();
    } catch (error) {
      sessionState.autoSaveError = "Local auto-load failed. Use Load Log to import a saved JSON backup.";
      const fallbackProfile = buildProgressSnapshot({
        id: makeProfileId(),
        name: DEFAULT_PROFILE_NAME,
        createdAt: new Date().toISOString(),
        savedAt: "",
        collected: createBlankCollectedMap()
      });
      sessionState.profiles = [buildProfileSummary(fallbackProfile)];
      sessionState.activeProfileId = fallbackProfile.id;
      state.collected = mergeCollected(fallbackProfile.collected);
      sessionState.profilesLoaded = true;
      renderProfiles();
      renderLogStatus();
      render();
    }
  }

  function persistAutoSave() {
    if (!supportsAutoSave() || !sessionState.profilesLoaded) {
      return;
    }

    const activeProfile = getActiveProfileSummary();
    if (!activeProfile) {
      return;
    }

    const snapshot = buildProgressSnapshot({
      id: activeProfile.id,
      name: activeProfile.name,
      createdAt: activeProfile.createdAt,
      collected: state.collected
    });
    const nextProfiles = replaceProfileSummary(buildProfileSummary(snapshot));
    sessionState.profiles = nextProfiles;
    sessionState.autoSavePending = true;
    sessionState.autoSaveError = "";
    renderProfiles();
    renderLogStatus();

    queueStorageTask(async () => {
      await writeAutoSaveKey(getProfileStorageKey(snapshot.id), snapshot);
      await writeAutoSaveKey(AUTO_SAVE_INDEX_KEY, nextProfiles);
      await writeAutoSaveKey(AUTO_SAVE_ACTIVE_PROFILE_KEY, snapshot.id);
    })
      .then(() => {
        sessionState.autoSavePending = false;
        if (sessionState.activeProfileId === snapshot.id) {
          sessionState.autoSaveAt = snapshot.savedAt;
        }
        renderProfiles();
        renderLogStatus();
      })
      .catch(() => {
        sessionState.autoSavePending = false;
        sessionState.autoSaveError = "Local auto-save failed. Use Save Log to export a backup JSON file.";
        renderLogStatus();
      });
  }

  function openAutoSaveDb() {
    if (!supportsAutoSave()) {
      return Promise.reject(new Error("IndexedDB unavailable."));
    }

    if (!sessionState.autoSaveDbPromise) {
      sessionState.autoSaveDbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(AUTO_SAVE_DB_NAME, 1);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(AUTO_SAVE_STORE)) {
            db.createObjectStore(AUTO_SAVE_STORE);
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Unable to open auto-save database."));
      });
    }

    return sessionState.autoSaveDbPromise;
  }

  function queueStorageTask(task) {
    sessionState.autoSavePromise = sessionState.autoSavePromise.catch(() => {}).then(task);
    return sessionState.autoSavePromise;
  }

  async function runAutoSaveRequest(mode, handler) {
    const db = await openAutoSaveDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(AUTO_SAVE_STORE, mode);
      const store = transaction.objectStore(AUTO_SAVE_STORE);
      const request = handler(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Auto-save request failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Auto-save transaction aborted."));
    });
  }

  function readAutoSaveKey(key) {
    return runAutoSaveRequest("readonly", (store) => store.get(key));
  }

  function writeAutoSaveKey(key, value) {
    return runAutoSaveRequest("readwrite", (store) => store.put(value, key));
  }

  function deleteAutoSaveKey(key) {
    return runAutoSaveRequest("readwrite", (store) => store.delete(key));
  }

  async function readStoredProfile(profileSummary) {
    const storedProfile = await readAutoSaveKey(getProfileStorageKey(profileSummary.id));
    if (!storedProfile?.collected) {
      return buildProgressSnapshot({
        id: profileSummary.id,
        name: profileSummary.name,
        createdAt: profileSummary.createdAt || new Date().toISOString(),
        savedAt: profileSummary.savedAt || "",
        collected: createBlankCollectedMap()
      });
    }

    return buildProgressSnapshot({
      id: profileSummary.id,
      name: profileSummary.name || storedProfile.name || DEFAULT_PROFILE_NAME,
      createdAt: storedProfile.createdAt || profileSummary.createdAt || storedProfile.savedAt || new Date().toISOString(),
      savedAt: storedProfile.savedAt || profileSummary.savedAt || "",
      collected: storedProfile.collected
    });
  }

  async function switchProfile(profileId) {
    if (!supportsAutoSave() || !profileId || profileId === sessionState.activeProfileId) {
      return;
    }

    const summary = sessionState.profiles.find((profile) => profile.id === profileId);
    if (!summary) {
      return;
    }

    sessionState.autoSavePending = true;
    sessionState.autoSaveError = "";
    renderLogStatus();

    try {
      const profile = await queueStorageTask(async () => {
        const loadedProfile = await readStoredProfile(summary);
        await writeAutoSaveKey(getProfileStorageKey(summary.id), loadedProfile);
        await writeAutoSaveKey(AUTO_SAVE_ACTIVE_PROFILE_KEY, summary.id);
        return loadedProfile;
      });

      sessionState.activeProfileId = summary.id;
      sessionState.profiles = replaceProfileSummary(buildProfileSummary(profile));
      state.collected = mergeCollected(profile.collected);
      sessionState.autoSaveAt = profile.savedAt || "";
      sessionState.autoSavePending = false;
      renderProfiles();
      renderLogStatus();
      render();
    } catch (error) {
      sessionState.autoSavePending = false;
      sessionState.autoSaveError = "Local profile switch failed. Your current profile is still loaded.";
      renderLogStatus();
    }
  }

  async function createProfile() {
    if (!supportsAutoSave() || !sessionState.profilesLoaded) {
      return;
    }

    const createdAt = new Date().toISOString();
    const name = makeUniqueProfileName(refs.profileNameInput.value || buildNextProfileName());
    const profile = buildProgressSnapshot({
      id: makeProfileId(),
      name,
      createdAt,
      savedAt: createdAt,
      collected: createBlankCollectedMap()
    });
    const nextProfiles = [...sessionState.profiles, buildProfileSummary(profile)];

    sessionState.autoSavePending = true;
    sessionState.autoSaveError = "";
    renderLogStatus();

    try {
      await queueStorageTask(async () => {
        await writeAutoSaveKey(getProfileStorageKey(profile.id), profile);
        await writeAutoSaveKey(AUTO_SAVE_INDEX_KEY, nextProfiles);
        await writeAutoSaveKey(AUTO_SAVE_ACTIVE_PROFILE_KEY, profile.id);
      });

      sessionState.profiles = nextProfiles;
      sessionState.activeProfileId = profile.id;
      sessionState.autoSaveAt = profile.savedAt || "";
      sessionState.autoSavePending = false;
      state.collected = mergeCollected(profile.collected);
      refs.profileNameInput.value = profile.name;
      refs.profileNameInput.dataset.profileId = profile.id;
      renderProfiles();
      renderLogStatus();
      render();
    } catch (error) {
      sessionState.autoSavePending = false;
      sessionState.autoSaveError = "Creating a new local profile failed.";
      renderLogStatus();
    }
  }

  async function renameActiveProfile() {
    if (!supportsAutoSave()) {
      return;
    }

    const activeProfile = getActiveProfileSummary();
    if (!activeProfile) {
      return;
    }

    const nextName = makeUniqueProfileName(refs.profileNameInput.value || activeProfile.name, activeProfile.id);
    if (nextName === activeProfile.name) {
      refs.profileNameInput.value = activeProfile.name;
      return;
    }

    const renamedProfile = buildProgressSnapshot({
      id: activeProfile.id,
      name: nextName,
      createdAt: activeProfile.createdAt,
      collected: state.collected
    });
    const nextProfiles = replaceProfileSummaryInList(sessionState.profiles, buildProfileSummary(renamedProfile));

    sessionState.autoSavePending = true;
    sessionState.autoSaveError = "";
    renderLogStatus();

    try {
      await queueStorageTask(async () => {
        await writeAutoSaveKey(getProfileStorageKey(renamedProfile.id), renamedProfile);
        await writeAutoSaveKey(AUTO_SAVE_INDEX_KEY, nextProfiles);
      });

      sessionState.profiles = nextProfiles;
      sessionState.autoSaveAt = renamedProfile.savedAt || "";
      sessionState.autoSavePending = false;
      refs.profileNameInput.value = nextName;
      refs.profileNameInput.dataset.profileId = renamedProfile.id;
      renderProfiles();
      renderLogStatus();
      render();
    } catch (error) {
      sessionState.autoSavePending = false;
      sessionState.autoSaveError = "Renaming the local profile failed.";
      renderLogStatus();
    }
  }

  async function deleteActiveProfile() {
    if (!supportsAutoSave()) {
      return;
    }

    const activeProfile = getActiveProfileSummary();
    if (!activeProfile) {
      return;
    }

    const confirmMessage =
      sessionState.profiles.length > 1
        ? `Delete the profile "${activeProfile.name}" from this browser?`
        : `Delete the profile "${activeProfile.name}" and replace it with a new blank ${DEFAULT_PROFILE_NAME} profile?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    sessionState.autoSavePending = true;
    sessionState.autoSaveError = "";
    renderLogStatus();

    try {
      const result = await queueStorageTask(async () => {
        await deleteAutoSaveKey(getProfileStorageKey(activeProfile.id));

        let nextProfiles = sessionState.profiles.filter((profile) => profile.id !== activeProfile.id);
        let nextActiveProfile;

        if (!nextProfiles.length) {
          const createdAt = new Date().toISOString();
          nextActiveProfile = buildProgressSnapshot({
            id: makeProfileId(),
            name: DEFAULT_PROFILE_NAME,
            createdAt,
            savedAt: createdAt,
            collected: createBlankCollectedMap()
          });
          nextProfiles = [buildProfileSummary(nextActiveProfile)];
          await writeAutoSaveKey(getProfileStorageKey(nextActiveProfile.id), nextActiveProfile);
        } else {
          const nextSummary = nextProfiles[0];
          nextActiveProfile = await readStoredProfile(nextSummary);
          await writeAutoSaveKey(getProfileStorageKey(nextActiveProfile.id), nextActiveProfile);
        }

        await writeAutoSaveKey(AUTO_SAVE_INDEX_KEY, nextProfiles);
        await writeAutoSaveKey(AUTO_SAVE_ACTIVE_PROFILE_KEY, nextActiveProfile.id);
        return { nextProfiles, nextActiveProfile };
      });

      sessionState.profiles = result.nextProfiles;
      sessionState.activeProfileId = result.nextActiveProfile.id;
      sessionState.autoSaveAt = result.nextActiveProfile.savedAt || "";
      sessionState.autoSavePending = false;
      state.collected = mergeCollected(result.nextActiveProfile.collected);
      refs.profileNameInput.value = result.nextActiveProfile.name;
      refs.profileNameInput.dataset.profileId = result.nextActiveProfile.id;
      renderProfiles();
      renderLogStatus();
      render();
    } catch (error) {
      sessionState.autoSavePending = false;
      sessionState.autoSaveError = "Deleting the local profile failed.";
      renderLogStatus();
    }
  }

  async function exportProgress() {
    const activeProfile = getActiveProfileSummary();
    const payload = {
      exportedAt: new Date().toISOString(),
      title: data.title,
      version: 2,
      profileName: activeProfile?.name || DEFAULT_PROFILE_NAME,
      collected: state.collected
    };
    const content = JSON.stringify(payload, null, 2);
    const baseName = normalize(activeProfile?.name || DEFAULT_PROFILE_NAME).replace(/\s+/g, "-") || "main";
    const suggestedName = sessionState.fileName || `f76-collection-log-${baseName}.json`;

    try {
      if ("showSaveFilePicker" in window) {
        const handle =
          sessionState.fileHandle ||
          (await window.showSaveFilePicker({
            suggestedName,
            types: [
              {
                description: "JSON collection log",
                accept: { "application/json": [".json"] }
              }
            ]
          }));

        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        sessionState.fileHandle = handle;
        markFileAction("saved", handle.name || suggestedName);
        return;
      }

      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = suggestedName;
      link.click();
      URL.revokeObjectURL(url);
      markFileAction("saved", suggestedName);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      window.alert("Save failed. Try again or use a browser that supports local file saves.");
    }
  }

  async function importProgress(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      const incoming = parsed.collected || parsed;
      state.collected = mergeCollected(incoming);
      sessionState.fileHandle = null;
      markFileAction("loaded", file.name);
      saveProgress();
      render();
    } catch (error) {
      window.alert("Load failed. Use a JSON log generated by this collection logger.");
    } finally {
      refs.importInput.value = "";
    }
  }

  function resetProgress() {
    const activeProfile = getActiveProfileSummary();
    const profileLabel = activeProfile?.name || DEFAULT_PROFILE_NAME;
    if (!window.confirm(`Reset "${profileLabel}" to a blank log and clear its collected flags?`)) {
      return;
    }
    state.collected = createBlankCollectedMap();
    sessionState.fileHandle = null;
    sessionState.fileName = "";
    sessionState.fileAction = "";
    sessionState.fileActionAt = "";
    saveProgress();
    render();
  }

  function markFileAction(action, fileName) {
    sessionState.fileName = fileName;
    sessionState.fileAction = action;
    sessionState.fileActionAt = new Date().toISOString();
    renderLogStatus();
  }

  function renderLogStatus() {
    if (!refs.logStatus) {
      return;
    }
    if (!supportsAutoSave()) {
      refs.logStatus.textContent =
        "This browser cannot auto-save locally. Use Save Log and Load Log to keep progress on this device.";
      refs.logStatus.dataset.state = "warning";
      return;
    }

    if (!sessionState.profilesLoaded) {
      refs.logStatus.textContent = "Loading local profiles from this device.";
      refs.logStatus.dataset.state = "saving";
      return;
    }

    if (sessionState.autoSaveError) {
      refs.logStatus.textContent = sessionState.autoSaveError;
      refs.logStatus.dataset.state = "warning";
      return;
    }

    const activeProfile = getActiveProfileSummary();
    const profileLabel = activeProfile?.name || DEFAULT_PROFILE_NAME;

    if (sessionState.autoSavePending) {
      refs.logStatus.textContent = `Saving profile "${profileLabel}" locally on this device. Save Log still exports a backup JSON file.`;
      refs.logStatus.dataset.state = "saving";
      return;
    }

    const baseMessage = sessionState.autoSaveAt
      ? `Profile "${profileLabel}" auto-saved locally ${formatTimestamp(sessionState.autoSaveAt)}. This browser will load it automatically next time.`
      : `Profile "${profileLabel}" auto-saves locally with IndexedDB, not cookies or cache. This browser will load it automatically next time.`;

    const fileMessage =
      sessionState.fileName && sessionState.fileAction
        ? sessionState.fileAction === "saved"
          ? ` Last exported to ${sessionState.fileName} ${formatTimestamp(sessionState.fileActionAt)}.`
          : ` Last loaded from ${sessionState.fileName} ${formatTimestamp(sessionState.fileActionAt)}.`
        : "";

    refs.logStatus.textContent = `${baseMessage}${fileMessage} Use Save Log to export a portable backup file.`;
    refs.logStatus.dataset.state = sessionState.autoSaveAt ? "saved" : "idle";
  }

  function populateSelect(select, label, values) {
    select.innerHTML =
      `<option value="all">${escapeHtml(label)}</option>` +
      values
        .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        .join("");
  }

  function uniqueValues(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
  }

  function formatTimestamp(value) {
    if (!value) {
      return "in this session";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "in this session";
    }
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function normalize(value) {
    return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function stripProtocol(value) {
    return value.replace(/^https?:\/\//, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
