# FundTracker - Phân Tích Chứng Chỉ Quỹ Việt Nam

Dashboard phân tích và so sánh các chứng chỉ quỹ mở tại Việt Nam. Dữ liệu realtime từ [fmarket API](https://fmarket.vn).

## Tính năng

### Danh sách quỹ (`index.html`)
- Hiển thị toàn bộ quỹ mở (cổ phiếu, trái phiếu, cân bằng, thị trường tiền tệ)
- Thông tin NAV, biến động 1M/6M/1Y/All
- Tìm kiếm và lọc theo loại quỹ

### Chi tiết quỹ (`detail.html`)
- NAV mới nhất, MA20, ratio NAV/MA20, hệ số nhân
- Biểu đồ lịch sử NAV + MA20 với bộ lọc thời gian (1M, 3M, 6M, 1Y, 3Y, 5Y, All)
- Value Averaging Calculator: tính số tiền nên mua dựa trên hệ số nhân

### So sánh quỹ (`compare.html`)
- So sánh hiệu suất nhiều quỹ trên cùng biểu đồ
- Chọn quỹ và khoảng thời gian linh hoạt

### Mô phỏng DCA (`dca.html`)
- Mô phỏng chiến lược Dollar-Cost Averaging
- Biểu đồ tổng giá trị đầu tư theo thời gian

## Value Averaging

Chiến lược điều chỉnh số tiền mua dựa trên vị trí NAV so với MA20:

```
ratio = NAV / MA20
hệ số nhân = clamp(2.0 - ratio, 0.5, 2.0)
số tiền mua = số tiền định kỳ × hệ số nhân
```

- NAV < MA20 → mua nhiều hơn (hệ số nhân > 1.0)
- NAV > MA20 → mua ít đi (hệ số nhân < 1.0)

## Cấu trúc dự án

```
├── index.html          # Trang danh sách quỹ
├── detail.html         # Trang chi tiết quỹ
├── compare.html        # Trang so sánh quỹ
├── dca.html            # Trang mô phỏng DCA
└── js/
    ├── api.js          # Gọi API fmarket
    ├── list.js         # Logic trang danh sách
    ├── detail.js       # Logic trang chi tiết
    ├── compare.js      # Logic trang so sánh
    ├── dca.js          # Logic trang DCA
    └── utils.js        # Hàm tiện ích dùng chung
```

## Tech stack

- Vanilla JS (ES Modules)
- Tailwind CSS (CDN)
- Chart.js
- Responsive: hỗ trợ desktop, tablet, mobile
