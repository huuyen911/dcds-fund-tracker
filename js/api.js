const API_BASE = "https://api.fmarket.vn/res";

export async function fetchFundList() {
  const res = await fetch(`${API_BASE}/products/filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      pageSize: 100,
      page: 1,
      types: ["NEW_FUND", "TRADING_FUND"],
      sortOrder: "DESC",
      sortField: "navTo6Months",
    }),
  });
  const json = await res.json();
  return json.data?.rows || [];
}

export async function fetchFundDetail(productId) {
  const res = await fetch(`${API_BASE}/products/${productId}`, {
    headers: { Accept: "application/json" },
  });
  const json = await res.json();
  return json.data || null;
}

export async function fetchNavHistory(productId) {
  const res = await fetch(`${API_BASE}/product/get-nav-history`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      isAllData: 1,
      productId,
      navPeriod: "navToBeginning",
    }),
  });
  const json = await res.json();
  return (json.data || []).sort((a, b) => a.navDate.localeCompare(b.navDate));
}
