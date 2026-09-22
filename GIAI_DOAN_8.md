# Giai đoạn 8 — Dashboard và thống kê cho quản lý

Triển khai ngày **17/09/2026**, tiếp nối [giai đoạn 7](GIAI_DOAN_7.md). Trang mới: **`/admin/dashboard`**.

Dashboard đọc dữ liệu hiện có. Không đổi cách tạo đơn, snapshot, chống gửi trùng, trackingToken, chuyển trạng thái, hủy, thanh toán riêng hoặc conflict 409. Không thêm field status cho Table.

## 1. Dashboard có những gì?

- Doanh thu đã thanh toán, tổng đơn được tạo trong kỳ.
- Số đơn đã thanh toán, số đơn tạo trong kỳ hiện đã hủy, giá trị trung bình mỗi đơn thanh toán.
- Số đơn đang xử lý; số bàn đang sử dụng, bàn trống và tổng bàn ở thời điểm đọc.
- Biểu đồ doanh thu theo giờ/ngày, điền 0 cho mốc không có doanh thu.
- Top 10 món theo số lượng bán, kèm doanh thu của từng món.
- Tối đa 10 đơn gần nhất được tạo trong kỳ, liên kết mở chi tiết nội bộ.
- Bộ lọc Hôm nay, 7 ngày, 30 ngày, Tháng này và chọn tháng khác.
- Đang tải, lỗi/thử lại, dữ liệu rỗng, cảnh báo dữ liệu sai, làm mới thủ công và realtime.

Chỉ admin được xem. Staff bị chặn ở cả React và API; chưa đăng nhập nhận 401, staff nhận 403. Quyền luôn do backend kiểm tra bằng `requireAuth` và `requireRoles('admin')`.

## 2. Dữ liệu đến từ đâu?

```text
Admin chọn khoảng thời gian
  → Axios gửi period hoặc from/to
  → Express kiểm tra JWT, quyền admin và query
  → MongoDB lọc/tổng hợp Order
  → API trả các con số và danh sách nhỏ
  → React hiển thị; Chart.js vẽ biểu đồ
```

Frontend không tải toàn bộ lịch sử Order để cộng tiền. MongoDB thực hiện phần tính thống kê. Backend chỉ điền các mốc thời gian trống và tính trung bình từ kết quả tổng hợp.

Không đọc Product hiện tại để tính doanh thu hoặc lấy tên món thống kê; không `$lookup Product`. Tình trạng bàn sử dụng các trạng thái có sẵn từ `orderStatus.js`.

## 3. Công thức và field lọc của từng số liệu

| Chỉ số | Điều kiện / thời gian | Ý nghĩa |
|---|---|---|
| `revenue` | status=completed, paidAt kiểu Date trong kỳ | Tổng `Order.totalAmount` đã lưu |
| `completedOrders` | Cùng điều kiện revenue | Số đơn đã thanh toán trong kỳ |
| `averageOrderValue` | Cùng điều kiện revenue | revenue / completedOrders; không có đơn thì 0 |
| `totalOrders` | createdAt trong kỳ, mọi status | Số đơn được tạo trong kỳ |
| `cancelledOrders` | createdAt trong kỳ, hiện status=cancelled | Đơn tạo trong kỳ và hiện đã hủy |
| Món bán chạy / doanh thu món | completed, paidAt kiểu Date trong kỳ | Cộng quantity / lineTotal của snapshot items |
| `activeOrders` | pending/confirmed/preparing/served hiện tại | Không phụ thuộc bộ lọc thời gian |
| `activeTables` | Bàn hiện có ít nhất một đơn đang xử lý | Đếm mỗi bàn một lần, không phụ thuộc kỳ |
| `emptyTables` | Tổng Table hiện có trừ activeTables | Không còn đơn đang xử lý |
| Đơn gần đây | createdAt trong kỳ | Mới nhất trước, giới hạn 10 mặc định |
| `dataWarnings.completedWithoutPaidAt` | completed có paidAt thiếu hoặc sai kiểu, toàn database | Cảnh báo dữ liệu không gán được vào kỳ thanh toán |

Chỉ completed mới là doanh thu vì nghiệp vụ đã chốt: **đã phục vụ và nhân viên xác nhận khách đã thanh toán**. Served vẫn chưa được tính. Cancelled không cộng tiền hoặc món bán chạy, dù dữ liệu sai vô tình có paidAt.

