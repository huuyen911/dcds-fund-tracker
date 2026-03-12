import { fetchFundList, fetchNavHistory } from "./api.js";
import { formatNumber, formatDate, navChangeClass } from "./utils.js";

let allFunds = [];
let selectedFundId = null;
let selectedFundName = "";
let chartInstance = null;

function setupSearch() {
  const input = document.getElementById("fundSearch");
  const results = document.getElementById("searchResults");
  const selectedEl = document.getElementById("selectedFund");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      results.classList.add("hidden");
      return;
    }

    const matches = allFunds
      .filter(
        (f) =>
          (f.shortName || "").toLowerCase().includes(q) ||
          (f.name || "").toLowerCase().includes(q) ||
          (f.code || "").toLowerCase().includes(q)
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
        if (fund) {
          selectedFundId = fund.id;
          selectedFundName = fund.shortName || fund.code;
          input.value = "";
          results.classList.add("hidden");
          selectedEl.innerHTML = `
            <div class="flex items-center justify-between bg-blue-900/30 border border-blue-700 rounded-lg px-3 py-2">
              <div>
                <span class="text-sm font-semibold text-blue-300">${selectedFundName}</span>
                <span class="text-xs text-gray-400 ml-2">${fund.name || ""}</span>
              </div>
              <button onclick="window.__clearFund()" class="text-gray-400 hover:text-white text-sm">&times;</button>
            </div>`;
          document.getElementById("runBtn").disabled = false;
        }
      });
    });
  });

  input.addEventListener("blur", () => {
    setTimeout(() => results.classList.add("hidden"), 200);
  });
}

window.__clearFund = function () {
  selectedFundId = null;
  selectedFundName = "";
  document.getElementById("selectedFund").innerHTML = "";
  document.getElementById("runBtn").disabled = true;
};

function getDcaDates(navData, startDate, endDate, frequency) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    // Find closest NAV date on or after this date
    const navPoint = navData.find((d) => d.navDate >= dateStr);
    if (navPoint && !dates.some((d) => d.navDate === navPoint.navDate)) {
      dates.push(navPoint);
    }

    if (frequency === "monthly") {
      current.setMonth(current.getMonth() + 1);
    } else if (frequency === "biweekly") {
      current.setDate(current.getDate() + 14);
    } else {
      current.setDate(current.getDate() + 7);
    }
  }
  return dates;
}

function simulate(navData, amount, startDate, endDate, frequency) {
  const buyPoints = getDcaDates(navData, startDate, endDate, frequency);
  if (!buyPoints.length) return null;

  let totalUnits = 0;
  let totalInvested = 0;
  const transactions = [];
  const chartData = [];

  for (const point of buyPoints) {
    const units = amount / point.nav;
    totalUnits += units;
    totalInvested += amount;

    const currentValue = totalUnits * point.nav;
    const profitLoss = currentValue - totalInvested;

    transactions.push({
      date: point.navDate,
      nav: point.nav,
      amount,
      units,
      totalUnits,
      currentValue,
      profitLoss,
    });

    chartData.push({
      date: point.navDate,
      invested: totalInvested,
      value: currentValue,
    });
  }

  // Also add data points between buy dates for smoother chart
  const firstBuy = buyPoints[0].navDate;
  const lastBuy = buyPoints[buyPoints.length - 1].navDate;
  const relevantNav = navData.filter(
    (d) => d.navDate >= firstBuy && d.navDate <= lastBuy
  );

  const fullChartData = [];
  let txIdx = 0;
  let runningUnits = 0;
  let runningInvested = 0;

  for (const point of relevantNav) {
    // Check if this is a buy point
    if (
      txIdx < transactions.length &&
      point.navDate === transactions[txIdx].date
    ) {
      runningUnits = transactions[txIdx].totalUnits;
      runningInvested = txIdx * amount + amount;
      txIdx++;
    }

    if (runningUnits > 0) {
      fullChartData.push({
        date: point.navDate,
        invested: runningInvested,
        value: runningUnits * point.nav,
      });
    }
  }

  const lastNav = navData[navData.length - 1];
  const finalValue = totalUnits * lastNav.nav;

  return {
    totalInvested,
    finalValue,
    profit: finalValue - totalInvested,
    returnPct: ((finalValue - totalInvested) / totalInvested) * 100,
    buyCount: transactions.length,
    avgNav: totalInvested / totalUnits,
    totalUnits,
    latestNav: lastNav.nav,
    transactions,
    chartData: fullChartData.length > chartData.length ? fullChartData : chartData,
  };
}

