import { fetchFundList } from "./api.js";
import {
  formatNumber,
  navChangeClass,
  navChangeText,
  assetTypeBadgeClass,
} from "./utils.js";

const FAV_KEY = "fundFavorites";

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
  } catch {
    return [];
  }
}

function toggleFavorite(fundId) {
  const favs = getFavorites();
  const idx = favs.indexOf(fundId);
  if (idx === -1) {
    favs.push(fundId);
  } else {
    favs.splice(idx, 1);
  }
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  render();
}

let allFunds = [];
let currentType = "ALL";
let currentSearch = "";
// sortDir: "desc" | "asc" | null (null = no sort, use default API order)
let currentSort = null;
let sortDir = null;
let perfPeriod = "navTo1Months";

function getFilteredFunds() {
  let funds = allFunds;

  if (currentType === "FAV") {
    const favs = getFavorites();
    funds = funds.filter((f) => favs.includes(f.id));
  } else if (currentType !== "ALL") {
    funds = funds.filter(
      (f) => f.dataFundAssetType?.code === currentType
    );
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    funds = funds.filter(
      (f) =>
        f.shortName?.toLowerCase().includes(q) ||
        f.name?.toLowerCase().includes(q) ||
        f.owner?.shortName?.toLowerCase().includes(q)
    );
  }

  if (currentSort && sortDir) {
    funds = [...funds];
    funds.sort((a, b) => {
      let aVal, bVal;

      if (currentSort === "name") {
        aVal = (a.shortName || a.code || "").toLowerCase();
        bVal = (b.shortName || b.code || "").toLowerCase();
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      } else if (currentSort === "type") {
        aVal = (a.dataFundAssetType?.name || "").toLowerCase();
        bVal = (b.dataFundAssetType?.name || "").toLowerCase();
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      } else if (currentSort === "nav") {
        aVal = a.nav ?? -Infinity;
        bVal = b.nav ?? -Infinity;
      } else if (currentSort === "perf") {
        aVal = a.productNavChange?.[perfPeriod] ?? -Infinity;
        bVal = b.productNavChange?.[perfPeriod] ?? -Infinity;
      }

      if (currentSort !== "name" && currentSort !== "type") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }

  return funds;
}

function renderFundRow(fund) {
  const nc = fund.productNavChange || {};
  const assetCode = fund.dataFundAssetType?.code || "";
  const assetName = fund.dataFundAssetType?.name || "Khác";
  const perfValue = nc[perfPeriod];
  const isFav = getFavorites().includes(fund.id);
  const starColor = isFav ? "text-yellow-400" : "text-gray-600 hover:text-yellow-400";

  return `
    <tr class="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
        onclick="window.location.href='detail.html?id=${fund.id}'">
      <td class="py-3 px-4">
        <div class="flex items-center gap-2">
          <button onclick="event.stopPropagation(); window.__toggleFav(${fund.id})"
            class="${starColor} transition-colors flex-shrink-0" title="${isFav ? "Bỏ yêu thích" : "Thêm yêu thích"}">
            <svg class="w-4 h-4" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div>
            <div class="font-semibold text-white">${fund.shortName || fund.code}</div>
            <div class="text-xs text-gray-400 mt-0.5">${fund.name || ""}</div>
          </div>
        </div>
      </td>
      <td class="py-3 px-4 hidden md:table-cell">
        <span class="text-xs px-2 py-0.5 rounded border ${assetTypeBadgeClass(assetCode)}">${assetName}</span>
      </td>
      <td class="py-3 px-4 text-right font-medium text-white">${formatNumber(fund.nav)}</td>
      <td class="py-3 px-4 text-right font-medium ${navChangeClass(perfValue)}">${navChangeText(perfValue)}</td>
    </tr>
  `;
}

// Expose toggle to global scope for inline onclick
window.__toggleFav = toggleFavorite;

function updateSortIcons() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    const upIcon = th.querySelector(".sort-up");
    const downIcon = th.querySelector(".sort-down");
    if (!upIcon || !downIcon) return;

    if (th.dataset.sort === currentSort && sortDir) {
      upIcon.className = `sort-up ${sortDir === "asc" ? "text-white" : "text-gray-600"}`;
      downIcon.className = `sort-down ${sortDir === "desc" ? "text-white" : "text-gray-600"}`;
    } else {
      upIcon.className = "sort-up text-gray-600";
      downIcon.className = "sort-down text-gray-600";
    }
  });
}

function render() {
  const funds = getFilteredFunds();

  document.getElementById("fundCount").textContent = `${funds.length} quỹ`;

  const tbody = document.getElementById("fundTableBody");
  if (funds.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-12 text-center text-gray-500">Không tìm thấy quỹ nào</td>
      </tr>`;
    return;
  }
  tbody.innerHTML = funds.map(renderFundRow).join("");
  updateSortIcons();
}

function cycleSortDir(sortKey) {
  if (currentSort !== sortKey) {
    currentSort = sortKey;
    sortDir = "asc";
  } else if (sortDir === "asc") {
    sortDir = "desc";
  } else {
    currentSort = null;
    sortDir = null;
  }
}

function setupFilters() {
  document.getElementById("searchInput").addEventListener("input", (e) => {
    currentSearch = e.target.value.trim();
    render();
  });

  document.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectTypeButton(btn.dataset.type);
      render();
    });
  });

  // Header column sorting (3-state: asc → desc → none)
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", (e) => {
      if (e.target.tagName === "SELECT" || e.target.tagName === "OPTION") return;
      cycleSortDir(th.dataset.sort);
      render();
    });
  });

  // Performance period select in table header
  document.getElementById("perfPeriodSelect").addEventListener("change", (e) => {
    perfPeriod = e.target.value;
    currentSort = null;
    sortDir = null;
    render();
  });
}

function selectTypeButton(type) {
  currentType = type;
  document.querySelectorAll("[data-type]").forEach((b) => {
    b.classList.remove("bg-blue-600", "border-blue-500", "text-white");
    b.classList.add("bg-gray-800", "border-gray-700", "text-gray-300");
  });
  const active = document.querySelector(`[data-type="${type}"]`);
  if (active) {
    active.classList.remove("bg-gray-800", "border-gray-700", "text-gray-300");
    active.classList.add("bg-blue-600", "border-blue-500", "text-white");
  }
}

async function init() {
  const loader = document.getElementById("loader");
  try {
    allFunds = await fetchFundList();
    loader.classList.add("hidden");

    // Auto-select favorites if user has any
    if (getFavorites().length > 0) {
      selectTypeButton("FAV");
    }

    render();
    setupFilters();
  } catch (err) {
    loader.innerHTML = `<p class="text-red-400">Lỗi tải dữ liệu: ${err.message}</p>`;
  }
}

init();
