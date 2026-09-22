# Giai đoạn 9 — Đối chiếu bản cuối và tài liệu bảo vệ

## Phạm vi và bằng chứng hiện có

Ngày đối chiếu: **18/09/2026**. Lượt này là **9C — chỉ viết tài liệu**, không sửa code, cấu hình chạy, dependency, test hoặc bản ghi nghiệp vụ trong DB chính. Chức năng giữ nguyên.

Người dùng thông báo 9A/9B đã hoàn thành. Tuy nhiên, khi bắt đầu lượt này, workspace chỉ có README, bản thiết kế và GIAI_DOAN_1.md đến GIAI_DOAN_8.md; **chưa có GIAI_DOAN_9.md hoặc tài liệu triển khai 9B**. [server/package.json](server/package.json) cũng chưa có `reset:demo` và `seed:demo`. Đã hỏi vị trí bản 9A/9B; chỉ nhận chỉ dẫn tiếp tục, nên viết theo source đang có và ghi nhận chênh lệch. File này được tạo mới ở 9C, không phải phục hồi một báo cáo 9A/9B đã đọc.

Không xác nhận thay cho người dùng rằng bản deploy, quy trình reset/seed, điện thoại thật hoặc kiểm thử 9A/9B đã hoàn tất. Nếu bản cuối nằm ở thư mục khác, cần đối chiếu lại trước khi dùng tài liệu này làm báo cáo nộp chính thức. Hướng dẫn local/LAN đã kiểm tra với script/config hiện có; chưa thể kiểm tra mâu thuẫn với một tài liệu 9B chưa được cung cấp.

## 9C — Tài liệu bảo vệ

### Đã đọc và đã viết

Đã đọc các file ứng dụng tự viết trong `client/src`, `server/src`; config/package và file môi trường mẫu; script kiểm tra/tạo tài khoản; sáu bộ test backend, fixture dashboard và bốn script kiểm thử Chrome. Đã đọc README, bản phân tích và tài liệu giai đoạn 1–8. Không đọc mã dependency được tải về hoặc secret trong `.env` để đưa vào tài liệu.

| Tài liệu | Công việc |
|---|---|
| [BAO_VE_KHOA_LUAN.md](BAO_VE_KHOA_LUAN.md) — mới | Bài trình bày, kỹ thuật dẫn code, checklist trước demo, 16 bước chính 5–8 phút, bốn ca phụ, bốn phương án dự phòng, 28 Q&A, sáu sơ đồ Mermaid, giới hạn/hướng phát triển và việc người dùng tự làm |
| [PHAN_TICH_VA_THIET_KE_HE_THONG.md](PHAN_TICH_VA_THIET_KE_HE_THONG.md) — cập nhật | Sửa API/route/chức năng theo code; ghi rõ phần chưa có, giỏ hiện tại, kiểm tra dữ liệu và bảng nguồn file/hàm |
| [README.md](README.md) — cập nhật | Điều hướng tài liệu 9C, hướng dẫn chạy theo script hiện có, không giả định tài khoản/mật khẩu demo, logout hiện tại, kết quả test/build và chuẩn bị dữ liệu thủ công |
| [GIAI_DOAN_9.md](GIAI_DOAN_9.md) — mới | Phạm vi đối chiếu, mâu thuẫn với lịch sử, phát hiện khi đọc và bằng chứng kiểm tra |

GIAI_DOAN_1–8 được giữ nguyên như nhật ký lịch sử; bảng dưới đây giải thích những chỗ không được đọc thành mô tả bản hiện tại. Không đổi số test cũ thành số mới hoặc viết lại lịch sử như thể các chức năng đã có từ đầu.

### Mâu thuẫn và điểm đã thay đổi so với tài liệu cũ

| Tài liệu/chỗ cũ | Điều cần đính chính theo code cuối | Xử lý trong tài liệu 9C và căn cứ |
|---|---|---|
| GIAI_DOAN_1 mục 2, 5–7: admin quản lý nhân viên, `/admin/users` dự kiến; giai đoạn 6–8 còn ở lộ trình | Đơn, realtime và dashboard đã có; UI/API quản lý nhân viên vẫn chưa có | Ghi phạm vi thật ở README/BAO_VE; bản thiết kế bỏ route khỏi danh sách đã triển khai. [AppRoutes.jsx](client/src/routes/AppRoutes.jsx), [app.js](server/src/app.js), [createUser.js](server/scripts/createUser.js) |
| GIAI_DOAN_2 và GIAI_DOAN_3 phần mở đầu nói code “hiện tại” đến giai đoạn 5, tổng 65 test | Đây là mốc khi tách tài liệu cũ, không phải số cuối 9C | README nêu tài liệu lịch sử; lượt này chạy lại 211 test. Danh sách lệnh: [server/package.json](server/package.json) |
| GIAI_DOAN_3 mục 2 nói đã có admin/mật khẩu ở `.env` trên máy; README cũng có câu này | Không bảo đảm mọi máy có tài khoản đó; lượt này không xác minh mật khẩu riêng | README bỏ khẳng định tài khoản/mật khẩu hiện có; hướng dẫn tạo khi còn thiếu qua `createInternalUser` tại [userService.js](server/src/services/userService.js) |
| GIAI_DOAN_3 mô tả logout ở trình duyệt và chưa có API logout | Từ giai đoạn 7 có POST logout ngắt socket theo user; vẫn chưa thu hồi JWT bị sao chép | README thêm API và giới hạn đúng. `logout` ở [authController.js](server/src/controllers/authController.js), [AuthContext.jsx](client/src/contexts/AuthContext.jsx) |
| GIAI_DOAN_4 mục 1, 7: cả 10 API quản trị chỉ admin, staff đều 403, gồm GET tables | Từ giai đoạn 6 staff/admin cùng đọc GET `/api/tables`; ghi bàn và xem QR vẫn chỉ admin | Bản thiết kế/BAO_VE phân biệt đọc và quản lý. [catalogRoutes.js](server/src/routes/catalogRoutes.js), `listTables` ở [tableController.js](server/src/controllers/tableController.js) |
| GIAI_DOAN_4 mục menu: nút Xem chi tiết, chưa giỏ/order; tên trong sessionStorage | Từ giai đoạn 5 có thêm giỏ; tên/giỏ/danh sách token đơn trong localStorage theo QR, có đọc tên sessionStorage cũ để chuyển tiếp | Bản thiết kế ghi đã triển khai, không viết “có thể lưu”. [CustomerMenuPage.jsx](client/src/pages/customer/CustomerMenuPage.jsx), [CartContext.jsx](client/src/contexts/CartContext.jsx), `readCart` ở [guestStorage.js](client/src/utils/guestStorage.js) |
| GIAI_DOAN_4 nói chưa tính tình trạng bàn | Hiện tính từ các order đang xử lý; không thêm field status cho Table | Làm rõ phạm vi hiện tại, không xóa ghi chép giai đoạn cũ. [Table.js](server/src/models/Table.js), `listTables` ở [tableController.js](server/src/controllers/tableController.js) |
| GIAI_DOAN_5 chỉ tạo pending, chưa xử lý đơn/paidAt/hủy/realtime | Giai đoạn 6 có workflow, lịch sử, paidAt và hủy; giai đoạn 7 có thông báo | Tổng hợp hiện tại ở BAO_VE phần 6–7. [Order.js](server/src/models/Order.js), [orderWorkflowService.js](server/src/services/orderWorkflowService.js), [notifications.js](server/src/sockets/notifications.js) |
| GIAI_DOAN_6 mục 12 nói phải bấm làm mới, không tự cập nhật | Từ giai đoạn 7 có realtime, nút làm mới chỉ là phương án dự phòng | Kịch bản 9C giữ khách mở trang để thấy cập nhật. [OrderPage.jsx](client/src/pages/customer/OrderPage.jsx), [useRealtimeRefresh.js](client/src/realtime/useRealtimeRefresh.js) |
| GIAI_DOAN_6 mục 12 bước 9 giả định staff B vẫn nhìn pending sau khi A xác nhận | Với realtime đang chạy, B có thể được tải lại trước khi bấm nên không chắc tạo được 409 | Kịch bản phụ 9C yêu cầu gửi lại PATCH có expectedStatus cũ; giải thích đây là dữ liệu cũ có chủ đích. [OrderDetailPage.jsx](client/src/pages/staff/OrderDetailPage.jsx), `changeOrderStatus` ở [orderWorkflowService.js](server/src/services/orderWorkflowService.js) |
| GIAI_DOAN_7: giai đoạn chưa dashboard, refetch thường 300ms; 157 test | Giai đoạn 8 có dashboard riêng, debounce 1,5s, lọc thời gian và tab ẩn; cuối 211 test | BAO_VE tách hành vi dashboard khỏi các trang khác. [useDashboard.js](client/src/hooks/useDashboard.js), [useRealtimeRefresh.js](client/src/realtime/useRealtimeRefresh.js) |
| GIAI_DOAN_8 phần 2 có luồng period/from/to, dễ hiểu rằng cả UI đều có | API có from/to, UI hiện có preset và chọn tháng, chưa có form from/to | Bổ sung vào bản thiết kế và BAO_VE. [DashboardPage.jsx](client/src/pages/admin/DashboardPage.jsx), [dashboardRange.js](server/src/utils/dashboardRange.js) |
| Số test/bundle/375px trong các GIAI_DOAN cũ | Là kết quả tại lần kiểm tra đó; không tự xem là vừa chạy lại | Giữ số cũ, ghi riêng bảng thực đo 9C bên dưới; chưa chạy lại Chrome/điện thoại ở lượt này |
| Bản thiết kế mục 3.1, 4.6, 5.3, lộ trình 8b viết API tạo nhân viên/đổi/reset mật khẩu và `/admin/users` như chức năng cần có | Chưa có những API/màn hình này; CLI tạo được cả admin/staff | Đã sửa trực tiếp bản thiết kế, chuyển sang “chưa triển khai”; nguồn [authRoutes.js](server/src/routes/authRoutes.js), [userService.js](server/src/services/userService.js) |
| Bản thiết kế API public products ghi lọc theo tên món | Code chỉ nhận lọc categoryId, chưa có tìm tên món | Đã sửa mô tả API. `listPublicProducts` ở [publicMenuController.js](server/src/controllers/publicMenuController.js) |
| Bản thiết kế nói chung đơn cũ thiếu trường mới không cần sửa, dễ áp dụng cả completed thiếu paidAt | Pending cũ xử lý được; completed thiếu paidAt hợp lệ phải báo data integrity, không tự thay bằng mốc khác | Đã thu hẹp mô tả, dẫn [checkData.js](server/scripts/checkData.js), `dashboardSummary` ở [dashboardService.js](server/src/services/dashboardService.js) |
| Yêu cầu 9C giả định có reset:demo/seed:demo và tài liệu 9B | Không tìm thấy trong workspace; không thể đối chiếu hoặc chạy lệnh chưa có | Ghi rõ ở đầu cả bốn tài liệu; không sửa code để bổ sung. [server/package.json](server/package.json), [compose.yaml](compose.yaml) |

