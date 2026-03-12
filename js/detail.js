import { fetchFundDetail, fetchNavHistory } from "./api.js";
import {
  formatNumber,
  formatDate,
  formatNav,
  navChangeClass,
  navChangeText,
  calcMA,
  getParam,
  assetTypeBadgeClass,
} from "./utils.js";

let chartInstance = null;
let allData = [];
let fundInfo = null;
let currentRange = "1y";

function renderFundHeader() {
  const nc = fundInfo.productNavChange || {};
  const assetCode = fundInfo.dataFundAssetType?.code || "";
  const assetName = fundInfo.dataFundAssetType?.name || "Khác";

  document.getElementById("fundName").textContent = fundInfo.shortName || fundInfo.code;
  document.getElementById("fundFullName").textContent = fundInfo.name;
  document.getElementById("fundNav").textContent = formatNav(fundInfo.nav);
  const prevChange = nc.navToPrevious;
  const prevEl = document.getElementById("fundNavChange");
  prevEl.textContent = navChangeText(prevChange);
  prevEl.className = `text-sm font-medium ${navChangeClass(prevChange)}`;

  document.getElementById("fundOwner").textContent = fundInfo.owner?.shortName || "-";
  document.getElementById("fundType").textContent = fundInfo.dataFundAssetType?.name || "-";
  document.getElementById("fundFee").textContent =
    fundInfo.managementFee != null ? fundInfo.managementFee + "%/năm" : "-";
  document.getElementById("fundEstablish").textContent =
    fundInfo.firstIssueAt ? formatDate(new Date(fundInfo.firstIssueAt)) : "-";

  if (fundInfo.description) {
    document.getElementById("fundDescription").textContent = fundInfo.description;
  }

  renderMA20Indicators();
  renderPerformanceTable(nc);
  renderTopHoldings();
  renderIndustryHoldings();
  renderAssetAllocation();
}

function renderMA20Indicators() {
  if (allData.length < 20) return;

  const latest = allData[allData.length - 1];
  const ma20Values = calcMA(allData, 20);
  const ma20 = ma20Values[ma20Values.length - 1];

  document.getElementById("ma20Value").textContent = formatNumber(ma20);

  const diff = latest.nav - ma20;
  const diffPct = (diff / ma20) * 100;
  const navVsMaEl = document.getElementById("navVsMa");
  const sign = diff >= 0 ? "+" : "";
  navVsMaEl.textContent = `${sign}${formatNumber(diff)}`;
  navVsMaEl.className = `text-sm font-semibold ${diff >= 0 ? "text-green-400" : "text-red-400"}`;
  document.getElementById("navVsMaSub").textContent =
    `${sign}${diffPct.toFixed(2)}% so với MA20`;

  const ratio = latest.nav / ma20;
  const ratioEl = document.getElementById("ratioValue");
  ratioEl.textContent = ratio.toFixed(4);
  ratioEl.className = `text-sm font-semibold ${ratio <= 1 ? "text-green-400" : "text-red-400"}`;
  document.getElementById("ratioSub").textContent =
    ratio <= 1 ? "NAV dưới MA20 (giá rẻ)" : "NAV trên MA20 (giá đắt)";

  const multiplier = Math.max(0.5, Math.min(2.0, 2.0 - ratio));
  document.getElementById("multiplierValue").textContent = multiplier.toFixed(2) + "x";
  document.getElementById("multDisplay").textContent = multiplier.toFixed(2) + "x";

  updateBuyAmount(multiplier);

  document.getElementById("investInput").addEventListener("input", () => {
    updateBuyAmount(multiplier);
  });
}

function updateBuyAmount(multiplier) {
  const input = parseFloat(document.getElementById("investInput").value) || 0;
  const buyAmt = input * multiplier;
  const buyEl = document.getElementById("buyAmount");
  buyEl.textContent = formatNumber(buyAmt, 0) + " VND";
  if (multiplier >= 1) {
    buyEl.className = "text-lg font-bold px-3 py-1 rounded-lg bg-green-900/50 text-green-400 border border-green-700";
  } else {
    buyEl.className = "text-lg font-bold px-3 py-1 rounded-lg bg-yellow-900/50 text-yellow-400 border border-yellow-700";
  }
}

