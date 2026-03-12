import { fetchFundList, fetchNavHistory, fetchFundDetail } from "./api.js";
import { formatNumber, formatDate, navChangeClass, navChangeText } from "./utils.js";

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#eab308", "#a855f7"];

let allFunds = [];
let selectedFunds = []; // { id, shortName, name }
let navCache = {}; // productId -> navData[]
let detailCache = {}; // productId -> fundDetail
let chartInstance = null;
let currentRange = "1y";

function renderSelectedFunds() {
  const container = document.getElementById("selectedFunds");
  container.innerHTML = selectedFunds
    .map(
      (f, i) => `
    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border"
      style="background: ${COLORS[i]}20; border-color: ${COLORS[i]}80; color: ${COLORS[i]}">
      <span class="w-2.5 h-2.5 rounded-full" style="background: ${COLORS[i]}"></span>
      ${f.shortName}
      <button onclick="window.__removeFund(${f.id})" class="ml-1 hover:text-white transition-colors">&times;</button>
    </span>`
    )
    .join("");
}

function setupSearch() {
  const input = document.getElementById("fundSearch");
  const results = document.getElementById("searchResults");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q || q.length < 1) {
      results.classList.add("hidden");
      return;
    }

    const matches = allFunds
      .filter(
        (f) =>
          !selectedFunds.some((s) => s.id === f.id) &&
          ((f.shortName || "").toLowerCase().includes(q) ||
            (f.name || "").toLowerCase().includes(q) ||
            (f.code || "").toLowerCase().includes(q))
      )
      .slice(0, 8);

    if (!matches.length) {
      results.classList.add("hidden");
      return;
    }

    results.innerHTML = matches
      .map(
        (f) => `
      <div class="px-4 py-2.5 hover:bg-gray-800 cursor-pointer transition-colors" data-id="${f.id}">
        <div class="font-medium text-white text-sm">${f.shortName || f.code}</div>
        <div class="text-xs text-gray-400">${f.name || ""}</div>
      </div>`
      )
      .join("");
    results.classList.remove("hidden");

    results.querySelectorAll("[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const fund = allFunds.find((f) => f.id === parseInt(el.dataset.id));
        if (fund && selectedFunds.length < 5) {
          selectedFunds.push({
            id: fund.id,
            shortName: fund.shortName || fund.code,
            name: fund.name,
            productNavChange: fund.productNavChange,
          });
          renderSelectedFunds();
          input.value = "";
          results.classList.add("hidden");
          if (selectedFunds.length >= 2) loadAndRender();
        }
      });
    });
  });

  input.addEventListener("blur", () => {
    setTimeout(() => results.classList.add("hidden"), 200);
  });
}

window.__removeFund = function (id) {
  selectedFunds = selectedFunds.filter((f) => f.id !== id);
  renderSelectedFunds();
  if (selectedFunds.length >= 2) {
    loadAndRender();
  } else {
    document.getElementById("chartSection").classList.add("hidden");
    document.getElementById("emptyState").classList.remove("hidden");
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }
};

async function loadAndRender() {
  const loader = document.getElementById("loader");
  loader.classList.remove("hidden");

  // Fetch NAV history and fund details for funds not yet cached
  const toFetchNav = selectedFunds.filter((f) => !navCache[f.id]);
  const toFetchDetail = selectedFunds.filter((f) => !detailCache[f.id]);

  const promises = [];
  if (toFetchNav.length) {
    promises.push(
      Promise.all(toFetchNav.map((f) => fetchNavHistory(f.id))).then((results) => {
        toFetchNav.forEach((f, i) => { navCache[f.id] = results[i]; });
      })
    );
  }
  if (toFetchDetail.length) {
    promises.push(
      Promise.all(toFetchDetail.map((f) => fetchFundDetail(f.id))).then((results) => {
        toFetchDetail.forEach((f, i) => { detailCache[f.id] = results[i]; });
      })
    );
  }
  await Promise.all(promises);

  loader.classList.add("hidden");
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("chartSection").classList.remove("hidden");

  renderChart(currentRange);
  renderFundInfoTable();
  renderRiskMetrics();
  renderPerformanceTable();
}