Không tìm thấy căn cứ trong các tài liệu hiện có để khẳng định từng triển khai app nhân viên cài riêng. Code hiện tại là **web `/staff/*`**, thể hiện trong [AppRoutes.jsx](client/src/routes/AppRoutes.jsx); không đưa ví dụ “app → web” thành một mâu thuẫn lịch sử đã xác nhận.

### Phát hiện khi viết tài liệu

**Chưa xác nhận bug nghiệp vụ ứng dụng mới trong lượt đọc này; không sửa code.** Backend test đều đạt không có nghĩa đã chứng minh không còn mọi lỗi. Có các điểm cần người dùng biết:

1. **Rủi ro test trình duyệt phụ thuộc thời điểm — chưa tái hiện lỗi ở 9C.** [workflow.mjs](server/tests-browser/workflow.mjs) phần sau `const conflict` (khoảng dòng 332–349) cập nhật bằng API ở nhân viên khác rồi giả định UI vẫn pending để bấm nút cũ. Khi realtime cập nhật nhanh, nút có thể đã đổi; phần kiểm tra khách trước “Làm mới trạng thái” (khoảng dòng 381–399) cũng giả định chưa tự cập nhật. Đây là giả định kiểm thử cũ có thể không ổn định, chưa phải bằng chứng workflow sai. Ghi nhận để kiểm tra ở một lượt cho phép sửa test; **không sửa test hoặc tắt realtime trong lượt tài liệu**. Bộ [realtime.mjs](server/tests-browser/realtime.mjs) có kịch bản chủ động ngắt socket để kiểm tra dữ liệu cũ.
2. **Phạm vi dữ liệu public cần diễn đạt chính xác.** `getPublicOrder` tại [publicOrderController.js](server/src/controllers/publicOrderController.js) trả `statusHistory`, trong đó còn ID `changedBy`; [OrderSummary.jsx](client/src/components/OrderSummary.jsx) không hiển thị tên tài khoản cho khách. Chưa coi đây là bug vượt quyền đã xác nhận vì vẫn cần trackingToken và yêu cầu trước không cấm trường ID này. Tuy nhiên không được nói API public hoàn toàn không có định danh nội bộ; có thể xem xét giảm dữ liệu trả về ở một lượt khác.
3. **Thiếu thành phần 9A/9B so với tiền đề yêu cầu:** chưa có reset/seed demo hoặc tài liệu deploy để kiểm tra. Đây là thiếu bằng chứng/source trong thư mục hiện tại, không kết luận bản 9A/9B ở nơi khác bị lỗi. Chưa tạo code hoặc tự xóa/tạo dữ liệu để bù thiếu.

### Kết quả kiểm tra thực tế của lượt 9C

Môi trường chạy lệnh: Node.js **v26.7.0**, npm **11.19.0**. Các số dưới đây được lấy từ output chạy trong lượt 9C; lệnh chạy trong thư mục tương ứng, không cộng thêm số từ tài liệu lịch sử.

**Backend**, `npm test` tại `server` (tương đương `npm --prefix server test` từ gốc):

```text
# tests 211
# suites 6
# pass 211
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4904.219417
```

| File test | Số test | Nhóm được kiểm tra |
|---|---:|---|
| [auth.test.js](server/tests/auth.test.js) | 12 | Login, bcrypt/JWT, input, vai trò, khóa tài khoản, giới hạn thử mật khẩu |
| [catalog.test.js](server/tests/catalog.test.js) | 17 | Danh mục/món/bàn/QR, ẩn/hết món, quyền và validation |
| [orders.test.js](server/tests/orders.test.js) | 36 | Tạo đơn, giá thật/snapshot, trackingToken, requestId/retry và chống trùng |
| [orderWorkflow.test.js](server/tests/orderWorkflow.test.js) | 62 | Luồng trạng thái, hủy, paidAt/lịch sử, conflict, phân trang/lọc, bàn |
| [realtime.test.js](server/tests/realtime.test.js) | 30 | JWT/room/token, event, không phát khi lỗi/replay, reconnect, khóa tài khoản, lỗi emit |
| [dashboard.test.js](server/tests/dashboard.test.js) | 54 | Quyền, tiền/thời gian/giờ VN, snapshot, A–E, nhóm món, warning và input |

Các test dùng dữ liệu kiểm thử và dọn dữ liệu của mình; không chạy script reset DB chính. Test mô phỏng lỗi emit cố ý có cảnh báo chung nhưng kết quả test vẫn đạt; không nhầm cảnh báo này với lỗi test bị bỏ qua. Nguồn chạy: [server/package.json](server/package.json), [realtime.test.js](server/tests/realtime.test.js).

**Frontend**, `npm run build` tại `client`:

```text
vite v8.3.0 building client environment for production...
235 modules transformed.
dist/index.html                          0.47 kB | gzip: 0.32 kB
dist/assets/index-DYCij2h3.css           25.73 kB | gzip: 5.73 kB
dist/assets/DashboardPage-MbAJgToy.js   160.76 kB | gzip: 56.01 kB
dist/assets/index-M4rfVXFa.js           424.97 kB | gzip: 131.13 kB
built in 133ms
```

Build thành công. Bảng trên chép các số và tên file Vite báo, bỏ ký hiệu màu/trang trí; kB theo output build, không phải kích thước toàn thư mục node_modules hay toàn bộ dữ liệu tải qua mạng. Chưa thêm hoặc đổi thư viện. Nguồn build: [client/package.json](client/package.json), [vite.config.js](client/vite.config.js).

**Kiểm tra dữ liệu chỉ đọc**, `npm run check:data` tại `server`:

| Chỉ số | Kết quả |
|---|---:|
| Database | restaurant_qr |
| ordersChecked | 0 |
| itemsChecked | 0 |
| completedWithoutPaidAt | 0 |
| itemsWithWrongLineTotal | 0 |
| ordersWithWrongTotal | 0 |
| itemsWithoutProductId | 0 |
| passed | true |

Tên bốn chỉ số khớp khóa `counters` trong output; xem cách kiểm tra tại [checkData.js](server/scripts/checkData.js). Kết quả không có lỗi trên **DB không có order**, chưa chứng minh dữ liệu demo đã sẵn sàng. Không seed hoặc backfill DB chính trong lượt này.

**Explain chỉ đọc**, `npm run explain:dashboard` tại `server`: query doanh thu dùng **IXSCAN** với `status_1_paidAt_1`; query số đơn dùng **IXSCAN** với `createdAt_-1__id_-1`. Cả hai có nReturned=0, totalKeysExamined=0, totalDocsExamined=0 vì DB đang trống. Không thêm index hoặc lấy kết quả này làm cam kết hiệu năng trên dữ liệu lớn. Nguồn: [explainDashboard.js](server/scripts/explainDashboard.js), index tại [Order.js](server/src/models/Order.js).

**Kiểm tra tính tay:** test bộ A–E chạy lại trong suite dashboard đạt: ngày 17/09 doanh thu 300.000đ, số đơn tạo 4, completed 2, cancelled 1, trung bình 150.000đ, activeOrders 2, activeTables 1; Top cà phê 6/150.000đ, trà đào 2/100.000đ, bạc xỉu 1/50.000đ. Ngày 16/09 doanh thu 0, totalOrders 1, completedOrders 0. Bộ đầy đủ và ba lỗi dễ mắc nằm trong BAO_VE phần 9. Nguồn: `seedDashboardExample` tại [dashboardFixture.js](server/tests/dashboardFixture.js), [dashboard.test.js](server/tests/dashboard.test.js). Fixture này chỉ phục vụ kiểm thử, không phải script seed demo.

**Giới hạn của lần kiểm chứng:** chưa chạy lại bốn script Chrome hoặc thử Android/iOS thật trong 9C; số liệu 375px/realtime trình duyệt ở giai đoạn 6–8 là lịch sử. Không gọi build thành công là đã kiểm tra toàn bộ tương tác UI. Mã Mermaid được chuẩn bị trong tài liệu, chưa tạo ảnh; cần mở trong trình soạn thảo hỗ trợ Mermaid trước khi đưa vào slide.

### Cách chạy và demo

Hướng dẫn cài dependency, cấu hình môi trường, MongoDB, tạo tài khoản và chạy hai tiến trình nằm ở README mục 4–6, 11 và 16. Lệnh có thật được đối chiếu với [client/package.json](client/package.json), [server/package.json](server/package.json), [compose.yaml](compose.yaml). Không đổi secret trong source hoặc copy đè `.env` đang dùng.

Tóm tắt demo: admin mở menu/bàn/QR → điện thoại nhập tên, chọn hai món và ghi “ít đá” → gửi đơn → staff nhận thông báo → confirmed → preparing → served → xác nhận đã nhận tiền/completed → khách thấy cập nhật → dashboard tăng đúng tiền → Bàn 05 trống nếu không còn đơn khác. Chi tiết người thao tác, màn hình, kết quả và câu nói nằm ở BAO_VE phần 10.

Bắt buộc người dùng tự thử mạng tại phòng, điện thoại thật, tập có bấm giờ, quay video dự phòng và kiểm tra dữ liệu/tài khoản trước demo. Không in QR dựa trên IP cũ, không coi các script reset/seed chưa có là bước đã hoàn thành.


### Kiểm tra cuối tài liệu và phạm vi thay đổi

- Đã kiểm tra **92 đích liên kết local duy nhất** trong bốn tài liệu: tất cả tồn tại; không có đường dẫn local bị hỏng. Đã đối chiếu tên hàm được dẫn với khai báo trong file source, gồm cả hàm nằm bên trong component/service.
- BAO_VE có **28 Q&A đánh số 1–28**, mỗi câu có liên kết code; **6 khối Mermaid**, không tạo ảnh. Kiểm tra cấu trúc sơ đồ và tên trường theo schema; chưa chạy trình render Mermaid.
- So sánh SHA-256 với bản chụp trước khi viết: **138 file ngoài Markdown không đổi**, không thêm file ngoài Markdown vào source. Bản so sánh loại trừ `.env`, dependency, thư mục build và metadata công cụ; build chỉ sinh lại sản phẩm trong `client/dist`.
- Chỉ tạo/sửa bốn tài liệu đã liệt kê; không sửa test để đạt, không sửa các phát hiện/rủi ro code và không mở thêm phạm vi chức năng. Không cần chạy lại cùng bộ test chỉ vì chỉnh câu chữ Markdown sau lần chạy đã báo ở trên.

---

# GIAI ĐOẠN 9A — Rà soát và kiểm thử bản hiện tại

Ngày hoàn tất lượt kiểm tra: **20/09/2026**. Phần 9C bên trên và BAO_VE_KHOA_LUAN.md giữ nguyên. Không thực hiện 9B, mobile LAN, seed/reset dữ liệu demo, deploy hay backup/restore.

Quy ước bằng chứng trong phần này:

