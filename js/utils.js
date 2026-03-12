export function formatNumber(n, decimals = 2) {
  if (n == null) return "-";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: decimals });
}

export function formatDate(d) {
  if (!d) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

export function formatNav(nav) {
  if (nav == null) return "-";
  return formatNumber(nav, 2) + " VND";
}

export function navChangeClass(value) {
  if (value == null) return "text-gray-400";
  return value >= 0 ? "text-green-400" : "text-red-400";
}

export function navChangeText(value) {
  if (value == null) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function calcMA(data, window) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - window + 1; j <= i; j++) sum += data[j].nav;
      result.push(sum / window);
    }
  }
  return result;
}

export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function fundAssetTypeLabel(type) {
  const map = {
    STOCK: "Cổ phiếu",
    BOND: "Trái phiếu",
    BALANCED: "Cân bằng",
    MONEY_MARKET: "Thị trường tiền tệ",
  };
  return map[type] || type || "Khác";
}

export function assetTypeBadgeClass(code) {
  const map = {
    STOCK: "bg-blue-900/50 text-blue-300 border-blue-700",
    BOND: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
    BALANCED: "bg-purple-900/50 text-purple-300 border-purple-700",
    MONEY_MARKET: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  };
  return map[code] || "bg-gray-900/50 text-gray-300 border-gray-700";
}