### createdAt khác paidAt thế nào?

- `createdAt`: khách đặt đơn lúc nào.
- `paidAt`: nhân viên xác nhận nhận tiền lúc nào.

Đơn tạo hôm qua 23:50, thanh toán hôm nay 00:10: số đơn thuộc hôm qua, doanh thu và completedOrders thuộc hôm nay. Không dùng updatedAt hoặc createdAt thay paidAt. Vì hai nhóm lọc khác nhau, completedOrders không nhất thiết nhỏ hơn totalOrders trong cùng kỳ.

### Ý nghĩa chính xác của cancelledOrders

Đây là **“đơn được tạo trong khoảng này và hiện đã hủy”**, không phải “số thao tác hủy diễn ra trong khoảng này”. Ví dụ tạo ngày 17, hủy ngày 18: cancelledOrders của ngày 17 tăng, không phải ngày 18. Con số một ngày cũ có thể thay đổi về sau; luôn `cancelledOrders ≤ totalOrders`.

Muốn thống kê hoạt động hủy theo ngày sau này phải có chỉ số riêng dựa trên cancelledAt. Giai đoạn 8 không thay đổi định nghĩa trên.

### Tình trạng hiện tại

Bàn 05 có D preparing và E pending: activeOrders=2, activeTables=1. Hoàn thành một đơn, bàn vẫn bận nếu đơn kia còn xử lý.

Bàn tắt `isActive=false` vẫn được tính bận nếu còn đơn cũ. Tổng bàn/bàn trống gồm cả bàn tắt nhận đơn mới, nhất quán màn hình bàn giai đoạn 6. Không lưu tình trạng bàn vào database. Không coi “trống” là bằng chứng khách đã rời bàn thực tế.

## 4. Múi giờ và bộ lọc

Múi giờ thống kê: **Asia/Ho_Chi_Minh**, UTC+7 trong phạm vi năm 2000–2100 được hỗ trợ. Giới hạn năm giúp kiểm tra đầu vào rõ ràng, không xử lý các quy tắc múi giờ lịch sử ngoài phạm vi quán.

| Query | Khoảng do backend tính | Biểu đồ |
|---|---|---|
| Không gửi query / `period=today` | Hôm nay tại Việt Nam | 24 cột giờ 00–23 |
| `period=7d` | Hôm nay và 6 ngày trước | Theo ngày, 7 mốc |
| `period=30d` | Hôm nay và 29 ngày trước | Theo ngày, 30 mốc |
| `period=month` | Từ đầu đến hết tháng hiện tại | Theo ngày |
| `period=month&month=2026-09` | Toàn tháng được chọn | Theo ngày |
| `from=2026-09-16&to=2026-09-17` | Hai ngày, bao gồm cả ngày đầu/cuối | Theo ngày |

Khoảng query là **nửa mở**: `[from 00:00 Việt Nam, ngày sau to 00:00 Việt Nam)`. Nghĩa là nhận đầu khoảng và loại đầu ngày sau khoảng.

Ví dụ ngày 17/09/2026:

```text
start = 2026-09-16T17:00:00.000Z
end   = 2026-09-17T17:00:00.000Z
paidAt >= start VÀ paidAt < end
```

MongoDB lưu UTC; backend xác định ngày tại Việt Nam rồi đổi mốc về UTC để truy vấn. `$dateToString` luôn có `timezone: 'Asia/Ho_Chi_Minh'`. Không group theo ngày UTC.

`from=to` hợp lệ. Khoảng tối đa 366 ngày, bao gồm hai ngày đầu/cuối. Ngày không tồn tại, sai format, thiếu một đầu khoảng, from>to, query trùng hoặc lạ đều nhận 400. Không kết hợp period với from/to; month chỉ đi với period=month. Products/recent nhận thêm limit số nguyên 1–50, mặc định 10.

Frontend chỉ gửi preset, không tự tính ngày bằng đồng hồ máy khách. Service nhận `now` từ controller; mặc định controller dùng giờ server. Test truyền now cố định, không giả đồng hồ toàn cục. Ví dụ `now=2026-09-16T17:05:00Z` thì today là **17/09**.