- **[TEST TỰ ĐỘNG]**: đã thực thi test có assertion kiểm tra kết quả; nêu rõ test nằm trong repo hay script kiểm thử tạm do tool chạy.
- **[TOOL CHẠY THỦ CÔNG — …]**: ghi chính xác thao tác, ví dụ đọc source, chạy build, explain, quét cấu hình hoặc xem ảnh chụp. Đọc source không được hiểu là đã thử chức năng lúc chạy.
- **[CHƯA KIỂM TRA — Henry cần làm]**: chưa có bằng chứng thực thi cho phần đó, không nhận là đã đạt.

## A. Git checkpoint

**[TOOL CHẠY THỦ CÔNG — chạy Git và kiểm tra thư mục]** Đã gọi `git status`, `git log -1 --oneline`, `git tag --list giai-doan-8` trước khi sửa; thử lại khi tiếp tục ngày 20/09 vẫn nhận exit 69 do Git hệ thống yêu cầu chấp nhận giấy phép Xcode. Không tự chấp nhận giấy phép. Không có `.git` ở project hoặc các thư mục cha, cũng không tìm thấy Git thay thế ở hai đường dẫn Homebrew thông dụng.

**[CHƯA KIỂM TRA — Henry cần làm]** Chưa xác định được working tree, commit cuối hoặc tag bằng Git. Vì vậy không tuyên bố working tree sạch, không tạo `giai-doan-8`, không commit/stash/reset/discard, không force/xóa/di chuyển tag. Theo chỉ dẫn tiếp theo của Henry: **không tạo tag giai-doan-8 bây giờ**, vì source đã qua 9A. Cần làm Git hoạt động và xác định repo trước; checkpoint mới nếu được thiết lập phải phản ánh baseline sau 9A (giai-doan-9a), không giả lập mốc giai đoạn 8. Lượt sửa response public chưa init/commit/tag.

**[TOOL CHẠY THỦ CÔNG — chụp SHA-256 trước/sau]** Thay cho việc đoán trạng thái Git, đã chụp 150 file source/tài liệu/config trước lượt 9A, loại trừ `.env`, dependency, build và metadata công cụ. Những file thay đổi trong chính lượt này:

| File | Thay đổi và lý do |
|---|---|
| [server/src/middlewares/errorHandler.js](server/src/middlewares/errorHandler.js) | Sửa `errorHandler`: lỗi kết nối MongoDB và timeout bộ đệm Mongoose trả 503 với thông báo chung; lỗi lập trình không bị đổi thành 503 |
| [server/src/config/database.js](server/src/config/database.js) | Thêm listener mất kết nối/kết nối lại/lỗi kết nối; chỉ log câu cố định, không log URI hoặc đối tượng lỗi |
| [server/tests/productionErrors.test.js](server/tests/productionErrors.test.js) — mới | 19 test lỗi production, health và đầu vào; không sửa các test cũ |
| [GIAI_DOAN_9.md](GIAI_DOAN_9.md) | Chỉ nối thêm phần 9A này, giữ nguyên toàn bộ nội dung 9C |

**[TOOL CHẠY THỦ CÔNG — đối chiếu phạm vi sửa]** Không đổi schema, request/success-response API, dependency hoặc kiến trúc. Chuyển lỗi DB 500 thành 503 thực hiện đúng yêu cầu sự cố mục A của 9A. Vấn đề này sửa hai file runtime và thêm một file test, không vượt giới hạn năm file. Không sửa BAO_VE_KHOA_LUAN.md, README hoặc tài liệu thiết kế trong lượt này.

## B. Luồng nghiệp vụ và thử sự cố

**[TEST TỰ ĐỘNG]** Toàn bộ 211 test cũ tiếp tục đạt trong tổng 230 test hiện tại. Ngoài backend, đã chạy lại bốn script Chrome bằng trình duyệt thật ở chế độ headless; các script tạo bản ghi kiểm thử riêng, chỉ dọn bản ghi của mình. Đây không phải seed/reset dữ liệu demo.

| Bộ thực thi | Kết quả và phạm vi |
|---|---|
| `npm run test:browser:orders` — [orders.mjs](server/tests-browser/orders.mjs) | Exit 0: tên/giỏ/ghi chú, hai QR tách giỏ, hết món, lỗi mạng, mất phản hồi sau khi lưu, retry/bấm đôi, lưu token, giá DB, đơn khách |
| `npm run test:browser:workflow` — [workflow.mjs](server/tests-browser/workflow.mjs) | Exit 0: login staff, bốn bước, hủy, checkbox nhận tiền, lịch sử, bàn nhiều đơn, 409, lỗi API, phân trang/lọc, admin dùng chung UI |
| `npm run test:browser:realtime` — [realtime.mjs](server/tests-browser/realtime.mjs) | Exit 0: bốn context trình duyệt, tạo/cập nhật/hủy, bàn, reconnect/ACK/refetch, API khi socket tắt, khóa/logout, không nhân listener |
| `npm run test:browser:dashboard` — [dashboard.mjs](server/tests-browser/dashboard.mjs) | Exit 0: A–E, quyền admin, bộ lọc, rỗng/lỗi/thử lại, debounce, tab ẩn, socket tắt, phản hồi cũ, warnings, 375px |

**[TEST TỰ ĐỘNG]** Kịch bản sự cố chạy bằng script tạm `/private/tmp/restaurant-9a-outage.mjs`, dùng một MongoDB Docker và tiến trình Node **riêng**, không dừng DB/Node chính. Backend thử chạy với NODE_ENV=production; token/mật khẩu fixture được tạo ngẫu nhiên, không đưa vào báo cáo.

| Sự cố | Kết quả thực thi |
|---|---|
| Tắt MongoDB khi Node đang chạy, trước sửa | Health 503/disconnected; GET public categories **500**, Node vẫn sống. Đây là bug đã tái hiện |
| Tắt MongoDB sau sửa | Health **503/disconnected** và categories **503**, Node không crash |
| Bật MongoDB trở lại | Cùng tiến trình Node trả health và categories 200, không cần restart Node |
| Restart tiến trình Node khi DB đang chạy | Đơn cũ và tổng 35.000đ vẫn đọc được; client socket kết nối hai lần, nhận hai ACK join và thực hiện hai lần GET sau ACK; nhận được event confirmed sau reconnect |
| Ngắt client socket | POST order 201, PATCH trạng thái 200, dashboard summary 200 vẫn hoạt động |
| Theo dõi log tiến trình thử | Có log mất/kết nối lại MongoDB; không có secret, mật khẩu, JWT hoặc trackingToken thử nghiệm trong log thu được |

**[TOOL CHẠY THỦ CÔNG — chẩn đoán môi trường thử]** Lần thử đầu bị sandbox chặn localhost (`EPERM`), đã chạy lại với quyền kết nối thích hợp; không tính lần lỗi môi trường là test đạt. MongoDB tạm ban đầu dùng tmpfs nên dữ liệu fixture mất qua stop/start; đã đổi **môi trường kiểm thử tạm** sang storage giữ qua stop/start rồi thực hiện lại đầy đủ. Không sửa nghiệp vụ hoặc nới assertion để bỏ qua sự cố đó. Chrome cũ có profile/cổng không còn khả dụng; đã dùng Chrome riêng do script quản lý vòng đời, không sửa app để giải quyết lỗi công cụ.

**[CHƯA KIỂM TRA — Henry cần làm]** Kịch bản restart Node dùng Socket.IO client tự động thật, không phải thao tác restart rồi quan sát bằng điện thoại vật lý. Chrome đã thử mất kết nối/reconnect riêng; cần thử thiết bị thật khi chuẩn bị bảo vệ. Không thực hiện mobile LAN trong 9A.

## C. Accessibility cơ bản

**[TEST TỰ ĐỘNG]** Script tạm `/private/tmp/restaurant-9a-accessibility.mjs` điều khiển Chrome bằng DevTools Protocol, chạy thành công sau khi hoàn thiện sự kiện phím Enter của bộ điều khiển. Không thay code ứng dụng. Đã lấy DOM và thao tác trên 16 màn hình/trạng thái: nhập tên, menu, chi tiết món, giỏ, đơn khách, login staff/admin, danh sách/chi tiết đơn, form hủy, bàn staff, admin danh mục/món/bàn/dashboard và lỗi login.

| Nội dung | Bằng chứng thực thi |
|---|---|
| Button thật | Các nút được lấy từ DOM là button có tên; không thấy phần tử giả `role=button` trong các màn hình được lấy mẫu |
| Input có label | Không có input/select/textarea đang hiện thiếu label hoặc accessible name trong mẫu |
| Ảnh có alt | Ảnh thật ở menu/chi tiết/giỏ có thuộc tính alt; ProductImage dự phòng có role/aria-label |
| Bàn phím | Tab/Enter thực hiện login staff/admin, nhập tên, mở món, nhập ghi chú, thêm giỏ, gửi đơn; staff xác nhận và hủy bằng bàn phím |
| Focus | Nút login được Tab tới có outline khác none, độ dày lớn hơn 0 |
| Lỗi không chỉ bằng màu | Login sai có chữ thông báo trong `role=alert` |
| Chữ quan trọng | Đo mẫu h1, label, nút chính và thông báo lỗi từ màu computed CSS; tỷ lệ tương phản nhỏ nhất trong mẫu là 6,42:1 |
| 375px | DOM không có chiều rộng nội dung vượt viewport trên các trang được thử |

Nguồn giao diện: [FormField.jsx](client/src/components/FormField.jsx), [ProductImage.jsx](client/src/components/ProductImage.jsx), [Modal.jsx](client/src/components/Modal.jsx), [index.css](client/src/index.css), [LoginPage.jsx](client/src/pages/auth/LoginPage.jsx), [CartPage.jsx](client/src/pages/customer/CartPage.jsx), [OrderDetailPage.jsx](client/src/pages/staff/OrderDetailPage.jsx).

**[TOOL CHẠY THỦ CÔNG — xem ảnh chụp]** Đã mở ảnh Chrome dashboard 375px ở `/private/tmp/restaurant-9a-dashboard-375.png`: phần điều hướng, trạng thái kết nối và bộ lọc xuống dòng gọn, chữ đọc được, không thấy tràn ngang trong ảnh.

**[CHƯA KIỂM TRA — Henry cần làm]** Chưa dùng screen reader hoặc thử toàn bộ tổ hợp bàn phím trên Android/iOS/Safari; không tuyên bố đạt chuẩn accessibility toàn diện. Không làm accessibility nâng cao trong 9A.

## D. Security review

Mỗi dòng ghi rõ nguồn, cách xác minh, ảnh hưởng và việc có sửa hay không; không suy từ đọc code thành kiểm thử thực thi.