function renderPerformanceTable(nc) {
  const periods = [
    ["1 tháng", nc.navTo1Months],
    ["3 tháng", nc.navTo3Months],
    ["6 tháng", nc.navTo6Months],
    ["1 năm", nc.navTo12Months],
    ["2 năm", nc.navTo24Months],
    ["3 năm", nc.navTo36Months],
    ["5 năm", nc.navTo60Months],
    ["Từ đầu", nc.navToBeginning],
  ];

  const tbody = document.getElementById("perfBody");
  tbody.innerHTML = periods
    .map(
      ([label, val]) => `
    <tr class="border-b border-gray-800">
      <td class="py-2 px-3 text-gray-300">${label}</td>
      <td class="py-2 px-3 text-right font-medium ${navChangeClass(val)}">${navChangeText(val)}</td>
    </tr>`
    )
    .join("");
}

function renderTopHoldings() {
  const holdings = fundInfo.productTopHoldingList || [];
  const container = document.getElementById("topHoldings");
  if (!holdings.length) {
    container.innerHTML = '<p class="text-gray-500 text-sm">Chưa có dữ liệu</p>';
    return;
  }

  container.innerHTML = `
    <div class="space-y-2">
      ${holdings
        .slice(0, 10)
        .map(
          (h) => `
        <div class="flex items-center justify-between py-1.5">
          <div>
            <span class="font-medium text-white">${h.stockCode}</span>
            <span class="text-xs text-gray-500 ml-2">${h.industry || ""}</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-24 bg-gray-700 rounded-full h-1.5">
              <div class="bg-blue-500 h-1.5 rounded-full" style="width: ${Math.min(h.netAssetPercent * 5, 100)}%"></div>
            </div>
            <span class="text-sm text-gray-300 w-14 text-right">${h.netAssetPercent?.toFixed(2)}%</span>
          </div>
        </div>`
        )
        .join("")}
    </div>`;
}

let industryChartInstance = null;

