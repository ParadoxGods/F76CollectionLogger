(function () {
  const data = window.F76_COLLECTIBLES;
  const FALLBACK_SELECTION = data.items[0]?.id || "";
  const OUTFIT_CATEGORY = "Outfits";
  const OUTFIT_DISPLAY_TYPE = "Mannequin";
  const sessionState = {
    dirty: false,
    fileHandle: null,
    fileName: "",
    lastSavedAt: ""
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

  initialize();

  function initialize() {
    refs.scopeText.textContent = data.scope;
    populateSelect(refs.categorySelect, "All Categories", data.categories.map((entry) => entry.label));
    populateSelect(refs.displaySelect, "All Display Types", uniqueValues(data.items.map((item) => item.displayType)));
    populateSelect(refs.tierSelect, "All Tiers", uniqueValues(data.items.map((item) => item.tier)).sort(compareTierLabels));
    renderSources();
    renderLogStatus();
    bindEvents();
    render();
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
    window.addEventListener("beforeunload", handleBeforeUnload);
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
    state.sort = "tier";
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
    sessionState.dirty = true;
    renderLogStatus();
  }

  function countCollected(items) {
    return items.reduce((total, item) => total + (state.collected[item.id] ? 1 : 0), 0);
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
        markProgressSaved(handle.name || suggestedName);
        return;
      }

      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = suggestedName;
      link.click();
      URL.revokeObjectURL(url);
      markProgressSaved(suggestedName);
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
      markProgressSaved(file.name);
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
    sessionState.lastSavedAt = "";
    saveProgress();
    render();
  }

  function markProgressSaved(fileName) {
    sessionState.dirty = false;
    sessionState.fileName = fileName;
    sessionState.lastSavedAt = new Date().toISOString();
    renderLogStatus();
  }

  function renderLogStatus() {
    if (!refs.logStatus) {
      return;
    }

    if (sessionState.dirty && sessionState.fileName) {
      refs.logStatus.textContent = `Unsaved changes in ${sessionState.fileName}. Save the log file to keep this progress on your device.`;
      refs.logStatus.dataset.state = "dirty";
      return;
    }

    if (sessionState.dirty) {
      refs.logStatus.textContent =
        "Progress is only in this tab until you save a log file. No cookies, cache, or local storage are used.";
      refs.logStatus.dataset.state = "dirty";
      return;
    }

    if (sessionState.fileName) {
      refs.logStatus.textContent = `Loaded ${sessionState.fileName}. Last saved ${formatTimestamp(sessionState.lastSavedAt)}.`;
      refs.logStatus.dataset.state = "saved";
      return;
    }

    refs.logStatus.textContent =
      "No browser storage is used. Save a JSON log file locally, then load it back whenever you want to continue.";
    refs.logStatus.dataset.state = "idle";
  }

  function handleBeforeUnload(event) {
    if (!sessionState.dirty) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
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