| Loại bằng chứng | File/hàm | Kết luận/finding cụ thể | Cách xác minh và mức ảnh hưởng | Xử lý |
|---|---|---|---|---|
| [TEST TỰ ĐỘNG] | `createAccessToken`, `verifyAccessToken` — [token.js](server/src/utils/token.js); `requireAuth` — [authMiddleware.js](server/src/middlewares/authMiddleware.js) | Các ca JWT sai/hết hạn/thiếu, user khóa hoặc sai quyền bị từ chối | Suite auth và realtime đạt; nguy cơ vượt quyền trong các ca này chưa tái hiện | Không đổi JWT |
| [TEST TỰ ĐỘNG] | `createInternalUser`, `login` — [userService.js](server/src/services/userService.js), [authController.js](server/src/controllers/authController.js) | Bcrypt kiểm tra được mật khẩu đúng; passwordHash không xuất hiện trong User thông thường; khách không thành User | Suite auth kiểm tra hash, đăng nhập và giới hạn thử sai; không phát hiện lỗi mới trong các ca đã chạy | Không đổi bcrypt |
| [TEST TỰ ĐỘNG] | [catalogRoutes.js](server/src/routes/catalogRoutes.js), [dashboardRoutes.js](server/src/routes/dashboardRoutes.js), [orderRoutes.js](server/src/routes/orderRoutes.js) | Staff không sửa catalog/bàn hoặc đọc doanh thu; được xem bàn và xử lý đơn | Suite catalog/workflow/dashboard và Chrome dashboard đều đạt | Không đổi phân quyền |
| [TEST TỰ ĐỘNG] | `getPublicOrder`, `matchesTrackingToken` — [publicOrderController.js](server/src/controllers/publicOrderController.js), [orderToken.js](server/src/utils/orderToken.js) | ID đơn đơn thuần hoặc token sai/khác đơn không cấp quyền | Suite orders/realtime; Chrome mở đơn thiếu mã bị chặn | Không đổi cơ chế token |
| [TEST TỰ ĐỘNG] | `getPublicTable`, `getTableQr` — [publicMenuController.js](server/src/controllers/publicMenuController.js), [tableController.js](server/src/controllers/tableController.js) | QR sai/bàn tắt bị chặn, token bàn không trùng; QR không cấp quyền xem đơn | Suite catalog và orders đạt. QR bị chia sẻ vẫn nhận diện đúng bàn; đó là giới hạn thiết kế | Không đổi QR |
| [TEST TỰ ĐỘNG] | `validateFields`, `validateOrder`, `orderListQuery` — [catalogValidation.js](server/src/utils/catalogValidation.js), [orderValidation.js](server/src/utils/orderValidation.js), [internalOrderValidation.js](server/src/utils/internalOrderValidation.js) | Các payload object `$ne`, `$set` và orderCode `.*` thử không vào được query theo ý client | Test production mới gọi validator; các suite cũ thử input qua API. Không thấy NoSQL injection trong các payload này | Không thay validation |
| [TEST TỰ ĐỘNG] | [CustomerMenuPage.jsx](client/src/pages/customer/CustomerMenuPage.jsx), [MenuProductDetails.jsx](client/src/components/MenuProductDetails.jsx), [OrderSummary.jsx](client/src/components/OrderSummary.jsx) | Tên khách/món/mô tả chứa thẻ img/svg/script được hiển thị như chữ | Chrome kiểm tra biến đánh dấu không được thực thi và không có DOM img/svg được chèn; tác động XSS đã thử chưa tái hiện | Không sửa giao diện |
| [TEST TỰ ĐỘNG] | `initializeRealtime` — [realtimeServer.js](server/src/sockets/realtimeServer.js) | JWT/role giả không vào staff; sai Origin bị chặn; thiếu/sai token không vào order room | 30 test socket đạt, gồm Origin và các room | Không rewrite socket |
| [TOOL CHẠY THỦ CÔNG — đọc cấu hình CORS] | `createApp` — [app.js](server/src/app.js) | HTTP CORS cấu hình theo CLIENT_ORIGIN, không dùng `*`; CORS không thay JWT/token | Đọc lời gọi middleware; kiểm thử Chrome/API cùng frontend đúng origin đã chạy. Không coi đây là kiểm thử mọi môi trường proxy | Không đổi CORS |
| [TEST TỰ ĐỘNG] | `errorHandler` — [errorHandler.js](server/src/middlewares/errorHandler.js) | Lỗi MongoDB trước sửa bị phân loại 500 thay vì 503 | Tắt DB thật và test lỗi production; ảnh hưởng khả dụng/thông báo, **trung bình**, chưa thấy rò secret qua response | Đã sửa 503 theo yêu cầu |
| [TEST TỰ ĐỘNG] | [errorHandler.js](server/src/middlewares/errorHandler.js), [notifications.js](server/src/sockets/notifications.js) | Response/log được lấy mẫu không chứa marker lỗi thô hoặc token thử nghiệm | 19 test mới và kịch bản sự cố thu log; các test socket kiểm tra payload tối thiểu | Không log thêm dữ liệu nhạy cảm |
| [TEST TỰ ĐỘNG] | `getPublicOrder` — [publicOrderController.js](server/src/controllers/publicOrderController.js) | Finding dữ liệu thừa `statusHistory.changedBy`: **đã xử lý ngày 20/09/2026 theo yêu cầu Henry** | Test hồi quy xác nhận public chỉ có status/changedAt, không có cancelledBy/ID tài khoản; API nội bộ và dữ liệu DB giữ nguyên. Mức ảnh hưởng ban đầu thấp | Đã thu hẹp response public; xem phần bổ sung bên dưới |
| [TOOL CHẠY THỦ CÔNG — đọc storage/logout] | [authStorage.js](client/src/utils/authStorage.js), [guestStorage.js](client/src/utils/guestStorage.js), `logout` — [authController.js](server/src/controllers/authController.js) | JWT/token khách đọc được bằng JavaScript; logout chưa thu hồi bản JWT bị sao chép | Giới hạn cụ thể của cách lưu/session hiện có. Nếu đã có XSS, token có thể bị đọc; các payload XSS thử ở trên không chạy | Giữ thiết kế; không tự đổi contract/cơ chế phiên |

**[TOOL CHẠY THỦ CÔNG — đọc package và authRoutes]** `express-rate-limit` **đã tồn tại trước 9A**, được import cho loginLimiter. Không cài mới, không thêm limiter khác, không đổi package/lockfile. Không kết luận phải thêm limiter chỉ từ một nguy cơ giả định.

## E. Production errors

**[TEST TỰ ĐỘNG]** [productionErrors.test.js](server/tests/productionErrors.test.js) chạy Express với `NODE_ENV=production`, phát lỗi qua HTTP thật. 19 test mới gồm:

- Tám loại lỗi kết nối MongoDB và một timeout bộ đệm Mongoose → 503.
- ValidationError/CastError → 400; duplicate key → 409.
- Error/MongooseError không phải lỗi kết nối → 500, không bị che thành lỗi DB.
- JSON hỏng → 400; JSON quá lớn → 413.
- Health disconnected và trường hợp readyState còn connected nhưng ping thất bại → 503.
- Validator từ chối các object toán tử MongoDB/regex thử nghiệm.

**[TEST TỰ ĐỘNG]** Các response lỗi được kiểm tra chỉ có `success`, `message`; không có stack, đường dẫn thử, chuỗi MongoDB thử hoặc marker secret. Các log console.error được bắt trong test cũng không chứa marker đó. Kịch bản tắt DB thật trong phần B xác nhận sửa lỗi không chỉ đúng với mock.

## F. Environment / secrets

**[TOOL CHẠY THỦ CÔNG — đọc mẫu và quét giá trị không in ra]** Đã đọc [.gitignore](.gitignore), [server/.env.example](server/.env.example), [client/.env.example](client/.env.example), [env.js](server/src/config/env.js). Script đọc cấu hình cục bộ chỉ xuất tên biến và boolean kiểm tra, không xuất giá trị:

| Biến/phần | Kết quả quan sát |
|---|---|
| JWT_SECRET | Có giá trị, đủ ít nhất 32 ký tự |
| ORDER_TOKEN_SECRET | Có giá trị, đủ ít nhất 32 ký tự, khác JWT_SECRET |
| CREATE_USER_PASSWORD | Có trong `.env` cục bộ; mẫu để trống, không đưa giá trị vào báo cáo |
| MONGODB_URI | Có cấu hình; URL cục bộ hiện tại không chứa password |
| Client env | Chỉ có VITE_API_BASE_URL, không thấy biến secret backend |
| Source/tài liệu ngoài `.env` | Không tìm thấy bản sao giá trị của JWT_SECRET, ORDER_TOKEN_SECRET hoặc CREATE_USER_PASSWORD đang dùng |
| File mẫu | JWT_SECRET, ORDER_TOKEN_SECRET và CREATE_USER_PASSWORD để trống |
| `.gitignore` | Có `.env`, `.env.*`, ngoại lệ `.env.example`, loại dependency/build/log |

**[TOOL CHẠY THỦ CÔNG — tìm localhost]** Localhost có trong default URL của [axiosClient.js](client/src/api/axiosClient.js), [publicMenuApi.js](client/src/api/publicMenuApi.js), [socket.js](client/src/realtime/socket.js), file mẫu và thông báo khởi động. Các URL runtime client đều nhận VITE_API_BASE_URL; không sửa fallback phát triển hoặc cấu hình LAN/deploy ở lượt này.

**[CHƯA KIỂM TRA — Henry cần làm]** `.gitignore` không chứng minh secret chưa từng bị commit. Do Git chưa chạy được/không có repo, chưa kiểm tra lịch sử Git hoặc file đang được track. Khi có repo đúng, cần kiểm tra cả lịch sử; không tự xóa hoặc thay secret trong `.env` hiện có.

## G. Database integrity

**[TOOL CHẠY THỦ CÔNG — chạy `npm run check:data` chỉ đọc]** Sau khi test Chrome đã dọn fixture, output DB chính là:

```text
ordersChecked: 0
itemsChecked: 0
completedWithoutPaidAt: 0
itemsWithWrongLineTotal: 0
ordersWithWrongTotal: 0
itemsWithoutProductId: 0
passed: true
```

Nguồn: [checkData.js](server/scripts/checkData.js). **0 lỗi trên 0 order**, không mô tả thành đã kiểm chứng dữ liệu kinh doanh thực tế. Không backfill hoặc sửa bản ghi DB chính.

**[TEST TỰ ĐỘNG]** Suite orders/workflow/dashboard đã chạy xác minh requestId unique/retry, token hash và trường không public, snapshot không đổi theo Product, lịch sử và người thực hiện, paidAt khi completed, cảnh báo paidAt sai kiểu, tiền mỗi dòng/tổng đơn. Test dùng fixture riêng; không cộng số fixture đó vào kết quả check:data của DB chính.

**[TEST TỰ ĐỘNG]** Script tạm `/private/tmp/restaurant-9a-performance.mjs` đọc `collection.indexes()` trong DB kiểm thử và assert unique cho `orders.requestIdHash`, `orders.orderCode`, `tables.qrToken`. Test tự tạo/dọn DB tên ngẫu nhiên, không đổi index/schema của project. Nguồn khai báo: [Order.js](server/src/models/Order.js), [Table.js](server/src/models/Table.js).

**[TOOL CHẠY THỦ CÔNG — đọc schema]** Order bật timestamps; items và statusHistory nhúng trong một document, tắt `_id` con. Cập nhật status/lịch sử/thanh toán dùng lệnh có điều kiện ở `changeOrderStatus` trong [orderWorkflowService.js](server/src/services/orderWorkflowService.js). Không bổ sung schema hoặc transaction trong 9A.