function getCutoffDate(range) {
  // Find the latest common date across all selected funds
  let latestDate = null;
  for (const f of selectedFunds) {
    const data = navCache[f.id];
    if (data && data.length) {
      const last = data[data.length - 1].navDate;
      if (!latestDate || last < latestDate) latestDate = last;
    }
  }
  if (!latestDate || range === "all") return null;

  const now = new Date(latestDate);
  const cutoff = new Date(now);
  const map = {
    "3m": () => cutoff.setMonth(cutoff.getMonth() - 3),
    "6m": () => cutoff.setMonth(cutoff.getMonth() - 6),
    "1y": () => cutoff.setFullYear(cutoff.getFullYear() - 1),
    "3y": () => cutoff.setFullYear(cutoff.getFullYear() - 3),
  };
  map[range]?.();
  return cutoff.toISOString().slice(0, 10);
}

function renderChart(range) {
  currentRange = range;
  const cutoff = getCutoffDate(range);

  const datasets = selectedFunds.map((f, i) => {
    let data = navCache[f.id] || [];
    if (cutoff) {
      data = data.filter((d) => d.navDate >= cutoff);
    }
    if (!data.length) return null;

    // Normalize to % change from first value
    const baseNav = data[0].nav;
    return {
      label: f.shortName,
      data: data.map((d) => ({
        x: d.navDate,
        y: ((d.nav - baseNav) / baseNav) * 100,
      })),
      borderColor: COLORS[i],
      backgroundColor: COLORS[i] + "10",
      borderWidth: 1.5,
      pointRadius: 0,
      pointHitRadius: 10,
      tension: 0.1,
    };
  }).filter(Boolean);

  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById("compareChart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#9ca3af", font: { size: 12 } } },
        tooltip: {
          backgroundColor: "#1f2937",
          borderColor: "#374151",
          borderWidth: 1,
          titleColor: "#e5e7eb",
          bodyColor: "#e5e7eb",
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? "+" : ""}${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            parser: "yyyy-MM-dd",
            tooltipFormat: "dd/MM/yyyy",
            displayFormats: { month: "MM/yyyy", year: "yyyy" },
          },
          ticks: { color: "#6b7280", maxTicksLimit: 12 },
          grid: { color: "#1f2937" },
        },
        y: {
          ticks: {
            color: "#6b7280",
            callback: (v) => (v >= 0 ? "+" : "") + v.toFixed(0) + "%",
          },
          grid: { color: "#1f2937" },
        },
      },
    },
  });

  // Update time filter button styles
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.classList.remove("bg-blue-600", "border-blue-500", "text-white");
    btn.classList.add("bg-gray-800", "border-gray-700", "text-gray-400");
  });
  const active = document.querySelector(`[data-range="${range}"]`);
  if (active) {
    active.classList.remove("bg-gray-800", "border-gray-700", "text-gray-400");
    active.classList.add("bg-blue-600", "border-blue-500", "text-white");
  }
}