Phản hồi mỗi API có `range` ghi from/to, start/end, timezone, granularity, today và includesToday để giao diện biết chính xác kỳ đang xem.

## 5. Món bán chạy và snapshot

**Snapshot** là tên/giá/thành tiền được ghi lại trong Order tại lúc đặt. Đổi giá hiện tại của Product không sửa giao dịch cũ.

Thống kê:

1. Lấy đơn completed có paidAt hợp lệ trong kỳ.
2. Sắp paidAt giảm dần, rồi createdAt giảm dần, rồi _id giảm dần.
3. Tách các dòng items để cộng dồn.
4. **Group theo productId**, không group theo tên.
5. quantitySold = tổng quantity; revenue = tổng lineTotal.
6. Tên hiển thị lấy snapshot đầu tiên sau bước sắp xếp, tức snapshot mới nhất trong kỳ.
7. Sắp quantitySold giảm dần, revenue giảm dần, productName tăng dần. Nếu vẫn bằng nhau dùng productId để thứ tự ổn định.

Một đơn có nhiều dòng cùng productId, chẳng hạn ghi chú khác nhau, vẫn cộng vào một dòng thống kê. Nếu các dòng trong cùng đơn có tên khác nhau, giữ tên của dòng xuất hiện trước trong items.

Đổi tên món không tách món thành hai dòng. Xem kỳ cũ hiển thị tên snapshot cũ là đúng. Product bị ẩn/ngừng bán/xóa cũng không làm mất lịch sử.

Trong bộ A–E chỉ có 3 món nên tổng tiền Top 10 bằng revenue. Với hơn 10 món đã bán, Top 10 chỉ là một phần; không khẳng định tổng của Top 10 luôn bằng tổng doanh thu quán.

## 6. MongoDB aggregation là gì?

**Aggregation** là cho MongoDB xử lý dữ liệu theo chuỗi bước: lọc đơn phù hợp → nhóm dữ liệu → cộng tiền/số lượng → sắp kết quả. Có thể hiểu như lọc một chồng hóa đơn rồi cộng thành báo cáo ngay tại nơi lưu hóa đơn.

- `$match`: chọn đơn phù hợp.
- `$group` và `$sum`: nhóm/cộng.
- `$unwind`: tách từng dòng món trong items để thống kê.
- `$sort`, `$first`: chọn snapshot mới nhất và xếp hạng.
- `$dateToString`: chia thời gian thanh toán theo giờ/ngày Việt Nam.
- `$limit`: chỉ trả Top món hoặc số đơn cần xem.

Chỉ dùng `$lookup` với Table để đếm những bàn hiện còn tồn tại; không đọc Product. Không tạo collection tổng hợp theo ngày, cron hoặc cache thống kê riêng. Các truy vấn thống kê Order có giới hạn thực thi 10 giây; khoảng thời gian tối đa 366 ngày.

Các số liệu được đọc bằng nhiều query/API. Nếu nhân viên đang xử lý đúng lúc dashboard tải, các khối có thể lệch thời điểm rất ngắn; event tiếp theo hoặc làm mới sẽ đọc lại.

## 7. Bốn API mới

Tất cả là GET, cần JWT admin, có `Cache-Control: no-store`.

| API | `data` trả về |
|---|---|
| `/api/dashboard/summary` | range, revenue, totalOrders, completedOrders, cancelledOrders, averageOrderValue, activeOrders, activeTables, emptyTables, totalTables, dataWarnings |
| `/api/dashboard/revenue` | range, points: [{ date, revenue }] |
| `/api/dashboard/products` | range, products: [{ productId, productName, quantitySold, revenue }] |
| `/api/dashboard/recent-orders` | range, orders: [{ _id, orderCode, customerName, tableName, totalAmount, status, createdAt, paidAt }] |

Ví dụ: `/api/dashboard/summary?period=today`, `/api/dashboard/products?period=month&month=2026-09&limit=5`.

Đơn gần đây lọc theo createdAt của kỳ đang chọn, sort `createdAt desc, _id desc`. Không trả items, token/hash hay tải toàn bộ lịch sử.

## 8. Realtime dashboard

Giữ nguyên socket singleton và room staff đã xác thực của giai đoạn 7. Không tạo room hoặc payload thống kê mới.