## H. Performance review

**[TEST TỰ ĐỘNG]** Script performance tạm gọi API trên DB kiểm thử với 5 rồi 200 đơn, dùng Mongoose debug hook chỉ đếm collection/method, không ghi tham số query. Số query gồm cả truy vấn xác thực User:

| API | 5 đơn | 200 đơn |
|---|---:|---:|
| GET orders, limit=5 | 3 | 3 |
| GET tables | 3 | 3 |
| Dashboard summary | 6 | 6 |
| Dashboard products | 2 | 2 |
| Dashboard recent-orders | 2 | 2 |

**[TEST TỰ ĐỘNG]** Không thấy kiểu N+1 trong các endpoint/mẫu này: tăng số đơn không tăng số query. Orders chỉ trả 5 dòng theo limit, recent-orders tối đa 10; summary vẫn cộng đúng tổng snapshot 35.000đ × số đơn. Đây không phải benchmark tải lớn hoặc nhiều người dùng đồng thời.

**[TOOL CHẠY THỦ CÔNG — chạy explain hiện có]** `npm run explain:dashboard` cho doanh thu dùng IXSCAN `status_1_paidAt_1`, số đơn dùng IXSCAN `createdAt_-1__id_-1`. DB chính đang trống nên returned/documentsExamined/keysExamined đều 0. Không thêm index, không dùng kết quả trống để cam kết tốc độ ở dữ liệu lớn. Nguồn: [explainDashboard.js](server/scripts/explainDashboard.js).

**[TOOL CHẠY THỦ CÔNG — đọc query và output build]** [dashboardService.js](server/src/services/dashboardService.js) tổng hợp ở MongoDB, không tải toàn bộ Order về React. [AppRoutes.jsx](client/src/routes/AppRoutes.jsx) dùng React.lazy cho dashboard; [RevenueChart.jsx](client/src/components/RevenueChart.jsx) import Chart.js trong nhánh dashboard. Build sinh chunk dashboard riêng 160,76 kB. Chưa có dấu hiệu cần micro-optimize trong phạm vi đã đo.

**[CHƯA KIỂM TRA — Henry cần làm]** Chưa đo tải hàng nghìn khách đồng thời hoặc thời gian render trên điện thoại yếu; kiểm thử 5/200 đơn không thay cho thử tải production. Danh sách catalog hiện vẫn tải toàn bộ menu nhỏ, chưa được đo với hàng chục nghìn món.

## I. Socket.IO review

**[TEST TỰ ĐỘNG]** 30 test socket và script Chrome realtime/dashboard đạt các điều sau:

- Staff/admin có JWT hợp lệ mới vào staff; server tự gán room, không tin role client; user room dùng ngắt khi khóa/logout.
- Guest phải có trackingToken đúng của đơn để vào order room; ID sai/sai token/khác đơn không cấp quyền.
- RequestId trùng không phát order:created lần hai; lỗi validation/409 không phát thành công giả; emit lỗi không làm API ghi thành công thất bại.
- Reconnect → join lại → ACK → refetch; khách visible trở lại đọc API; client khác không nhận dữ liệu đơn không có quyền.
- Chuyển trang/reload không nhân thông báo; bộ lọc/phân trang giữ đúng; socket tắt vẫn dùng API và UI hiện trạng thái mất realtime.
- Dashboard gom 40 event thành một lần đọc bốn API sau khoảng 1,5 giây; tab ẩn chờ hiện lại; kỳ không chứa hôm nay bỏ qua event; phản hồi cũ không ghi đè bộ lọc mới.
- Payload được thử không chứa JWT/trackingToken/secret; event chỉ báo thay đổi.

Nguồn: [realtime.test.js](server/tests/realtime.test.js), [realtime.mjs](server/tests-browser/realtime.mjs), [dashboard.mjs](server/tests-browser/dashboard.mjs).

**[TOOL CHẠY THỦ CÔNG — tìm nơi tạo socket và đăng ký listener]** Chỉ một `io()` client tại [socket.js](client/src/realtime/socket.js). Các `off()` trong [useSocketSession.js](client/src/realtime/useSocketSession.js), [useRealtimeRefresh.js](client/src/realtime/useRealtimeRefresh.js), [StaffRealtimeContext.jsx](client/src/contexts/StaffRealtimeContext.jsx), [useDashboard.js](client/src/hooks/useDashboard.js) truyền đúng handler tương ứng. Không rewrite realtime, không thêm adapter/dependency.

## J. Health check

**[TEST TỰ ĐỘNG]** Health được thử disconnected, ping lỗi dù readyState còn connected, DB tắt thật và hồi phục thật. Response chỉ chứa success/message cùng `data.backend` và `data.database`; connected → 200, disconnected → 503, có Cache-Control no-store. Không có URI, password, stack hoặc cấu hình trong response. Nguồn: `getHealth` tại [healthController.js](server/src/controllers/healthController.js), test production và kịch bản sự cố.

**[TOOL CHẠY THỦ CÔNG — gọi bằng curl]** API health của dịch vụ chính trả backend running/database connected; frontend localhost trả HTTP 200 trước các thử nghiệm trình duyệt. Không tắt dịch vụ chính để thử sự cố.

## K. Logging

**[TEST TỰ ĐỘNG]** Kịch bản production thu stdout/stderr của Node thử và so với secret/token/mật khẩu fixture: không có giá trị bị ghi ra, có log MongoDB mất kết nối/kết nối lại. Test production bắt console.error của middleware và kiểm tra không lộ marker nhạy cảm.

**[TOOL CHẠY THỦ CÔNG — đọc tất cả chỗ log trong src]** Log khởi động/dừng ở [server.js](server/src/server.js); log DB ở [database.js](server/src/config/database.js); API log mã lỗi chung tại [errorHandler.js](server/src/middlewares/errorHandler.js); socket log câu chung tại [notifications.js](server/src/sockets/notifications.js). Không tìm thấy console.log/debug tạm ở frontend. Listener DB mới chỉ được gắn lúc nạp module, không gắn mỗi query.

**[CHƯA KIỂM TRA — Henry cần làm]** Chưa kiểm tra log của hosting/proxy hoặc dịch vụ bên ngoài vì không deploy trong 9A; kết quả trên chỉ áp dụng log ứng dụng đã thu được.

## L. Final code review

**[TOOL CHẠY THỦ CÔNG — tìm và đối chiếu source]** Tìm TODO/FIXME, console.log/debug, eval/dangerouslySetInnerHTML, localhost, các chỗ on/off và import dependency. Không thấy TODO/FIXME hoặc debug frontend còn sót trong src; các console.log runtime tìm được là khởi động/dừng/kết nối. Mỗi dependency khai báo đều có nơi sử dụng trong src/config/test; socket.io-client devDependency của server dùng cho test, không phải thư viện thừa. Không cài thêm express-rate-limit hoặc package nào khác.

**[TOOL CHẠY THỦ CÔNG — đọc phạm vi code cũ]** Các trang nền tảng/health/admin-check vẫn có route và được dùng để kiểm tra phiên/nền tảng; không tự xóa chỉ vì có vẻ là code demo. Chưa xác nhận dead code nào cần bỏ. Đây là rà soát tĩnh, không phải chứng minh mọi dòng đều được chạy.

**[TEST TỰ ĐỘNG]** Các kiểm tra thực thi 9A chưa phát hiện bug mới ở nghiệp vụ order, phân quyền, tiền/snapshot, 409, thống kê hoặc realtime ngoài lỗi phân loại DB 500 đã sửa. Test Chrome workflow cũ vẫn pass trong lần chạy này; rủi ro timing ghi ở 9C chưa tái hiện, không sửa hoặc nới assertion của test đó.

## M. Test / build cuối 9A

**[TEST TỰ ĐỘNG]** `npm --prefix server test`, chạy sau thay đổi runtime và thêm test:

```text
tests 230
suites 7
pass 230
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5034.241416
```

Gồm 211 test cũ + 19 test mới. Không xóa/skip/sửa test cũ. Bốn script Chrome, script sự cố, performance và accessibility đều kết thúc exit 0 ở lần chạy cuối; không cộng các assertion của script tạm vào số 230.

**[TOOL CHẠY THỦ CÔNG — production build]** `npm --prefix client run build` thành công, Vite 8.3.0, 235 modules, output:

| File | kB | gzip kB |
|---|---:|---:|
| dist/index.html | 0.47 | 0.32 |
| dist/assets/index-DYCij2h3.css | 25.73 | 5.73 |
| dist/assets/DashboardPage-MbAJgToy.js | 160.76 | 56.01 |
| dist/assets/index-M4rfVXFa.js | 424.97 | 131.13 |

Vite báo build trong 154ms. Đây là kích thước output thực tế, không phải tốc độ tải qua mạng hoặc số đo bundle lấy lại từ 9C. Browser tests chạy trên frontend dev đang có; chưa chạy tương tác đầy đủ trên bản preview production.

**[TOOL CHẠY THỦ CÔNG — lưu bằng chứng tool]** Các log/script hỗ trợ đang nằm trong `/private/tmp`: `restaurant-9a-tests.log`, `restaurant-9a-build.log`, `restaurant-9a-browser-orders.log`, `restaurant-9a-browser-suite.log`, `restaurant-9a-accessibility.log`; script `restaurant-9a-outage.mjs`, `restaurant-9a-performance.mjs`, `restaurant-9a-accessibility.mjs`, `restaurant-9a-chrome-runner.mjs`. Đây là file tạm, không phải command/package mới của project. Test production cần giữ lâu dài đã nằm trong repo.

## N. Chưa xử lý

| Loại | Vấn đề | Vì sao chưa xử lý |
|---|---|---|
| [CHƯA KIỂM TRA — Henry cần làm] | Git status/commit/tag và lịch sử secret | Git bị chặn bởi giấy phép Xcode; không có repo trong thư mục được cung cấp. Không tự init/commit/tag thay cho checkpoint thiếu |
| [TOOL CHẠY THỦ CÔNG — đọc test và chạy lại] | Script workflow cũ có giả định timing trước khi realtime refetch | Lần chạy 9A pass, chưa tái hiện thất bại; không đổi assertion để hợp thức hóa |
| [TOOL CHẠY THỦ CÔNG — đọc thiết kế phiên] | JWT bị sao chép chưa bị thu hồi khi logout; token storage đọc được bởi JS | Giới hạn hiện tại; đổi cơ chế phiên/storage vượt sửa lỗi nhỏ, không tự refactor |
| [CHƯA KIỂM TRA — Henry cần làm] | UI trên bản production preview, điện thoại/browser khác, screen reader, tải lớn, log hạ tầng | Chưa có bằng chứng thực thi cho các môi trường này; không coi headless Chrome/build là thay thế |

## O. Henry cần tự kiểm tra