function calcVolatility(navData) {
  if (navData.length < 2) return null;
  const returns = [];
  for (let i = 1; i < navData.length; i++) {
    returns.push((navData[i].nav - navData[i - 1].nav) / navData[i - 1].nav);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  // Annualized: daily std * sqrt(252)
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function calcMaxDrawdown(navData) {
  if (navData.length < 2) return null;
  let peak = navData[0].nav;
  let maxDD = 0;
  for (const d of navData) {
    if (d.nav > peak) peak = d.nav;
    const dd = (peak - d.nav) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function makeCompareHeader(label) {
  return `<th class="py-2 px-3 text-left font-medium">${label}</th>` +
    selectedFunds
      .map((f, i) => `<th class="py-2 px-3 text-right font-medium" style="color:${COLORS[i]}">${f.shortName}</th>`)
      .join("");
}

function renderFundInfoTable() {
  document.getElementById("infoHeader").innerHTML = makeCompareHeader("Thông tin");

  const rows = [
    ["Tên đầy đủ", (d) => d?.name || "-"],
    ["Công ty quản lý", (d) => d?.owner?.shortName || "-"],
    ["Loại quỹ", (d) => d?.dataFundAssetType?.name || "-"],
    ["Phí quản lý", (d) => d?.managementFee != null ? d.managementFee + "%/năm" : "-"],
    ["Ngày thành lập", (d) => d?.firstIssueAt ? formatDate(new Date(d.firstIssueAt)) : "-"],
    ["NAV hiện tại", (d) => d?.nav != null ? formatNumber(d.nav) + " VND" : "-"],
  ];

  document.getElementById("infoBody").innerHTML = rows
    .map(([label, getter]) => {
      const cells = selectedFunds
        .map((f) => `<td class="py-2 px-3 text-right text-white">${getter(detailCache[f.id])}</td>`)
        .join("");
      return `<tr class="border-b border-gray-800"><td class="py-2 px-3 text-gray-300">${label}</td>${cells}</tr>`;
    })
    .join("");
}

function renderRiskMetrics() {
  document.getElementById("riskHeader").innerHTML = makeCompareHeader("Chỉ số");

  const riskData = selectedFunds.map((f) => {
    const nav = navCache[f.id] || [];
    // Last 1 year data for risk calc
    const cutoff1y = (() => {
      if (!nav.length) return null;
      const d = new Date(nav[nav.length - 1].navDate);
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const nav1y = cutoff1y ? nav.filter((d) => d.navDate >= cutoff1y) : nav;

    return {
      volAll: calcVolatility(nav),
      vol1y: calcVolatility(nav1y),
      mddAll: calcMaxDrawdown(nav),
      mdd1y: calcMaxDrawdown(nav1y),
    };
  });

  const rows = [
    ["Volatility (1 năm)", (r) => r.vol1y != null ? r.vol1y.toFixed(2) + "%" : "-"],
    ["Volatility (từ đầu)", (r) => r.volAll != null ? r.volAll.toFixed(2) + "%" : "-"],
    ["Max Drawdown (1 năm)", (r) => r.mdd1y != null ? "-" + r.mdd1y.toFixed(2) + "%" : "-"],
    ["Max Drawdown (từ đầu)", (r) => r.mddAll != null ? "-" + r.mddAll.toFixed(2) + "%" : "-"],
  ];

  document.getElementById("riskBody").innerHTML = rows
    .map(([label, getter]) => {
      const cells = riskData
        .map((r, i) => {
          const val = getter(r);
          const isDD = label.includes("Drawdown");
          const isVol = label.includes("Volatility");
          let colorClass = "text-white";
          if (isDD || isVol) {
            // Lower is better - highlight best (lowest) in green
            const nums = riskData.map((rd) => isDD
              ? (rd.mddAll != null ? (label.includes("1 năm") ? rd.mdd1y : rd.mddAll) : Infinity)
              : (rd.volAll != null ? (label.includes("1 năm") ? rd.vol1y : rd.volAll) : Infinity)
            );
            const minVal = Math.min(...nums.filter((n) => n !== Infinity && n != null));
            const currentNum = isDD
              ? (label.includes("1 năm") ? r.mdd1y : r.mddAll)
              : (label.includes("1 năm") ? r.vol1y : r.volAll);
            if (currentNum != null && currentNum === minVal && nums.filter((n) => n === minVal).length === 1) {
              colorClass = "text-green-400";
            }
          }
          return `<td class="py-2 px-3 text-right font-medium ${colorClass}">${val}</td>`;
        })
        .join("");
      return `<tr class="border-b border-gray-800"><td class="py-2 px-3 text-gray-300">${label}</td>${cells}</tr>`;
    })
    .join("");
}

function renderPerformanceTable() {
  const periods = [
    ["1 tháng", "navTo1Months"],
    ["3 tháng", "navTo3Months"],
    ["6 tháng", "navTo6Months"],
    ["1 năm", "navTo12Months"],
    ["2 năm", "navTo24Months"],
    ["3 năm", "navTo36Months"],
    ["5 năm", "navTo60Months"],
    ["Từ đầu", "navToBeginning"],
  ];

  document.getElementById("perfHeader").innerHTML = makeCompareHeader("Kỳ hạn");

  const body = document.getElementById("perfBody");
  body.innerHTML = periods
    .map(([label, key]) => {
      const values = selectedFunds.map((f) => f.productNavChange?.[key] ?? null);
      const validValues = values.filter((v) => v != null);
      const best = validValues.length ? Math.max(...validValues) : null;

      const cells = values
        .map((val) => {
          const isBest = val != null && val === best && validValues.filter((v) => v === best).length === 1;
          const extraClass = isBest ? " underline decoration-dotted underline-offset-4" : "";
          return `<td class="py-2 px-3 text-right font-medium ${navChangeClass(val)}${extraClass}">${navChangeText(val)}</td>`;
        })
        .join("");
      return `<tr class="border-b border-gray-800"><td class="py-2 px-3 text-gray-300">${label}</td>${cells}</tr>`;
    })
    .join("");
}

function setupTimeFilters() {
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderChart(btn.dataset.range);
    });
  });
}

async function init() {
  try {
    allFunds = await fetchFundList();
    setupSearch();
    setupTimeFilters();
  } catch (err) {
    document.getElementById("emptyState").innerHTML = `<p class="text-red-400">Lỗi tải dữ liệu: ${err.message}</p>`;
  }
}

init();