```text
Đơn được ghi thành công
  → order:created / order:updated / order:cancelled / table:updated
  → Dashboard biết có thay đổi
  → Gom event trong 1,5 giây
  → Gọi lại 4 API thống kê
```

**Debounce** là gom nhiều thông báo gần nhau thành một lượt tải. Đã kiểm tra 40 event liên tiếp chỉ tạo một bộ **4 GET**. OPTIONS do trình duyệt kiểm tra CORS là request riêng, không phải lần tải dữ liệu thống kê.

- Kỳ không chứa hôm nay: bỏ qua event; giao diện ghi rõ và giữ nút Làm mới số liệu. Kỳ cũ có thể đổi cancelledOrders về sau, nên không xem đó là dữ liệu bất biến.
- Tab ẩn: không tự refetch theo event; khi hiện lại đọc API.
- Connect/reconnect: dùng readyVersion sau ACK room của giai đoạn 7, rồi refetch; tab đang ẩn chờ hiện lại.
- Socket ngắt: đổi bộ lọc/làm mới API vẫn hoạt động.
- Đổi bộ lọc: AbortController hủy cả bộ request cũ; chỉ nhận kết quả chưa bị hủy của đúng bộ lọc. Không để response chậm ghi đè kỳ mới.
- Cleanup đúng `off(event, handler)` và timer khi rời trang; không nhân listener.

MongoDB là dữ liệu chính thức; API đọc số liệu; Socket.IO chỉ thông báo thay đổi. Không gửi doanh thu trong event và không chuyển nghiệp vụ order sang socket.

## 9. Thư viện biểu đồ

Đã kiểm tra package trước khi thêm: project chưa có chart library. Chỉ thêm **`chart.js` 4.5.1** vào frontend, không thêm wrapper React hay thư viện giao diện.

Dùng biểu đồ cột, chỉ đăng ký BarController, BarElement, CategoryScale, LinearScale và Tooltip. Component tạo biểu đồ trong useEffect, gọi destroy khi dọn. Dashboard được tải riêng bằng React.lazy; menu/giỏ không cần tải Chart.js. Có bảng số liệu mở rộng để đọc con số mà không phải ước lượng chiều cao cột.