- **[CHƯA KIỂM TRA — Henry cần làm]** Cung cấp đúng repo, xử lý Git/Xcode trên máy, xem trạng thái thật và thay đổi chưa commit trước khi quyết định checkpoint. Không tự commit/stash/reset chỉ để có working tree sạch.
- **[CHƯA KIỂM TRA — Henry cần làm]** Sau khi có Git, xác minh `.env`/secret không từng bị track hoặc commit; báo cáo 9A không khẳng định điều này khi chưa có repo.
- **[CHƯA KIỂM TRA — Henry cần làm]** Thử bàn phím/đọc chữ trên trình duyệt và thiết bị sẽ dùng thực tế; Android/iOS/Safari và screen reader chưa được thử ở đây. Việc LAN/deploy vẫn ngoài lượt 9A.
- **[CHƯA KIỂM TRA — Henry cần làm]** Nếu cần kiểm chứng bản build được phục vụ production, chạy tương tác trên môi trường preview phù hợp; hiện mới có production build, production backend error tests và UI trên dev server.
- **[CHƯA KIỂM TRA — Henry cần làm]** Khi có dữ liệu thực, chạy check:data lại. Kết quả 0 lỗi hiện tại là trên 0 order, không phải xác nhận dữ liệu kinh doanh đã đầy đủ.
- **[TOOL CHẠY THỦ CÔNG — ghi nhận phạm vi]** Finding public statusHistory.changedBy đã được Henry cho phép xử lý và đã hoàn tất ở phần bổ sung dưới đây. Cơ chế thu hồi JWT vẫn giữ nguyên, không mở rộng phạm vi trong lượt sửa response public.

**ĐÃ DỪNG SAU 9A — CHƯA THỰC HIỆN 9B.**


## Bổ sung sau 9A — Đã xử lý thông tin nhân viên trong response khách

Ngày: **20/09/2026**. Henry cho phép thu hẹp response public trước 9B. Đây là cập nhật tiếp theo của finding từng ghi ở 9C/9A; các kết quả kiểm tra cũ bên trên giữ ý nghĩa lịch sử, không phải mô tả response sau lần sửa này.

**[TOOL CHẠY THỦ CÔNG — đối chiếu code]** Chỉ sửa `getPublicOrder` tại [publicOrderController.js](server/src/controllers/publicOrderController.js): mỗi phần tử `statusHistory` được tạo thành object mới với đúng `status`, `changedAt`. Không trả nguyên subdocument từ Order. Phần thông tin hủy tiếp tục chỉ trả `cancelReason`, `cancelledAt`, không thêm `cancelledBy` hoặc thông tin tài khoản. Không đổi schema, không xóa field trong Order và không ghi lại dữ liệu MongoDB khi đọc.

**[TEST TỰ ĐỘNG]** Thêm bốn test vào [orderWorkflow.test.js](server/tests/orderWorkflow.test.js), giữ nguyên assertion của các test cũ:

1. Public history của đơn đã xác nhận chỉ có status/changedAt, không có changedBy hoặc ID tài khoản nội bộ; thời gian/trạng thái vẫn đúng.
2. Public đơn hủy giữ lý do và thời gian nhưng không trả cancelledBy/thông tin nhân viên; so sánh document MongoDB trước/sau GET để xác nhận không sửa dữ liệu, kể cả audit và trường bảo vệ.
3. Cả staff và admin gọi API nội bộ vẫn nhận changedBy/cancelledBy với ID, fullName, username của người đã xác nhận/hủy; không lộ các trường secret.
4. TrackingToken đúng vẫn xem được đơn đã xử lý; thiếu token, sai định dạng, token ngẫu nhiên hoặc token đơn khác đều bị từ chối và không có chi tiết đơn.

**[TEST TỰ ĐỘNG]** Đã chạy bốn test mới trước khi sửa controller: hai test public thất bại đúng ở assertion `changedBy`, hai test nội bộ/token đạt. Sau sửa, chạy **toàn bộ backend** bằng `npm --prefix server test`, output thực tế:

```text
tests 234
suites 7
pass 234
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 4598.883833
```

Gồm 230 test của cuối 9A và 4 test hồi quy mới. Log lần chạy toàn bộ: `/private/tmp/restaurant-public-audit-tests.log`. Finding dữ liệu nhận diện nhân viên trong response public chuyển thành **ĐÃ XỬ LÝ**; đã bỏ khỏi mục N “Chưa xử lý”.

**[TOOL CHẠY THỦ CÔNG — gọi Git]** Đã thử `git rev-parse --show-toplevel`; Git vẫn trả exit 69 do giấy phép Xcode. Không tự chấp nhận giấy phép, không init/add/commit hoặc tạo tag trong lượt này; tuyệt đối không tạo tag giai-doan-8. Chưa thực hiện checkpoint giai-doan-9a.

**[CHƯA KIỂM TRA — Henry cần làm]** Làm Git hoạt động, xác định đúng repo hoặc khởi tạo baseline hiện tại theo quy trình đã thống nhất; kiểm tra `.gitignore` và file được stage để không đưa `.env`, secret, dump hoặc node_modules vào commit. Chưa bắt đầu 9B khi checkpoint này chưa hoàn tất.

**ĐÃ DỪNG SAU SỬA FINDING 9A — CHƯA THỰC HIỆN 9B.**

## Cập nhật chuẩn bị Git checkpoint — 21/09/2026

**[TOOL CHẠY THỦ CÔNG — gọi Git]** Git hệ thống đã hoạt động. `git rev-parse --show-toplevel` ban đầu báo không có repository; đã chạy `git init` tại đúng thư mục project. Chưa có commit hoặc tag; không tạo `giai-doan-8` vì source đã hoàn thành 9A và sửa finding public response.

**[TOOL CHẠY THỦ CÔNG — kiểm tra file trước commit]** Bổ sung `.gitignore` cho cấu hình công cụ cục bộ, dump/backup và khóa riêng. Kiểm tra 151 file dự kiến đưa vào Git: không có `.env`, node_modules, dist, dump hoặc khóa riêng; không tìm thấy bản sao giá trị JWT_SECRET, ORDER_TOKEN_SECRET, CREATE_USER_PASSWORD đang dùng. Giữ hai `.env.example` trong source. Không in giá trị secret.

**[TOOL CHẠY THỦ CÔNG — cập nhật cấu hình Git ngày 22/09/2026]** Henry đã cung cấp repository `https://github.com/henry2k3/khoaluan.git`. Đã đặt remote origin sau khi `git ls-remote` xác nhận remote chưa có refs. Hồ sơ công khai GitHub xác định tài khoản henry2k3; dùng tên này và địa chỉ GitHub noreply theo ID tài khoản làm tác giả, chỉ cấu hình local cho repo, không đổi Git toàn máy. Không sử dụng email cá nhân.

**CHƯA THỰC HIỆN 9B.**


## Git checkpoint hiện tại — baseline sau 9A

**[TOOL CHẠY THỦ CÔNG — chuẩn bị checkpoint]** Baseline gồm bản đã hoàn tất 9A, sửa finding public history và bộ test 234/234 đạt ở lượt trước. Không sửa code nghiệp vụ hoặc chạy lại test chỉ vì cấu hình Git. Tên commit là `Baseline after phase 9A`; tag dùng `giai-doan-9a`. Không tạo `giai-doan-8` vì không có lịch sử giai đoạn 8 để gắn tag chính xác.

**[TOOL CHẠY THỦ CÔNG — kiểm tra nội dung stage]** Kiểm tra lại danh sách/blob được stage trước commit: chỉ source, test, tài liệu, package/lockfile và cấu hình mẫu; không stage `.env`, node_modules, dist, dump, backup hoặc khóa riêng. Secret thực tế được đối chiếu mà không in giá trị. Các thông báo thiếu Git/danh tính ở những phần trước là kết quả lịch sử của lúc kiểm tra, đã được giải quyết trong bước checkpoint này.

Có thể kiểm tra checkpoint sau khi tạo bằng `git log -1 --oneline`, `git show --no-patch giai-doan-9a`, `git status --short`. Không push lên GitHub trong bước tạo checkpoint local này; chưa thực hiện 9B.

---

# GIAI ĐOẠN 9B — LAN, demo và chuẩn bị production

Ngày thực hiện: **22/09/2026**. Phần 9A/9C phía trên giữ nguyên như nhật ký lịch sử. Lượt này chỉ làm phạm vi 9B đã duyệt; không đổi schema/API nghiệp vụ, không thêm dependency, không commit/push, không triển khai lên hosting và không viết lại tài liệu bảo vệ.

**[TOOL CHẠY THỦ CÔNG — Git và đối chiếu danh sách duyệt]** Bắt đầu từ working tree sạch, commit `dcff025`, tag `giai-doan-9a`. Không tồn tại `giai-doan-8`, nên không thể review diff từ tag đó và không tạo tag giả. Review thay đổi từ checkpoint 9A đến working tree hiện tại. Henry đã duyệt danh sách ban đầu và bổ sung realtimeServer.js, ba script browser cũ cùng client/.env local.

## A. Mobile/LAN

**[TOOL CHẠY THỦ CÔNG — đọc API trình duyệt và cấu hình]** `newRequestId` tại [guestStorage.js](client/src/utils/guestStorage.js) dùng `crypto.getRandomValues`, không dùng randomUUID; không tìm thấy clipboard hoặc API secure-context khác cần sửa trong source. Vite giữ nguyên config, dùng `--host 0.0.0.0` để mở LAN. Backend hiện dùng `server.listen(env.port)` không giới hạn localhost. Không hardcode IP thật vào source.

**[TEST TỰ ĐỘNG]** [production.mjs](server/tests-browser/production.mjs) chạy Chrome desktop thật ở 375px, mở bản build qua IP LAN của Mac. Assert `isSecureContext === false`; vẫn thêm giỏ/gửi order được, refresh trang đơn giữ tracking, staff nhận đơn và cập nhật khách, dashboard/bàn thay đổi đúng. Script cũng chạy đạt qua loopback. Đây không phải điện thoại vật lý và không kiểm tra đường truyền từ thiết bị khác qua access point.

**[TOOL CHẠY THỦ CÔNG — đọc storage]** JWT nằm trong **sessionStorage**: hướng dẫn demo yêu cầu **mở tab mới độc lập hoặc đổi từ localhost sang IP phải đăng nhập lại**. Test mở tab mới độc lập cùng browser context xác nhận về trang login. Một số trình duyệt có thể sao chép sessionStorage khi nhân bản tab hoặc có opener; không dựa vào đó cho demo. Giỏ/token khách trong localStorage cũng tách theo origin; đổi IP không tự chuyển lịch sử sang origin mới. Nguồn: [authStorage.js](client/src/utils/authStorage.js), [guestStorage.js](client/src/utils/guestStorage.js).