function renderIndustryHoldings() {
  const industries = fundInfo.productIndustriesHoldingList || [];
  const container = document.getElementById("industryHoldings");
  if (!industries.length) {
    container.innerHTML = '<p class="text-gray-500 text-sm">Chưa có dữ liệu</p>';
    return;
  }

  const sorted = [...industries].sort((a, b) => (b.assetPercent || 0) - (a.assetPercent || 0));
  const top = sorted.slice(0, 10);
  const labels = top.map((ind) => ind.industry || "Khác");
  const data = top.map((ind) => ind.assetPercent || 0);

  const height = Math.max(200, top.length * 32 + 40);
  container.innerHTML = `<div class="relative" style="height:${height}px"><canvas id="industryBarChart"></canvas></div>`;

  if (industryChartInstance) industryChartInstance.destroy();

  const ctx = document.getElementById("industryBarChart").getContext("2d");
  industryChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: "#3b82f6",
        borderRadius: 4,
        barThickness: 18,
      }],
    },
    plugins: [{
      id: "barLabels",
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const val = chart.data.datasets[0].data[i];
          ctx.save();
          ctx.fillStyle = "#e5e7eb";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`${val}%`, bar.x + 6, bar.y);
          ctx.restore();
        });
      },
    }],
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { right: 40 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1f2937",
          borderColor: "#374151",
          borderWidth: 1,
          titleColor: "#e5e7eb",
          bodyColor: "#e5e7eb",
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.x}%`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#6b7280",
            callback: (v) => v + "%",
          },
          grid: { color: "#1f2937" },
        },
        y: {
          ticks: {
            color: "#d1d5db",
            font: { size: 11 },
          },
          grid: { display: false },
        },
      },
    },
  });
}

let pieChartInstance = null;

function renderAssetAllocation() {
  const assets = fundInfo.productAssetHoldingList || [];
  const container = document.getElementById("assetAllocation");
  if (!assets.length) {
    container.innerHTML = '<p class="text-gray-500 text-sm">Chưa có dữ liệu</p>';
    return;
  }

  const chartColors = {
    STOCK: "#3b82f6",
    BOND: "#10b981",
    CASH: "#eab308",
    OTHER: "#a855f7",
  };

  container.innerHTML = '<div class="relative h-[250px]"><canvas id="assetPieChart"></canvas></div>';

  if (pieChartInstance) pieChartInstance.destroy();

  const ctx = document.getElementById("assetPieChart").getContext("2d");
  pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: assets.map((a) => a.assetType?.name || "Khác"),
      datasets: [{
        data: assets.map((a) => a.assetPercent),
        backgroundColor: assets.map((a) => chartColors[a.assetType?.code] || "#6b7280"),
        borderColor: "#111827",
        borderWidth: 2,
      }],
    },
    plugins: [{
      id: "doughnutLabels",
      afterDraw(chart) {
        const { ctx, data } = chart;
        chart.getDatasetMeta(0).data.forEach((arc, i) => {
          const val = data.datasets[0].data[i];
          if (val < 5) return;
          const { x, y } = arc.tooltipPosition();
          ctx.save();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${val}%`, x, y);
          ctx.restore();
        });
      },
    }],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#d1d5db",
            font: { size: 12 },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,

            generateLabels: (chart) =>
              chart.data.labels.map((label, i) => ({
                text: `${label}: ${chart.data.datasets[0].data[i]}%`,
                fillStyle: chart.data.datasets[0].backgroundColor[i],
                fontColor: "#d1d5db",
                strokeStyle: chart.data.datasets[0].backgroundColor[i],
                lineWidth: 0,
                pointStyle: "rectRounded",
                hidden: false,
                index: i,
              })),
          },
        },
        tooltip: {
          backgroundColor: "#1f2937",
          borderColor: "#374151",
          borderWidth: 1,
          titleColor: "#e5e7eb",
          bodyColor: "#e5e7eb",
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`,
          },
        },
      },
    },
  });
}

function filterData(range) {
  if (range === "all") return allData;
  const now = new Date(allData[allData.length - 1].navDate);
  const cutoff = new Date(now);
  const map = {
    "1m": () => cutoff.setMonth(cutoff.getMonth() - 1),
    "3m": () => cutoff.setMonth(cutoff.getMonth() - 3),
    "6m": () => cutoff.setMonth(cutoff.getMonth() - 6),
    "1y": () => cutoff.setFullYear(cutoff.getFullYear() - 1),
    "3y": () => cutoff.setFullYear(cutoff.getFullYear() - 3),
    "5y": () => cutoff.setFullYear(cutoff.getFullYear() - 5),
  };
  map[range]?.();
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  let startIdx = allData.findIndex((d) => d.navDate >= cutoffStr);
  startIdx = Math.max(0, startIdx - 20);
  return allData.slice(startIdx);
}

function renderChart(range) {
  currentRange = range;
  const filtered = filterData(range);
  const ma20 = calcMA(filtered, 20);

  const cutoffDate =
    range === "all"
      ? null
      : (() => {
          const now = new Date(allData[allData.length - 1].navDate);
          const c = new Date(now);
          const map = {
            "1m": () => c.setMonth(c.getMonth() - 1),
            "3m": () => c.setMonth(c.getMonth() - 3),
            "6m": () => c.setMonth(c.getMonth() - 6),
            "1y": () => c.setFullYear(c.getFullYear() - 1),
            "3y": () => c.setFullYear(c.getFullYear() - 3),
            "5y": () => c.setFullYear(c.getFullYear() - 5),
          };
          map[range]?.();
          return c.toISOString().slice(0, 10);
        })();

  const displayData = cutoffDate
    ? filtered.filter((d) => d.navDate >= cutoffDate)
    : filtered;
  const displayMA = cutoffDate
    ? ma20.slice(filtered.length - displayData.length)
    : ma20;

  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById("navChart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: displayData.map((d) => d.navDate),
      datasets: [
        {
          label: "NAV",
          data: displayData.map((d) => d.nav),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.05)",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 10,
          fill: true,
          tension: 0.1,
        },
        {
          label: "MA20",
          data: displayMA,
          borderColor: "#eab308",
          borderWidth: 1.2,
          borderDash: [4, 3],
          pointRadius: 0,
          pointHitRadius: 10,
          fill: false,
          tension: 0.1,
        },
      ],
    },
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
              `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} VND`,
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
            callback: (v) =>
              v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(0),
          },
          grid: { color: "#1f2937" },
        },
      },
    },
  });
}

function setupTimeFilters() {
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-range]").forEach((b) => {
        b.classList.remove("bg-blue-600", "border-blue-500", "text-white");
        b.classList.add("bg-gray-800", "border-gray-700", "text-gray-400");
      });
      btn.classList.remove("bg-gray-800", "border-gray-700", "text-gray-400");
      btn.classList.add("bg-blue-600", "border-blue-500", "text-white");
      renderChart(btn.dataset.range);
    });
  });
}

async function init() {
  const productId = getParam("id");
  if (!productId) {
    window.location.href = "index.html";
    return;
  }

  const loader = document.getElementById("loader");

  try {
    const [detail, navData] = await Promise.all([
      fetchFundDetail(productId),
      fetchNavHistory(productId),
    ]);

    fundInfo = detail;
    allData = navData;

    loader.classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");

    renderFundHeader();
    setupTimeFilters();

    if (allData.length > 0) {
      renderChart(currentRange);
    }

    document.title = `${fundInfo.shortName || fundInfo.code} - Phân Tích Quỹ`;
  } catch (err) {
    loader.innerHTML = `<p class="text-red-400">Lỗi tải dữ liệu: ${err.message}</p>`;
  }
}

init();