Tham khảo: [Chart.js — tích hợp và chỉ nạp thành phần cần dùng](https://www.chartjs.org/docs/latest/getting-started/integration.html).

## 10. Kiểm tra tính toàn vẹn dữ liệu trước triển khai

Chạy từ gốc project:

```bash
npm --prefix server run check:data
```

Script `server/scripts/checkData.js` đọc collection gốc bằng cursor theo từng nhóm, không ép paidAt string thành Date qua Mongoose model. Không ghi dữ liệu, không tạo index, không gọi API, không in secret hoặc URI kết nối.

Kết quả trước khi triển khai trên database **restaurant_qr**, collection **orders**:

| Mục | Số lượng |
|---|---:|
| Đơn đã đọc | 0 |
| Dòng món đã đọc | 0 |
| completed thiếu/sai kiểu paidAt | 0 |
| Dòng có lineTotal khác unitPrice × quantity | 0 |
| Đơn có totalAmount khác tổng lineTotal | 0 |
| Dòng thiếu productId | 0 |

**Đạt vì chưa có đơn trong database hiện tại.** Kết quả này không chứng minh dữ liệu được nhập sau này cũng hợp lệ; cần chạy lại khi dùng dữ liệu mới/import.

Nếu bất cứ lỗi nào >0, script in số lượng và tối đa 10 mã/ID đơn mẫu mỗi nhóm, trả exit code 2: **dừng triển khai, chờ người dùng quyết định**. Không backfill, không sửa bản ghi cũ, không lấy ngày khác thay paidAt. Exit code 1 là không kiểm tra được kết nối; không coi là dữ liệu sạch.

Test riêng cố ý đưa đủ bốn lỗi vào database thử, xác nhận script phát hiện tất cả, exit 2 và dữ liệu trước/sau giống hệt nhau. Những bản ghi sai chỉ thuộc database thử, được dọn; không sửa database quán.

Khi dashboard hoạt động, summary luôn trả `dataWarnings.completedWithoutPaidAt` cho toàn database. PaidAt dạng string cũng bị cảnh báo, không được tự đổi sang Date để cộng doanh thu. Admin thấy cảnh báo rõ ràng nếu số lượng >0.

## 11. Explain và index

**Explain** cho biết MongoDB chọn cách tìm dữ liệu. **IXSCAN** nghĩa là đi qua chỉ mục; **COLLSCAN** là quét collection. Có IXSCAN vẫn có thể đọc nhiều bản ghi nếu chỉ mục chưa lọc được ngày.

Trước thay đổi, database hiện tại có index `status + createdAt + _id`, chưa có `status + paidAt`:

- Doanh thu: IXSCAN theo status, paidAt được kiểm tra ở bước FETCH, không được thu hẹp trong index.
- Số đơn: IXSCAN theo `createdAt_-1__id_-1`, đã phù hợp.
- Database thật rỗng nên số bản ghi đọc là 0; không dùng số 0 để kết luận hiệu năng khi dữ liệu tăng.

Đã đo trên **database thử riêng gồm 3.660 đơn completed**, 10 đơn/ngày trong 366 ngày; query một ngày trả 10 đơn:

| Kế hoạch doanh thu | Keys đọc | Documents đọc | Kết quả |
|---|---:|---:|---:|
| Trước, index status + createdAt + _id | 3.660 | 3.660 | 10 |
| Sau, index status + paidAt | 10 | 10 | 10 |

Vì vậy chỉ thêm **một index `{ status: 1, paidAt: 1 }`** vào Order. Giữ nguyên index createdAt và các index nghiệp vụ cũ. Không tạo index mọi field.

Sau thay đổi, explain trên database hiện tại và test đều chọn IXSCAN `status_1_paidAt_1` cho doanh thu; IXSCAN `createdAt_-1__id_-1` cho số đơn. Không chọn COLLSCAN trong hai query đã kiểm tra. Kế hoạch có thể khác với phân bố dữ liệu/MongoDB khác, không ép hint ở API.

Chạy lại **chỉ đọc**:

```bash
npm --prefix server run explain:dashboard
```

Script dùng ngày 17/09/2026 cố định và in winningPlan, số keys/documents đọc. Không tạo hoặc xóa index. Database benchmark riêng đã được dọn, không thêm 3.660 đơn vào dữ liệu quán.

Tham khảo: [MongoDB — Explain results](https://www.mongodb.com/docs/manual/reference/explain-results/), [MongoDB — timezone của $dateToString](https://www.mongodb.com/docs/manual/reference/operator/aggregation/datetostring/).

## 12. Bộ dữ liệu tính tay A–E

Toàn bộ giờ dưới đây là **giờ Việt Nam, năm 2026**. `now = 17/09 20:00`, tức **2026-09-17T13:00:00Z**.

Giá lúc bán: **Cà phê sữa 25.000đ; Bạc xỉu 50.000đ; Trà đào 50.000đ**.

| Đơn | Bàn | Trạng thái | Tạo | Thanh toán | Món / thành tiền | Tổng |
|---|---|---|---|---|---|---:|
| A | 01 | completed | 17/09 10:00 | 17/09 11:00 | 2 Cà phê sữa = 50.000đ; 1 Bạc xỉu = 50.000đ | 100.000đ |
| B | 02 | completed | 16/09 23:50 | 17/09 00:10 | 4 Cà phê sữa = 100.000đ; 2 Trà đào = 100.000đ | 200.000đ |
| C | 03 | cancelled | 17/09 12:00 | — | 10 Trà đào | 500.000đ |
| D | 05 | preparing | 17/09 13:00 | — | 3 Cà phê sữa | 75.000đ |
| E | 05 | pending | 17/09 13:05 | — | 1 Cà phê sữa | 25.000đ |

Thanh toán của B theo UTC là **2026-09-16T17:10:00Z**. Sau khi lưu A–E, đổi giá Cà phê sữa trong Product thành **30.000đ**; không sửa snapshot.

Kết quả khi xem **Hôm nay, 17/09** — đã đối chiếu bằng backend test và Chrome:

| Chỉ số | Kết quả | Cách tính |
|---|---:|---|
| revenue | 300.000đ | A + B |
| totalOrders | 4 | A, C, D, E; B tạo ngày 16 |
| completedOrders | 2 | A, B thanh toán ngày 17 |
| cancelledOrders | 1 | C |
| averageOrderValue | 150.000đ | 300.000 / 2 |
| activeOrders | 2 | D, E |
| activeTables | 1 | Bàn 05 chỉ đếm một lần |

| Top món | Số lượng | Doanh thu snapshot |
|---|---:|---:|
| 1. Cà phê sữa | 6 ly | 150.000đ |
| 2. Trà đào | 2 ly | 100.000đ |
| 3. Bạc xỉu | 1 ly | 50.000đ |

Tổng doanh thu món = **300.000đ = revenue**. Biểu đồ giờ 00 có 200.000đ, giờ 11 có 100.000đ; 22 giờ còn lại bằng 0.

Khi xem **16/09**: revenue=0đ, totalOrders=1 (B), completedOrders=0, averageOrderValue=0. Tình trạng hiện tại vẫn activeOrders=2, activeTables=1.

Ba kết quả sai bộ dữ liệu này bắt được:

- Revenue hôm nay 100.000đ: đã lọc/group theo UTC, đẩy B về ngày 16.
- Cà phê sữa 180.000đ: đã lấy giá Product hiện tại 30.000đ thay snapshot 25.000đ.
- Revenue 800.000đ: đã cộng cả C cancelled.

Fixture ở `server/tests/dashboardFixture.js`. Test tự tạo trong database riêng, có now cố định và tự dọn sau khi xong; không seed/backfill A–E vào database thật. Giao diện dùng dữ liệu thật của quán sau khi kiểm thử kết thúc.

## 13. Kết quả kiểm thử

- **211/211 backend test đạt**, 0 fail/skipped/cancelled: giữ nguyên 157 test cũ + 54 test mới.
- Backend kiểm tra quyền ở cả bốn API, đủ trạng thái doanh thu, paidAt/createdAt, ranh giới ngày VN, from=to/366 ngày/validation, snapshot đổi tên/giá/xóa món, gộp productId, tie-break tên, activeOrders/bàn, recent, dữ liệu rỗng, dataWarnings, check:data chỉ đọc và explain.
- **Frontend build thành công**; dashboard/chart tách thành gói tải riêng, không còn cảnh báo bundle vượt 500KB.
- **Chrome dashboard đạt**: admin/staff, số liệu tính tay, các bộ lọc, biểu đồ/Top/recent, rỗng, API lỗi/thử lại, debounce 40 event, tab ẩn/hiện, kỳ cũ bỏ qua event, reconnect, API vẫn dùng khi socket tắt, cảnh báo, response cũ không ghi đè, chuyển trang không nhân listener.
- **Ba script Chrome cũ giai đoạn 5, 6, 7 đều chạy lại thành công**, giữ nguyên: giỏ/chống trùng/token, vận hành đơn/bàn/409 và realtime nhiều phiên.
- **375px không tràn ngang**, không lỗi JavaScript chưa xử lý trong các luồng thử. Ảnh: `/private/tmp/restaurant-qr-stage8-dashboard-mobile.png`. Chưa kiểm tra bằng điện thoại vật lý.

Kiểm thử dashboard dùng Chrome thật, frontend thử cổng 5175, HTTP server thử cổng ngẫu nhiên, database riêng `restaurant_qr_dashboard_browser_<random>`, đồng hồ thống kê cố định. Không sửa `.env` hoặc dừng frontend/backend hiện có. Page Visibility được mô phỏng qua thuộc tính/sự kiện visibilitychange; ngắt riêng socket để kiểm tra API dự phòng. Phản hồi cũ được giữ ở tầng mạng Chrome rồi trả muộn, không sửa assertion để che lỗi ứng dụng.

## 14. Các file nên đọc

| File | Nội dung |
|---|---|
| `server/src/utils/dashboardRange.js` | Kiểm tra query, tính khoảng VN/UTC, tạo các mốc trống |
| `server/src/services/dashboardService.js` | Tổng hợp summary, doanh thu, món, đơn gần đây |
| `server/src/controllers/dashboardController.js` | Truyền now, nhận/trả HTTP |
| `server/src/routes/dashboardRoutes.js` | Bốn route và bảo vệ quyền admin |
| `server/src/app.js` | Gắn router; cho test truyền đồng hồ dashboard, không qua query frontend |
| `server/src/models/Order.js` | Thêm đúng một index status + paidAt |
| `server/scripts/checkData.js` | Kiểm tra dữ liệu chỉ đọc trước triển khai |
| `server/scripts/explainDashboard.js` | Đọc kế hoạch query, không sửa index |
| `client/src/api/dashboardApi.js` | Gọi bốn API bằng Axios, cùng AbortSignal |
| `client/src/hooks/useDashboard.js` | Tải/hủy request, lỗi, debounce, tab visible và reconnect |
| `client/src/pages/admin/DashboardPage.jsx` | Bộ lọc, thẻ số liệu, Top món, đơn gần đây |
| `client/src/components/RevenueChart.jsx` | Biểu đồ Chart.js và cleanup |
| `server/tests/dashboard.test.js` | 54 kiểm thử với giờ cố định |
| `server/tests/dashboardFixture.js` | Dữ liệu A–E dùng chung cho test |
| `server/tests-browser/dashboard.mjs` | Chrome thật, database/server/frontend thử độc lập |

## 15. Chạy và tự demo

Không thêm biến `.env`, không thay secret. Cài lại dependencies khi lấy source mới:

```bash
npm --prefix client ci
npm --prefix server ci
npm --prefix server run check:data
```

Nếu check:data báo lỗi dữ liệu: dừng và quyết định xử lý dữ liệu trước; không tự sửa ngày/tiền.

Chạy như cũ, không mở thêm tiến trình trùng cổng nếu đã chạy:

```bash
docker compose up -d mongodb
# Terminal backend
npm --prefix server run dev
# Terminal frontend khác
npm --prefix client run dev
```

Demo tại **http://localhost:5174**:

1. Đăng nhập admin; bấm Dashboard hoặc mở `/admin/dashboard`.
2. Nếu chưa có order, các chỉ số bằng 0, biểu đồ vẫn đủ mốc, có thông báo rỗng.
3. Mở QR bằng cửa sổ khách, đặt đơn. Dashboard Hôm nay tăng tổng đơn/đơn đang xử lý; doanh thu chưa tăng.
4. Staff xử lý đủ confirmed → preparing → served. Doanh thu vẫn chưa tăng.
5. Xác nhận đã nhận tiền, hoàn thành đơn. Dashboard tự tăng doanh thu, completedOrders và số món bán. Bàn chỉ trống nếu không còn đơn khác.
6. Tạo đơn thứ hai rồi hủy hợp lệ: cancelledOrders tăng, doanh thu không cộng đơn hủy.
7. Đổi giá/tên món ở Product; quay lại kỳ có đơn cũ: tiền/tên snapshot vẫn đúng.
8. Thử 7 ngày, 30 ngày, tháng hiện tại và một tháng chưa có dữ liệu.
9. Đăng nhập staff ở phiên riêng, mở `/admin/dashboard`: bị từ chối. API cũng không cấp quyền doanh thu.
10. Ngắt kết nối socket hoặc mạng, thử Làm mới số liệu khi API truy cập được; nối lại để thấy dữ liệu mới. Tab ẩn sẽ chờ khi hiện lại mới tải thống kê.

Tái hiện chính xác bộ A–E và now cố định bằng các test, không phụ thuộc ngày máy đang chạy:

```bash
npm --prefix server test
npm --prefix client run build
npm --prefix server run explain:dashboard
```

Mở Chrome kiểm thử riêng theo [giai đoạn 7](GIAI_DOAN_7.md), rồi:

```bash
npm --prefix server run test:browser:dashboard
```

Script tự chạy/dừng server/frontend thử và dọn database riêng; cần MongoDB, Chrome debug cổng 9224 và cổng 5175 trống. Không chạy đồng thời hai bản script dashboard. `CHROME_DEBUG_URL` có thể thay địa chỉ debug. Dừng Chrome kiểm thử sau khi xong.

Không triển khai kho, chi phí/lợi nhuận/thuế/giảm giá, thanh toán online, nhiều chi nhánh, dự đoán, export Excel/PDF hoặc dịch vụ mới. Dashboard phản ánh doanh thu được nhân viên xác nhận theo nghiệp vụ hiện có.
