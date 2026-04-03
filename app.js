(function () {
  const data = window.F76_COLLECTIBLES;
  const FALLBACK_SELECTION = data.items[0]?.id || "";
  const OUTFIT_CATEGORY = "Outfits";
  const OUTFIT_DISPLAY_TYPE = "Mannequin";
  const AUTO_SAVE_DB_NAME = "f76-collection-logger";
  const AUTO_SAVE_STORE = "logs";
  const AUTO_SAVE_KEY = "current-log";
  const sessionState = {
    fileHandle: null,
    fileName: "",
    fileAction: "",
    fileActionAt: "",
    autoSaveAt: "",
    autoSaveError: "",
    autoSavePending: false,
    autoSaveDbPromise: null,
    autoSavePromise: Promise.resolve()
  };

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
    renderSources();
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
      state.status = "all";
      state.sort = "category";
      syncControls();
      render();
    });

    refs.reviewOutfitsButton.addEventListener("click", () => applyOutfitReviewMode({ missingOnly: false }));
    refs.reviewMissingOutfitsButton.addEventListener("click", () => applyOutfitReviewMode({ missingOnly: true }));
    refs.nextMissingButton.addEventListener("click", jumpToNextMissingVisible);
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
        return compareTierLabels(left.tier, right.tier) || left.name.localeCompare(right.name);
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
    return Object.fromEntries(data.items.map((item) => [item.id, false]));
  }

  function saveProgress() {
    persistAutoSave();
    renderLogStatus();
  }

  function countCollected(items) {
    return items.reduce((total, item) => total + (state.collected[item.id] ? 1 : 0), 0);
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

  function buildProgressSnapshot() {
    return {
      savedAt: new Date().toISOString(),
      title: data.title,
      collected: { ...state.collected }
    };
  }

  function mergeCollected(incoming) {
    const nextCollected = Object.fromEntries(data.items.map((item) => [item.id, false]));
    for (const item of data.items) {
      if (typeof incoming?.[item.id] === "boolean") {
        nextCollected[item.id] = incoming[item.id];
      }
    }
    return nextCollected;
  }

  async function restoreAutoSave() {
    if (!supportsAutoSave()) {
      renderLogStatus();
      return;
    }

    try {
      const snapshot = await readAutoSave();
      if (!snapshot?.collected) {
        renderLogStatus();
        return;
      }
      state.collected = mergeCollected(snapshot.collected);
      sessionState.autoSaveAt = snapshot.savedAt || snapshot.exportedAt || "";
      renderLogStatus();
      render();
    } catch (error) {
      sessionState.autoSaveError = "Local auto-load failed. Use Load Log to import a saved JSON backup.";
      renderLogStatus();
    }
  }

  function persistAutoSave() {
    if (!supportsAutoSave()) {
      return;
    }

    const snapshot = buildProgressSnapshot();
    sessionState.autoSavePending = true;
    sessionState.autoSaveError = "";

    sessionState.autoSavePromise = sessionState.autoSavePromise
      .catch(() => {})
      .then(() => writeAutoSave(snapshot))
      .then(() => {
        sessionState.autoSavePending = false;
        sessionState.autoSaveAt = snapshot.savedAt;
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

  function readAutoSave() {
    return runAutoSaveRequest("readonly", (store) => store.get(AUTO_SAVE_KEY));
  }

  function writeAutoSave(snapshot) {
    return runAutoSaveRequest("readwrite", (store) => store.put(snapshot, AUTO_SAVE_KEY));
  }

  async function exportProgress() {
    const payload = {
      exportedAt: new Date().toISOString(),
      title: data.title,
      collected: state.collected
    };
    const content = JSON.stringify(payload, null, 2);
    const suggestedName = sessionState.fileName || "f76-collection-log.json";

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
      const nextCollected = Object.fromEntries(data.items.map((item) => [item.id, false]));
      for (const item of data.items) {
        if (typeof incoming[item.id] === "boolean") {
          nextCollected[item.id] = incoming[item.id];
        }
      }
      state.collected = nextCollected;
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
    if (!window.confirm("Start a new blank log and clear the current collected flags?")) {
      return;
    }
    state.collected = Object.fromEntries(data.items.map((item) => [item.id, false]));
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

    if (sessionState.autoSaveError) {
      refs.logStatus.textContent = sessionState.autoSaveError;
      refs.logStatus.dataset.state = "warning";
      return;
    }

    if (sessionState.autoSavePending) {
      refs.logStatus.textContent = "Saving locally on this device. Save Log still exports a backup JSON file.";
      refs.logStatus.dataset.state = "saving";
      return;
    }

    const baseMessage = sessionState.autoSaveAt
      ? `Auto-saved locally ${formatTimestamp(sessionState.autoSaveAt)}. This browser will load that log automatically next time.`
      : "Progress auto-saves locally with IndexedDB, not cookies or cache. This browser will load that log automatically next time.";

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
