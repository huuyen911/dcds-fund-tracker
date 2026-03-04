# DCDS Fund Tracker

Dashboard theo dõi NAV và hỗ trợ ra quyết định đầu tư cho **Quỹ Đầu Tư Chứng Khoán Năng Động DC (DCDS)**.

## Tính năng

- Hiển thị NAV mới nhất, MA20, ratio NAV/MA20, hệ số nhân
- **Value Averaging Calculator**: nhập số tiền định kỳ → tính số tiền nên mua dựa trên hệ số nhân (0.5x - 2.0x)
- Biểu đồ lịch sử NAV + MA20 với bộ lọc thời gian (1M, 3M, 6M, 1Y, 3Y, 5Y, All)
- Dữ liệu fetch trực tiếp từ [fmarket API](https://fmarket.vn)
- Responsive: hỗ trợ desktop, tablet, mobile

## Value Averaging

Chiến lược điều chỉnh số tiền mua dựa trên vị trí NAV so với MA20:

```
ratio = NAV / MA20
hệ số nhân = clamp(2.0 - ratio, 0.5, 2.0)
số tiền mua = số tiền định kỳ × hệ số nhân
```

- NAV < MA20 → mua nhiều hơn (hệ số nhân > 1.0)
- NAV > MA20 → mua ít đi (hệ số nhân < 1.0)