**[CHƯA KIỂM TRA — Henry cần làm]** Android Chrome, iOS Safari, camera quét QR, khóa màn hình, chuyển app, tắt Wi-Fi 20 giây và mạng phòng bảo vệ. Checklist 13 bước và cách xử lý firewall, AP isolation, khác mạng, IP đổi, VPN, bind localhost/hotspot nằm ở [README mục 17](README.md#17-9b--chạy-lan-và-điện-thoại).

## B. PUBLIC_APP_URL

**[TOOL CHẠY THỦ CÔNG — đối chiếu getTableQr]** [tableController.js](server/src/controllers/tableController.js) dựng URL/ảnh QR ở backend từ PUBLIC_APP_URL và qrToken. Không ghi URL đầy đủ hoặc ảnh vào MongoDB. Khi đổi IP/domain, chỉ sửa env và restart server, mở lại QR; giữ nguyên qrToken, không build lại frontend chỉ vì đổi QR.

**[TEST TỰ ĐỘNG]** Browser production lấy QR Bàn 05 qua API admin, assert `menuUrl` đúng origin server thử và đúng qrToken, rồi mở menu đó. Bàn 05 sau seed đang hoạt động và chưa có order đang xử lý.

**[TOOL CHẠY THỦ CÔNG — kiểm tra build env]** Client đã bỏ fallback localhost cố định. [baseUrl.js](client/src/api/baseUrl.js) ưu tiên VITE_API_BASE_URL nếu có; để trống thì dev dùng hostname trang + cổng 3000, production dùng `/api`. Đã bỏ giá trị localhost trong client/.env local và cập nhật .env.example. **Henry cần tự bỏ giá trị cũ trong client/.env trên các máy khác**; file local không commit. Nếu dùng VITE_* override production, thay giá trị phải build lại; không được chứa secret. File `.env.development` có thể chứa override dành riêng dev, nhưng cấu hình chuẩn không cần tạo file đó.

## C. CORS/Socket.IO LAN

**[TOOL CHẠY THỦ CÔNG — đọc env/app/realtime]** [env.js](server/src/config/env.js) parse CLIENT_ORIGIN một lần: tách dấu phẩy, trim, bỏ slash cuối, kiểm tra URL origin hợp lệ, loại trùng và cộng PUBLIC_APP_URL. Express và Socket.IO cùng dùng `env.allowedOrigins`. Không wildcard/regex origin; so khớp chính xác. Request không có Origin được qua lớp CORS; JWT/trackingToken vẫn bắt buộc khi nghiệp vụ yêu cầu. CLIENT_ORIGIN trống được hỗ trợ nếu có PUBLIC_APP_URL. Cấu hình cũ một CLIENT_ORIGIN vẫn dùng được; khi PUBLIC_APP_URL trống, lấy origin đầu tiên để tương thích.

**[TEST TỰ ĐỘNG]** [productionServe.test.js](server/tests/productionServe.test.js) xác minh:

- Origin localhost, LAN thử và origin PUBLIC_APP_URL đều qua API, polling, WebSocket.
- Origin khác và tên gần giống có hậu tố domain giả bị API trả 403, socket từ chối kết nối.
- Không Origin: API vẫn yêu cầu JWT (401 nếu thiếu), socket khách kết nối và nhận ACK được.
- Production không CLIENT_ORIGIN: API/polling/WebSocket vẫn qua nhờ PUBLIC_APP_URL.
- Một origin kiểu dev cũ vẫn hoạt động; cấu hình wildcard/path bị từ chối.

**[TOOL CHẠY THỦ CÔNG — đọc ba script browser đã sửa]** orders.mjs/workflow.mjs/realtime.mjs chọn `BROWSER_FRONTEND_URL` nếu có, nếu không lấy origin CLIENT_ORIGIN đầu tiên hoặc PUBLIC_APP_URL. Không lấy nguyên danh sách có dấu phẩy làm URL; không đổi assertion. Chưa chạy lại ba script này trong 9B; test backend cũ và browser production mới đã chạy.

## D. Seed demo

**[TOOL CHẠY THỦ CÔNG — đọc CLI]** `npm --prefix server run seed:demo` chạy [seedDemo.js](server/scripts/seedDemo.js), dùng [demoData.js](server/scripts/demoData.js). Mật khẩu bắt buộc lấy từ DEMO_ADMIN_PASSWORD/DEMO_STAFF_PASSWORD, kiểm tra trước khi ghi. User tạo qua `createInternalUser` và bcrypt, không insertMany/insert thô. Seed kiểm tra mọi collection có bản ghi thì từ chối; không tự xóa hoặc ghi đè. Kết nối tắt autoIndex/autoCreate trước khi kiểm tra rỗng, sau đó tạo collection/index đúng schema hiện có.

**[TEST TỰ ĐỘNG]** Seed trên database thử rỗng tạo:

| Collection/nội dung | Số lượng |
|---|---:|
| users | 3: 1 admin, 2 staff |
| categories | 5 |
| products | 20 |
| tables | 10 |
| orders | 12 |
| order items | 24 |

Tài khoản: demo_admin/demo_staff1/demo_staff2. Có 8 completed, 1 cancelled, 1 pending, 1 confirmed, 1 preparing; đủ customerName/table/snapshot/ghi chú/lịch sử. Ngày mẫu dựa trên lúc chạy seed: hôm nay, hôm qua, 3/6 ngày trước, theo ngày Việt Nam. Chỉ completed có paidAt; không sinh paidAt tương lai ngay sau 00:00. Bàn 05 active, QR 48 ký tự hex duy nhất, không có active order; ba đơn đang xử lý ở bàn khác.

**[TEST TỰ ĐỘNG]** CLI tự chạy script `check:data` hiện có sau seed; thực đọc **12 orders, 24 items**, kết quả:

```text
completedWithoutPaidAt: 0
itemsWithWrongLineTotal: 0
ordersWithWrongTotal: 0
itemsWithoutProductId: 0
passed: true
```

Nguồn assertion: [demo.test.js](server/tests/demo.test.js). Đây là MongoDB thử có dữ liệu thật, không phải kết quả trên DB rỗng. Test còn đăng nhập thành công cả admin và hai staff, kiểm tra hash/index unique, seed lần hai/collection lạ bị từ chối, production thiếu mật khẩu bị từ chối. Database thử được dọn sau khi xong. **Chưa seed/reset database quán hiện tại hoặc tạo mật khẩu demo cố định cho Henry.**

**[TOOL CHẠY THỦ CÔNG — rà soát cách vận hành]** Seed còn kiểm tra tên DB kết nối thật đúng DEMO_DB_NAME và không phải admin/config/local. Chạy từng tiến trình seed/reset, dừng backend demo lúc reset; không có transaction cho toàn bộ seed. Nếu ghi lỗi giữa chừng, giữ phần đã ghi và báo lỗi; Henry quyết định reset demo, không tự xóa. Đơn mẫu để demo nội bộ/dashboard; không phát token xem đơn mẫu cho trình duyệt. Demo khách dùng QR để đặt đơn mới.

## E. Reset demo

**[TOOL CHẠY THỦ CÔNG — đọc resetDemo]** [resetDemo.js](server/scripts/resetDemo.js) chỉ cho xóa khi đồng thời NODE_ENV khác production, có `--confirm`, `connection.name` thật bằng DEMO_DB_NAME. Không parse URI để lấy tên phục vụ kiểm tra quyền. Chặn thêm database hệ thống; in host/database trước dropDatabase, không in credentials/URI. Không có endpoint reset.

```bash
npm --prefix server run reset:demo -- --confirm
```

**[TEST TỰ ĐỘNG]** Thiếu confirm, production hoặc sai tên đều bị từ chối đúng lý do; dữ liệu không đổi. Đủ ba điều kiện xóa đúng database thử, database chứng kiến khác vẫn còn bản ghi. Sau reset, seed lại được. Tên database thử ngẫu nhiên khác DEMO_DB_NAME thật; không dùng reset CLI lên database quán.

## F. Production architecture

**[TOOL CHẠY THỦ CÔNG — đọc app/server]** Express **5.2.1** phục vụ `client/dist` khi NODE_ENV=production, API/Socket.IO cùng HTTP server hiện có. SPA fallback `/{*path}` đặt sau API/socket; asset thiếu hoặc API sai không trả index.html. Không đổi kiến trúc nghiệp vụ, không Redis, chạy một Node instance.

**[TOOL CHẠY THỦ CÔNG — npm start và curl]** Chạy thật `npm --prefix server start` với env production ở cổng thử 3108: backend khởi động/kết nối MongoDB; `/api/health` 200 connected, `/admin/dashboard` 200 HTML, `/api/duong-dan-khong-ton-tai` JSON 404, Socket.IO polling handshake 200 khi CLIENT_ORIGIN trống. Tiến trình thử được dừng sau kiểm tra; không deploy hoặc reset dữ liệu.

**[TOOL CHẠY THỦ CÔNG — đọc log khi dừng tiến trình thử]** Phiên npm start được giữ chạy trong khoảng chờ có nhiều log MongoDB mất kết nối rồi kết nối lại. Các request curl cuối vẫn trả 200/connected; server không dừng. Chưa xác định nguyên nhân gián đoạn từ log này, không kết luận là bug của thay đổi 9B hoặc tự sửa cấu hình database ngoài danh sách duyệt.

**[CHƯA KIỂM TRA — Henry cần làm]** Hosting phải chạy Node liên tục, WebSocket, HTTPS/WSS, env; không dùng backend serverless request ngắn. Chưa deploy/kiểm tra reverse proxy hoặc gói free/sleep thật; cần xác minh từ nhà cung cấp đã chọn và mở server trước buổi bảo vệ nếu có sleep.

## G. Production env

**[TOOL CHẠY THỦ CÔNG — đối chiếu env/package]** Cần NODE_ENV=production, PORT, MONGODB_URI, JWT_SECRET, ORDER_TOKEN_SECRET, PUBLIC_APP_URL=https://domain-thuc-te.com. CLIENT_ORIGIN tùy chọn khi cùng domain; TRUST_PROXY mặc định 0, cấu hình số hop 1–10 chỉ khi đúng topology proxy tin cậy. Test xác nhận app nhận giá trị và từ chối true/wildcard. Chưa cam kết proxy hosting thật khi chưa deploy.

**[TOOL CHẠY THỦ CÔNG — kiểm tra file local/build]** `npm start` dùng --env-file-if-exists để hosting chỉ có env vẫn chạy được. Không đổi secret server hiện tại; .env.example chỉ có tên biến/mẫu không nhạy cảm. Không sửa server/.env. Client/.env đã để trống API, không đưa vào Git. Build 6 file được đối chiếu giá trị CREATE_USER_PASSWORD, JWT_SECRET, MONGODB_URI, ORDER_TOKEN_SECRET đang cấu hình: không tìm thấy; báo cáo chỉ ghi tên biến, không ghi giá trị. Không có dependency mới hoặc thay package-lock.

## H. React production build

**[TOOL CHẠY THỦ CÔNG — chạy build]** Tại gốc project, build client **trước** start server:

```bash
npm --prefix client run build
NODE_ENV=production PORT=3000 PUBLIC_APP_URL=http://localhost:3000 CLIENT_ORIGIN= TRUST_PROXY=0 npm --prefix server start
```

Trên hosting, cài client bằng `npm --prefix client ci --include=dev` trước build để có Vite/Tailwind, rồi cài server `npm --prefix server ci --omit=dev` và start. Giữ `client/dist` trong artifact. README mục 19–20 có đầy đủ lệnh và env.

**[TOOL CHẠY THỦ CÔNG — output Vite]** Build thành công, Vite 8.3.0, 236 modules, 122ms:

| File | kB | gzip kB |
|---|---:|---:|
| dist/index.html | 0.47 | 0.32 |
| dist/assets/index-DYCij2h3.css | 25.73 | 5.73 |
| dist/assets/DashboardPage--wO-D0Y9.js | 160.76 | 56.01 |
| dist/assets/index-CYun4M2y.js | 425.06 | 131.16 |

**[TOOL CHẠY THỦ CÔNG — tìm trong dist]** `rg 'localhost:3000' client/dist` không có kết quả (exit 1 nghĩa là không tìm thấy). Chart.js vẫn ở chunk dashboard riêng. Đây là kích thước build thật, không phải đo tốc độ tải mạng hoặc điện thoại.

## I. Socket.IO production

**[TEST TỰ ĐỘNG]** Browser trên bản build thật đi qua Express: staff/admin login từ tài khoản seed; khách nhập tên/chọn hai món/ghi chú/gửi order; staff nhận đơn mới; khách nhận confirmed/preparing/served/completed; dashboard tăng đúng tiền; bàn tự bận rồi trống. Ngắt mạng khách và đóng transport để bỏ lỡ preparing; bật mạng lại → reconnect/rejoin/ACK/refetch thấy trạng thái đúng. API đều gọi cùng origin. Tất cả chạy khi CLIENT_ORIGIN trống và PUBLIC_APP_URL đặt đúng origin thử.

**[TEST TỰ ĐỘNG]** 30 test Socket.IO cũ vẫn đạt: JWT, trackingToken/room, chống emit khi requestId trùng, lỗi emit không làm API lỗi, conflict 409, khóa/logout, reconnect. Thay đổi 9B chỉ origin, không rewrite nghiệp vụ hoặc listener.

**[CHƯA KIỂM TRA — Henry cần làm]** HTTPS/WSS qua hosting/proxy thật, điện thoại chuyển Wi-Fi/4G hoặc ngủ lâu. Chrome kiểm thử là HTTP; không gọi kết quả đó là đã test WSS production.

## J. MongoDB backup/restore

**[TOOL CHẠY THỦ CÔNG — kiểm tra tools và tài liệu chính thức]** Container MongoDB có mongodump/mongorestore **100.18.0**. README mục 21 hướng dẫn backup bằng archive/gzip, restore vào database mới/rỗng qua nsFrom/nsTo, sau đó check:data. Không có --drop trong ví dụ. Đối chiếu [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) và [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/); không truyền URI có mật khẩu vào history, dùng config riêng/prompt khi cần xác thực.

**[CHƯA KIỂM TRA — Henry cần làm]** Chưa dump/restore thực tế ở lượt này; không restore destructive vào DB hiện tại. Cần thực hành phục hồi ở DB thử, kiểm tra index/dữ liệu, lưu bản sao cùng kế hoạch giữ secret vận hành an toàn. Backup Atlas phụ thuộc gói; chưa xác minh gói của Henry nên không khẳng định có sẵn.

## K. Test/build

**[TEST TỰ ĐỘNG]** Toàn bộ `npm --prefix server test`, lần chạy cuối sau sửa code/test mới:

```text
tests 292
suites 9
pass 292
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5429.842125
```

234 test baseline sau 9A giữ nguyên + **26 test demo** + **32 test production/CORS/fallback**. Không xóa/skip/nới assertion cũ. Lần chạy trong sandbox bị EPERM kết nối/cổng thử đã dừng, sau đó chạy ngoài sandbox với quyền được duyệt; không ghi lần bị chặn thành pass. Log kết quả cuối: `/private/tmp/restaurant-9b-tests.log`.

**[TEST TỰ ĐỘNG]** Browser production mới dùng Chrome DevTools Protocol qua WebSocket/fetch của Node và dependencies đã có, **không Playwright/Puppeteer, không thuộc npm test mặc định**. Chạy riêng `npm --prefix server run test:browser:production`. Đã chạy qua loopback và IP LAN bằng Chrome headless, 375px không tràn ngang trên các màn hình đã thử, không exception JavaScript chưa xử lý. Log `/private/tmp/restaurant-9b-browser.log`, `/private/tmp/restaurant-9b-browser-lan.log`. Database tự tạo/dọn; Chrome chạy profile thử riêng.

**[TOOL CHẠY THỦ CÔNG — build]** Production build và quét localhost/secret đạt như mục G/H. Không cộng assertion Chrome vào số 292 backend tests.

## L. Final code review

**[TOOL CHẠY THỦ CÔNG — review diff từ giai-doan-9a và code liên quan]** Không có tag 8 để review lịch sử trước 9A. Đã kiểm tra app/env/CORS, seed/reset, API base URL, script browser, schema hiện có và các điểm nối order/token/realtime. Không thêm schema/index mới, đổi API contract nghiệp vụ, xóa code nghiệp vụ hay thêm package. Không thấy TODO/FIXME/debug frontend trong phạm vi tìm; localhost còn trong log khởi động, env mẫu và test local, không còn fallback cố định trong client. QR không lưu URL trong DB. Không refactor để làm đẹp code.

**[TEST TỰ ĐỘNG]** Hai lỗi phát hiện trong code mới đã sửa, giữ nguyên yêu cầu kiểm tra:

| File | Vấn đề | Sửa và kiểm chứng |
|---|---|---|
| demoData.js | Mongoose tự gán updatedAt khi tạo làm lệch timestamps của lịch sử mẫu | Chỉ lệnh save dữ liệu lịch sử dùng timestamps:false, vẫn validate schema và cung cấp đủ timestamps; test lịch sử/paidAt/now/ngày VN đạt |
| demo.test.js | URL.pathname còn mã hóa dấu/khoảng trắng của đường dẫn Mac, child process không tìm được script | Dùng fileURLToPath; CLI seed/reset/check:data chạy thật và assertion đúng lý do từ chối đạt |

**[TOOL CHẠY THỦ CÔNG — giới hạn và chưa xử lý]** Không phát hiện bug nghiệp vụ mới cần sửa ngoài phạm vi 9B. Giới hạn phiên JWT bị sao chép chưa thu hồi, storage đọc được bởi JavaScript và rủi ro timing của browser workflow cũ đã ghi ở 9A vẫn giữ nguyên; không tự thay cơ chế xác thực hoặc nới assertion. Seed không có transaction/khóa liên tiến trình; hướng dẫn chỉ chạy một tiến trình và không tự rollback dữ liệu khi lỗi. Thiếu client/dist phải build trước, không tự build khi start server. Những điểm này được ghi rõ trong hướng dẫn vận hành.

Các file thay đổi theo danh sách được duyệt:

| Nhóm | File |
|---|---|
| Mới — seed/reset | server/scripts/demoData.js, seedDemo.js, resetDemo.js; server/tests/demo.test.js |
| Mới — production/client/test | client/src/api/baseUrl.js; server/tests/productionServe.test.js; server/tests-browser/production.mjs |
| Sửa — runtime backend | server/src/app.js, server/src/config/env.js, server/src/sockets/realtimeServer.js |
| Sửa — runtime client | client/src/api/axiosClient.js, client/src/api/publicMenuApi.js, client/src/realtime/socket.js |
| Sửa — script/cấu hình | server/package.json, server/.env.example, client/.env.example; server/tests-browser/orders.mjs, workflow.mjs, realtime.mjs |
| Sửa — tài liệu | README.md và chỉ phần 9B mới trong GIAI_DOAN_9.md |
| Sửa — local không commit | client/.env: để trống VITE_API_BASE_URL |

### Chưa xử lý — bổ sung sau đối chiếu log 9B

1. **[TOOL CHẠY THỦ CÔNG — đối chiếu Docker logs và lịch sử Sleep]** MongoDB ngắt khi Mac vào Sleep: các mốc Sleep 12:20:35/12:59:33 ngày 22/09/2026 trùng sát log client ngắt kết nối 12:20:37/12:59:35 (giờ Việt Nam), container RestartCount=0. Hệ thống tự kết nối lại. Phòng tránh khi demo: không để Mac ngủ.
2. **[TOOL CHẠY THỦ CÔNG — đọc browser test scripts]** Helper Chrome/CDP trùng lặp giữa các browser test script. Chỉ thuộc test, chưa tách dùng chung.

## M. Chưa kiểm tra

- **[CHƯA KIỂM TRA — Henry cần làm]** Điện thoại vật lý, camera quét QR, Safari/iOS/Android, network isolation giữa thiết bị, khóa màn hình/chuyển app/Wi-Fi mất 20 giây thật.
- **[CHƯA KIỂM TRA — Henry cần làm]** Deployment tài khoản thật, HTTPS/WSS, proxy/IP rate limit/log hosting, Atlas và free plan/sleep.
- **[CHƯA KIỂM TRA — Henry cần làm]** Kiểm tra ổn định MongoDB/Docker/mạng khi máy chạy lâu hoặc ngủ/thức; phiên production local có log mất/kết nối lại như mục F, chưa xác định nguyên nhân.
- **[CHƯA KIỂM TRA — Henry cần làm]** Backup/restore thật vào database thử và kiểm chứng dữ liệu khôi phục; chưa seed database demo bền vững của Henry.
- **[CHƯA KIỂM TRA — Henry cần làm]** Tải lớn, trình duyệt khác và những giới hạn/rủi ro đã ghi ở 9A; không coi test hữu hạn là chứng minh không còn mọi lỗi.

## N. Henry cần làm

1. **[CHƯA KIỂM TRA — Henry cần làm]** Trên máy khác, bỏ API localhost trong client/.env nếu còn; file .env.example không tự sửa cấu hình cũ. Giữ secret chỉ ở server.
2. **[CHƯA KIỂM TRA — Henry cần làm]** Chọn database demo riêng, cấu hình DEMO_DB_NAME và hai mật khẩu trong server/.env, seed/check:data rồi restart backend đọc đúng DB. Chỉ reset khi chắc chắn toàn DB đó có thể xóa.
3. **[CHƯA KIỂM TRA — Henry cần làm]** Thực hiện checklist LAN README mục 17; đăng nhập lại từng tab admin/staff và khi đổi origin; Bàn 05 trống, mở lại QR đúng IP tại phòng bảo vệ.
4. **[CHƯA KIỂM TRA — Henry cần làm]** Thử điện thoại Android/iOS thật, khóa màn hình/chuyển app/mất mạng/reload. Tập demo và quay video dự phòng.
5. **[CHƯA KIỂM TRA — Henry cần làm]** Nếu deploy: build client trước, start server sau, xác minh proxy/HTTPS/WSS/free plan nếu dùng; backup và thực hành restore trên DB thử trước thay đổi lớn.

**ĐÃ DỪNG SAU 9B — KHÔNG THỰC HIỆN LẠI 9C.**