function renderResults(result) {
  document.getElementById("results").classList.remove("hidden");

  // Summary cards
  document.getElementById("totalInvested").textContent =
    formatNumber(result.totalInvested, 0) + " VND";
  document.getElementById("currentValue").textContent =
    formatNumber(result.finalValue, 0) + " VND";

  const profitEl = document.getElementById("profit");
  const sign = result.profit >= 0 ? "+" : "";
  profitEl.textContent = `${sign}${formatNumber(result.profit, 0)} VND`;
  profitEl.className = `text-sm font-semibold ${result.profit >= 0 ? "text-green-400" : "text-red-400"}`;

  const returnEl = document.getElementById("returnPct");
  returnEl.textContent = `${sign}${result.returnPct.toFixed(2)}%`;
  returnEl.className = `text-sm font-semibold ${result.returnPct >= 0 ? "text-green-400" : "text-red-400"}`;

  document.getElementById("buyCount").textContent = result.buyCount + " lần";
  document.getElementById("avgNav").textContent = formatNumber(result.avgNav) + " VND";
  document.getElementById("totalUnits").textContent = formatNumber(result.totalUnits, 4);
  document.getElementById("latestNav").textContent = formatNumber(result.latestNav) + " VND";

  renderChart(result);
  renderTransactions(result.transactions);
}

function renderChart(result) {
  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById("dcaChart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: result.chartData.map((d) => d.date),
      datasets: [
        {
          label: "Giá trị danh mục",
          data: result.chartData.map((d) => d.value),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.08)",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 10,
          fill: true,
          tension: 0.1,
        },
        {
          label: "Tổng đầu tư",
          data: result.chartData.map((d) => d.invested),
          borderColor: "#6b7280",
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 0,
          pointHitRadius: 10,
          fill: false,
          tension: 0,
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
              `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y, 0)} VND`,
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
            callback: (v) => {
              if (v >= 1e9) return (v / 1e9).toFixed(1) + " tỷ";
              if (v >= 1e6) return (v / 1e6).toFixed(0) + " tr";
              return formatNumber(v, 0);
            },
          },
          grid: { color: "#1f2937" },
        },
      },
    },
  });
}

function renderTransactions(transactions) {
  const tbody = document.getElementById("txBody");
  tbody.innerHTML = transactions
    .map((tx) => {
      const plSign = tx.profitLoss >= 0 ? "+" : "";
      const plClass = tx.profitLoss >= 0 ? "text-green-400" : "text-red-400";
      return `
        <tr class="border-b border-gray-800">
          <td class="py-2 px-3 text-gray-300">${formatDate(tx.date)}</td>
          <td class="py-2 px-3 text-right text-white">${formatNumber(tx.nav)}</td>
          <td class="py-2 px-3 text-right text-white">${formatNumber(tx.amount, 0)}</td>
          <td class="py-2 px-3 text-right text-gray-300">${formatNumber(tx.units, 4)}</td>
          <td class="py-2 px-3 text-right text-gray-300">${formatNumber(tx.totalUnits, 4)}</td>
          <td class="py-2 px-3 text-right text-white">${formatNumber(tx.currentValue, 0)}</td>
          <td class="py-2 px-3 text-right ${plClass}">${plSign}${formatNumber(tx.profitLoss, 0)}</td>
        </tr>`;
    })
    .join("");
}

async function runSimulation() {
  if (!selectedFundId) return;

  const amount = parseFloat(document.getElementById("dcaAmount").value) || 1000000;
  const frequency = document.getElementById("dcaFrequency").value;
  const startDate = document.getElementById("dcaStart").value;
  const endDate = document.getElementById("dcaEnd").value;

  if (!startDate || !endDate) return;

  const loader = document.getElementById("loader");
  const runBtn = document.getElementById("runBtn");
  loader.classList.remove("hidden");
  runBtn.disabled = true;

  try {
    const navData = await fetchNavHistory(selectedFundId);

    if (!navData.length) {
      alert("Không có dữ liệu NAV cho quỹ này");
      return;
    }

    const result = simulate(navData, amount, startDate, endDate, frequency);
    if (!result || !result.transactions.length) {
      alert("Không có giao dịch nào trong khoảng thời gian đã chọn");
      return;
    }

    renderResults(result);
  } catch (err) {
    alert("Lỗi: " + err.message);
  } finally {
    loader.classList.add("hidden");
    runBtn.disabled = false;
  }
}

function setDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 3);

  document.getElementById("dcaEnd").value = end.toISOString().slice(0, 10);
  document.getElementById("dcaStart").value = start.toISOString().slice(0, 10);
}

async function init() {
  try {
    allFunds = await fetchFundList();
    setupSearch();
    setDefaultDates();
    document.getElementById("runBtn").addEventListener("click", runSimulation);
  } catch (err) {
    document.body.innerHTML += `<p class="text-red-400 text-center py-8">Lỗi tải dữ liệu: ${err.message}</p>`;
  }
}

init();
