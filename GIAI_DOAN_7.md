# Giai đoạn 7 — Realtime bằng Socket.IO

Đã triển khai và kiểm tra ngày **17/09/2026**, tiếp nối [giai đoạn 6](GIAI_DOAN_6.md).

**Socket.IO chỉ thông báo có dữ liệu thay đổi. API thực hiện nghiệp vụ, MongoDB lưu dữ liệu chính thức.** Không tạo/cập nhật/hủy đơn bằng socket. Giữ toàn bộ quy tắc giá, snapshot, requestId, trackingToken, trạng thái, hủy, thanh toán riêng, conflict 409 và tình trạng bàn của các giai đoạn trước.

## 1. Đã thêm ở đâu?

Thêm `socket.io` vào backend, `socket.io-client` vào frontend. Backend cũng có `socket.io-client` trong **devDependencies** — thư viện chỉ dùng phát triển/kiểm thử — để test bằng kết nối thật. Không có thư viện realtime khác.

`server/src/server.js` tạo **một HTTP server** từ Express rồi gắn Socket.IO lên chính server đó. API và socket cùng cổng `3000`, đường dẫn mặc định socket là `/socket.io/`. Không có backend riêng, Redis, message queue, microservice hoặc adapter nhiều máy.

| File | Mục đích |
|---|---|
| `server/src/sockets/realtimeServer.js` | Khởi tạo Socket.IO, xác thực JWT, join room, kiểm tra token khách, kiểm tra tài khoản đang online |
| `server/src/sockets/notifications.js` | Phát payload nhỏ sau khi lưu; ngắt các socket của một tài khoản; lỗi thông báo không gây lỗi API |
| `server/src/server.js` | Gắn Express/Socket.IO vào cùng server và đóng kết nối khi dừng |
| `server/src/services/orderService.js` | Sau `Order.create` thành công mới gọi thông báo đơn mới |
| `server/src/services/orderWorkflowService.js` | Sau cập nhật có điều kiện thành công mới gọi thông báo thay đổi/hủy |
| `server/src/controllers/authController.js` | Thêm xử lý logout để ngắt các kết nối trong user room |
| `server/src/routes/authRoutes.js` | Thêm `POST /api/auth/logout`, yêu cầu JWT |
| `client/src/realtime/socket.js` | Tạo duy nhất một đối tượng socket cho mỗi tab |
| `client/src/realtime/useSocketSession.js` | Mở/đóng kết nối, chờ xác nhận room sau mỗi connect, xử lý mất mạng và hết phiên |
| `client/src/realtime/useRealtimeRefresh.js` | Nghe event, gom yêu cầu tải lại trong khoảng 300ms, tải lại sau ACK và khi khách quay lại tab |
| `client/src/contexts/StaffRealtimeContext.jsx` | Giữ kết nối và thông báo mới cho toàn khu vực nội bộ |
| `client/src/components/StaffRealtimeBanner.jsx` | Hiện thông báo tên bàn/mã đơn, liên kết mở chi tiết |
| `client/src/components/RealtimeStatus.jsx` | Hiển thị đang kết nối/đã kết nối/mất kết nối |
| `server/tests/realtime.test.js` | 30 test Socket.IO/API với MongoDB thật |
| `server/tests-browser/realtime.mjs` | Kiểm tra nhiều cửa sổ Chrome độc lập, mất mạng, ACK và cập nhật giao diện |

Các trang danh sách/chi tiết đơn của staff/admin, trang bàn và trang khách được nối thêm vào các hook trên. Model MongoDB không thêm trường tình trạng bàn hay collection lưu sự kiện.

## 2. API và Socket.IO khác nhau thế nào?

| Công việc | Thành phần thực hiện |
|---|---|
| Khách tạo đơn, kiểm tra món và tính tiền | `POST /api/public/orders` |
| Nhân viên đổi trạng thái | `PATCH /api/orders/:id/status` |
| Nhân viên hủy đơn | `PATCH /api/orders/:id/cancel` |
| Đọc danh sách/chi tiết/tình trạng bàn | Các GET API hiện có |
| Lưu dữ liệu và lịch sử | MongoDB qua Mongoose |
| Báo các màn hình rằng dữ liệu vừa đổi | Socket.IO |

**Event** là một thông báo có tên. **Emit** là phát thông báo. React không dùng payload để tự quyết định giá, lịch sử hay hành động kế tiếp; khi có event, nó gọi lại API để lấy dữ liệu chính thức.

Nếu chỉ cập nhật từ các event đã nhận, trình duyệt có thể bị thiếu bước do mất mạng. Gọi lại API giúp giao diện trở về đúng dữ liệu đang lưu, kể cả khi bỏ lỡ nhiều thông báo.

## 3. Room là gì?

**Room** là nhóm kết nối mà server chọn để gửi thông báo. Một socket có thể thuộc nhiều room. Client không được tự đặt tên nhóm rồi yêu cầu server cho vào tùy ý. [Tài liệu Socket.IO về room](https://socket.io/docs/v4/rooms/).

| Room | Ai được vào? | Dùng để làm gì? |
|---|---|---|
| `staff` | Staff/admin có JWT hợp lệ và tài khoản đang hoạt động | Nhận thông báo đơn mới, đơn thay đổi và bàn thay đổi |
| `user:<userId>` | Các socket nội bộ của đúng tài khoản đã xác thực | Ngắt tất cả kết nối của tài khoản khi khóa/logout |
| `order:<orderId>` | Khách chứng minh có trackingToken đúng của đơn | Nghe cập nhật của riêng đơn đó |

Tên room không phải bí mật thay thế việc xác thực. Chỉ biết orderId hoặc tên room không cho phép vào room order.

## 4. Staff/admin được xác thực thế nào?

1. Đăng nhập bằng API hiện có, frontend nhận JWT.
2. Socket gửi JWT trong **handshake auth**, tức dữ liệu xác thực khi mở kết nối: `auth: { token }`. Không gửi trong query string hoặc URL.
3. Middleware Socket.IO kiểm tra chữ ký/thời hạn JWT và ID tài khoản.
4. Backend đọc User từ MongoDB, yêu cầu `isActive=true` và role staff/admin.
5. Chính middleware server join `staff` và `user:<userId>`. Không có event client xin join staff.
6. Khi client nhận `connect`, gửi `session:ready` để nhận ACK xác nhận server đã gán room. Event này không cấp quyền hay thay đổi room.
7. Sau ACK hợp lệ, frontend mới thực hiện lần refetch đồng bộ lại màn hình.

**ACK** là câu trả lời xác nhận server đã xử lý yêu cầu. Không có token thì kết nối như khách. Có token sai/hết hạn thì từ chối kết nối, không âm thầm biến thành khách. Vai trò client tự khai không có giá trị. [Tài liệu middleware Socket.IO](https://socket.io/docs/v4/middlewares/).

### Khóa tài khoản đang online và logout

- Server kiểm tra lại các tài khoản có socket nội bộ **mỗi 5 giây**, đồng thời kiểm tra trước khi phát thông báo nghiệp vụ. Không phải chờ nhân viên tự tải lại trang.
- Tài khoản bị khóa/xóa hoặc không còn role nội bộ: `io.in('user:<id>').disconnectSockets(true)` ngắt các socket của tài khoản. JWT hết hạn cũng bị ngắt.
- Chưa có giao diện/API quản lý tài khoản. Bộ test khóa tài khoản bằng cập nhật MongoDB trên dữ liệu thử; lần kiểm tra định kỳ phát hiện thay đổi này.
- **Đăng xuất** xóa phiên frontend, đóng socket tại tab và gọi API `POST /api/auth/logout` bằng JWT đã chụp trước khi xóa. Backend ngắt các socket đang online thuộc cùng user; các tab nội bộ đó nhận server disconnect và xóa phiên. Khách và tài khoản khác không bị ngắt.
- Nếu offline khi logout, tab hiện tại vẫn xóa phiên/đóng socket; server không nhận được yêu cầu nên không thể ngắt ngay các thiết bị khác.

Logout chưa tạo danh sách thu hồi JWT. Token bị sao chép vẫn có thể dùng tới khi hết hạn nếu tài khoản còn hoạt động, như giới hạn xác thực đã nêu ở giai đoạn 3. Việc mới là ngắt các kết nối realtime hiện có. Không thêm hệ thống phiên phức tạp ngoài phạm vi.

## 5. Khách nghe đúng đơn bằng cách nào?

Khách không có User/JWT. Ở `/orders/:orderId`:

1. Đọc trackingToken đã lưu trên chính trình duyệt.
2. Gọi GET đơn với `X-Order-Token` như trước.
3. Chỉ sau khi API đọc đơn thành công mới mở kết nối khách và gửi `order:join` gồm orderId/trackingToken.
4. Server kiểm tra ID, tìm Order, băm/so sánh token bằng cùng hàm `matchesTrackingToken` đang dùng cho API.
5. Đúng token mới join `order:<id>`; server trả ACK `{ ok: true, orderId }`.
6. Client nhận ACK rồi đọc lại API một lần nữa để bù thay đổi xảy ra giữa lần đọc ban đầu và thời điểm vào room.

ID sai định dạng, không tồn tại, token thiếu/sai/của đơn khác đều nhận cùng thông báo **“Không tìm thấy đơn hoặc mã xem đơn không hợp lệ.”** Không crash server hoặc trả chi tiết để dò đơn.

Trang khách không đọc JWT đã lưu từ khu vực nội bộ. TrackingToken chỉ đi trong yêu cầu join trực tiếp đến server và header đọc API; không được broadcast hoặc ghi log. ACK chỉ có kết quả và ID đơn, không trả token. Khi khách đổi trang đơn, kết nối cũ được dọn; server cũng chỉ giữ một order room cho mỗi socket khách khi join một đơn mới hợp lệ.

## 6. Các event đang sử dụng

### Server phát thông báo

| Event | Khi phát | Người nhận | Payload |
|---|---|---|---|
| `order:created` | Đơn mới thực sự được lưu | `staff` | `orderId`, `orderCode`, `tableId`, `tableName` |
| `order:updated` | Cập nhật confirmed/preparing/served/completed thành công | `staff` và `order:<id>` | `orderId`, `status`, `updatedAt` |
| `order:cancelled` | Hủy thành công | `staff` và `order:<id>` | `orderId`, `status`, `updatedAt`, `cancelReason` |
| `table:updated` | Tạo đơn, hoàn thành hoặc hủy đơn thành công | `staff` | `tableId` |

Chọn thống nhất **`order:updated`**, không dùng song song `order:status-updated`. Hủy có event riêng, không phát thêm order:updated cho cùng lần hủy. Room order chỉ nhận payload tối thiểu nêu trên, không nhận tên nhân viên, tổng tiền, món, hash hoặc token.

`table:updated` có nghĩa “dữ liệu bàn có thể đã thay đổi”. Không khẳng định bàn đã trống: frontend vẫn GET `/api/tables` để backend đếm các đơn đang xử lý. Hoàn thành một đơn trong ba đơn cùng bàn vẫn làm số đơn thay đổi nên cần tải lại, dù bàn còn bận.

### Client gửi yêu cầu xác nhận kết nối

| Event | Nội dung | Ý nghĩa |
|---|---|---|
| `session:ready` | `{}` và callback ACK | Xác nhận room nội bộ do middleware gán; khách nhận mode guest, không được nâng quyền |
| `order:join` | `{ orderId, trackingToken }` và callback ACK | Xin nghe một đơn, phải kiểm tra token |

Hai event này chỉ phục vụ kết nối và quyền nhận thông báo. Không có event để khách/nhân viên tạo, đổi trạng thái hoặc hủy order.

## 7. Luồng đơn mới và cập nhật trạng thái

```text
Điện thoại khách
  → POST /api/public/orders
  → backend kiểm tra và tự tính tiền
  → MongoDB lưu Order thành công
  → order:created + table:updated vào staff
  → React gom thông báo khoảng 300ms
  → GET danh sách đơn / GET bàn
  → hiển thị dữ liệu mới và thông báo đơn mới
```

Danh sách gọi lại API với **đúng bộ lọc và trang hiện tại**, không tự chèn đơn vào đầu mọi danh sách. Ví dụ đang lọc completed thì đơn pending mới chỉ hiện thông báo, không chui vào danh sách completed. Nếu ở trang 2, frontend tải lại trang 2 theo cách sắp xếp của API.

Thông báo trực quan hiển thị tên bàn và mã đơn, bấm mở được chi tiết. Giữ tối đa 5 thông báo gần nhất và nhớ 100 ID gần nhất để tránh lặp cùng đơn trong phiên. Có nút ẩn thông báo. Chưa thêm âm thanh, push notification hoặc Firebase.

```text
Staff A
  → PATCH API với expectedStatus
  → backend kiểm tra quyền, bước chuyển và trạng thái hiện tại
  → MongoDB cập nhật trạng thái + lịch sử + thông tin liên quan
  → order:updated hoặc order:cancelled
  → khách và staff B nhận thông báo
  → GET chi tiết đơn mới nhất
```

Staff B chỉ tải lại dữ liệu; không tự thực hiện bước tiếp theo. Hộp xác nhận cũ được đóng khi tải lại để tránh thao tác nhầm. Nếu đang có PATCH chờ phản hồi, frontend chờ thao tác đó kết thúc rồi tải lại. Điều kiện MongoDB và lỗi **409** của giai đoạn 6 vẫn giữ nguyên.

Khách thấy trạng thái hoặc lý do hủy từ GET có `X-Order-Token`. Nút làm mới vẫn được giữ để dùng khi cần.

## 8. Sau khi lưu mới emit, gửi lại không thông báo trùng

`notifyOrderCreated` chỉ nằm trong nhánh ngay sau `await Order.create(...)` thành công. Các nhánh trả kết quả requestId cũ không đi qua lệnh này, kể cả khi nhiều request giống nhau đến đồng thời. Vì vậy API trả đơn cũ không tạo thông báo “đơn mới” lần hai.

Đổi trạng thái dùng chính kết quả `findOneAndUpdate` có điều kiện vừa ghi thành công để tạo payload. Nếu lỗi validation, 409 hoặc ghi MongoDB thất bại thì không gọi thông báo thành công. Không phát trước khi MongoDB xác nhận ghi xong.

Module thông báo có `try/catch`. Khi emit lỗi, chỉ ghi thông báo chung không chứa dữ liệu nhạy cảm; API vẫn trả kết quả lưu thành công. Nếu io chưa khởi tạo thì **no-op**, nghĩa là hàm không làm gì. Nhờ đó 127 test API cũ dùng Express riêng vẫn chạy nguyên vẹn, không cần tạo socket hoặc sửa test.

Đây là thông báo theo khả năng kết nối hiện tại, không phải hàng đợi đảm bảo phát lại. Nếu tiến trình dừng ngay sau khi ghi DB nhưng trước khi emit, đơn vẫn tồn tại; các màn hình lấy lại qua API khi reconnect hoặc làm mới. Không thêm cơ chế phát lại/queue trong giai đoạn này.

## 9. Mất mạng và reconnect

Sau **mọi** `connect`, gồm cả lần đầu và kết nối lại:

**Kết nối → join lại room → chờ ACK → refetch API.**

- Staff: handshake JWT chạy lại; server tự join staff/user; client đợi ACK của session:ready rồi tải lại màn hình đơn/bàn đang mở.
- Khách: gửi lại order:join với ID/token, đợi ACK rồi GET đơn. Không giả định room cũ còn tồn tại.
- Nếu không nhận ACK trong 5 giây, trạng thái realtime báo gián đoạn và thử join lại sau 3 giây nếu transport còn kết nối. ACK cũ từ lần kết nối hoặc màn hình đã bị dọn không được dùng.
- Mất mạng thông thường: Socket.IO tự thử kết nối lại. Các nút API không bị khóa chỉ vì socket offline.
- Khách quay lại tab có `visibilitychange` và trạng thái visible thì tải lại đơn, kể cả socket đang offline. Điều này giúp tab ngủ lâu lấy được dữ liệu mới.

**Ví dụ:** khách đang thấy pending, mất Wi-Fi; staff xác nhận rồi chuẩn bị. Khi có mạng lại, client vào lại room trước, sau đó GET thấy preparing. Không cần nhận lại từng event confirmed đã bỏ lỡ. Socket.IO báo nhanh, API và MongoDB xác định trạng thái đúng.

Ban đầu trang vẫn gọi API độc lập để hiển thị dữ liệu; việc socket chưa kết nối không chặn API. Lần tải lại do connect/reconnect luôn nằm sau ACK. Không dùng `connectionStateRecovery` để thay việc đọc lại dữ liệu.

## 10. Không nhân listener

**Listener** là hàm chờ nhận sự kiện. **Singleton** là chỉ có một đối tượng dùng chung: `socket.js` tạo một socket mỗi tab, các component dùng lại.

Provider nội bộ sở hữu kết nối khi đã đăng nhập. Trang theo dõi đơn khách sở hữu kết nối ở khu vực khách. Hai khu vực nằm ở các nhánh route khác nhau. Menu/giỏ không cần mở socket để gửi order, vì tạo đơn vẫn là API.

Mỗi listener đăng ký bằng `on(event, handler)` đều được gỡ bằng `off(event, handler)` đúng hàm. Dọn cả timer debounce, listener visibilitychange và kết nối khi rời khu vực. Không gọi `off(event)` thiếu handler vì có thể xóa listener của component khác.

**Debounce** là gom các thông báo đến sát nhau thành một lần tải lại sau khoảng 300ms. Hook giữ hàm refresh mới nhất để dùng đúng ID/bộ lọc hiện tại, không giữ dữ liệu của trang cũ.

## 11. Bảo mật và giới hạn triển khai

- JWT kiểm tra tại handshake, không lấy quyền từ role frontend gửi. Đọc lại trạng thái tài khoản khi online như mục 4.
- Order room phải kiểm tra hash trackingToken, cùng cơ chế với GET đơn. Biết tên khách, QR hoặc orderCode không đủ quyền nghe.
- Không log JWT, trackingToken, handshake auth, body join hoặc payload nhạy cảm. Payload broadcast được chọn rõ từng trường.
- CORS Socket.IO dùng cùng `CLIENT_ORIGIN` với Express. `allowRequest` kiểm tra Origin cho cả WebSocket; công cụ Node không có Origin vẫn phải vượt qua các bước xác thực room.
- Giới hạn gói socket 16KB, không dùng socket để gửi ảnh hoặc toàn bộ giỏ.
- API nội bộ vẫn kiểm tra JWT, vai trò và expectedStatus cho từng thao tác. Socket không thay thế phân quyền API.
- Khi triển khai qua Internet, dùng HTTPS/WSS; không đưa secret vào biến `VITE_`.

**Chỉ chạy một instance Node.js.** Room nằm trong bộ nhớ tiến trình. Muốn chạy nhiều instance cần adapter phù hợp để phân phối thông báo giữa các tiến trình; ngoài phạm vi giai đoạn này. Không cài Redis adapter.

Chưa làm dashboard, thống kê doanh thu/món bán chạy, biểu đồ, kho, thanh toán online hoặc gộp hóa đơn. Thông báo bàn trong giai đoạn này gắn với nghiệp vụ order; không thêm realtime sửa danh mục/món.

## 12. Kết quả kiểm thử thực tế

| Kiểm tra | Kết quả ngày 17/09/2026 |
|---|---|
| Toàn bộ backend | **157/157 pass**, 0 fail/skipped/cancelled |
| Test API cũ | **127/127 pass, không sửa các file test cũ** |
| Test Socket.IO mới | **30/30 pass** |
| Frontend build | Thành công |
| MongoDB | Kết nối, ping, ghi/đọc thành công |
| Chrome giai đoạn 5 | Toàn bộ script giỏ/đơn chạy lại thành công |
| Chrome giai đoạn 6 | Toàn bộ script xử lý đơn/bàn chạy lại thành công |
| Chrome realtime | Thành công với 4 browser context độc lập |
| Giao diện 375px | Không tràn ngang trong các màn hình đã kiểm tra |
| JavaScript | Không phát hiện lỗi chưa được xử lý trong các luồng Chrome đã chạy |

30 test mới kiểm tra các nhóm:

- Staff/admin JWT hợp lệ vào staff/user room và nhận ACK; không token kết nối khách; tự khai role/xin staff không có tác dụng; JWT sai/sai kiểu/hết hạn, tài khoản khóa bị từ chối; JWT trong query không cấp quyền.
- Khách token đúng join được, sai/thiếu/token đơn khác/ID sai/ID không tồn tại cùng bị từ chối; đổi sang đơn được cấp quyền thì rời room cũ.
- Đơn mới phát cho staff/admin, lỗi tạo không phát, requestId gửi lại hoặc 5 request đồng thời chỉ phát một lần.
- Giữ lệnh tạo/cập nhật MongoDB bằng một điểm chờ trong test: trước khi cho ghi, không có event; ghi xong mới có event. Lỗi ghi DB không phát thành công giả.
- Đủ bốn bước trạng thái, hủy và table:updated; đúng khách nhận, khách đơn khác không nhận; payload không lộ các trường bí mật.
- 400/409 không phát cập nhật; cố tạo/đổi/hủy qua socket không làm MongoDB thay đổi; giả lập emit ném lỗi thì API vẫn tạo/cập nhật/hủy thành công.
- Khóa tài khoản đang online ngắt các socket cùng user; logout ngắt user nhưng giữ khách/tài khoản khác; JWT hết hạn đang online cũng bị ngắt.
- Reconnect có socket ID mới, join lại và vẫn nhận event; CORS đúng frontend, Origin khác bị chặn.

Chrome đã thao tác thật:

1. Cửa sổ khách nhập tên, thêm món/giỏ/gửi; staff tự thấy đơn và đúng một thông báo; màn hình bàn tự bận.
2. Staff A đi đủ confirmed/preparing/served/completed; khách và staff B tự cập nhật; bàn tự trống.
3. Đặt đơn khác và hủy; khách tự thấy cancelled và lý do.
4. Ngắt mạng khách, staff đổi hai bước; mở mạng, xác nhận bằng lưu vết trình duyệt rằng **ACK room đi trước GET refetch**, rồi khách thấy dữ liệu đúng.
5. Tắt riêng socket staff B: dữ liệu cũ vẫn nhận 409, API tải lại và hoàn thành đơn được; reconnect staff cũng ACK trước refetch.
6. Tắt socket khách: nút làm mới và visibilitychange vẫn đọc API đúng.
7. Chuyển trang nhiều lần rồi tải lại; số listener không tăng, một đơn chỉ có một thông báo; bộ lọc completed không lẫn pending và giữ tham số phân trang.
8. Khóa tài khoản online dẫn đến ngắt socket/xóa phiên giao diện; logout đóng socket.

Script sử dụng Chrome thật với các **browser context** tách biệt — vùng trình duyệt có storage/phiên độc lập — tương đương thử trên nhiều phiên người dùng, không dùng chung token giữa khách và staff. Chưa quét bằng điện thoại vật lý trong lần kiểm tra này; mobile được kiểm tra với khung 375px trên Chrome.

Backend tests dùng database riêng hậu tố ngẫu nhiên và tự dọn. Chrome tests tạo tài khoản/danh mục/món/bàn/đơn thử trong database local rồi chỉ xóa các ID của lần thử. Không để lại hoặc sửa dữ liệu demo có sẵn. Ảnh kiểm tra tại `/private/tmp/restaurant-qr-stage7-guest-mobile.png`, không có token/mật khẩu. Log kiểm tra trình tự ACK chỉ lưu tên event/loại request, không lưu frame chứa secret; có kiểm tra cả polling lẫn WebSocket.

## 13. Cách chạy và cấu hình

Nếu vừa lấy source về, cài đúng phiên bản trong lockfile:

```bash
npm --prefix server ci
npm --prefix client ci
```

Không thêm biến `.env`. Giữ `CLIENT_ORIGIN`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `ORDER_TOKEN_SECRET`, `PUBLIC_APP_URL` ở server; `VITE_API_BASE_URL` ở client. Socket lấy địa chỉ gốc từ VITE_API_BASE_URL: ví dụ `http://localhost:3000/api` → socket `http://localhost:3000`. Không chép đè `.env` đã cấu hình bằng file mẫu.

Từ gốc project:

```bash
docker compose up -d mongodb
```

Backend và frontend ở hai terminal:

```bash
npm --prefix server run dev
```

```bash
npm --prefix client run dev
```

Mở **http://localhost:5174**. Nếu đã chạy thì không mở thêm server trùng cổng. Khi dùng điện thoại trong LAN, thay địa chỉ frontend/backend bằng IP máy theo [giai đoạn 4](GIAI_DOAN_4.md); socket tự dùng địa chỉ backend mới.

Kiểm tra lại:

```bash
npm --prefix server test
npm --prefix client run build
npm --prefix server run check:db
```

Chrome test trên macOS cần frontend/backend đang chạy. Mở Chrome kiểm thử riêng:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-first-run --no-default-browser-check --remote-debugging-port=9224 --user-data-dir=/private/tmp/restaurant-qr-browser-check about:blank
```

Sau đó chạy lần lượt:

```bash
npm --prefix server run test:browser:orders
npm --prefix server run test:browser:workflow
npm --prefix server run test:browser:realtime
```

Các script dùng giao thức điều khiển Chrome qua WebSocket có sẵn của Node, không cần Playwright. `CHROME_DEBUG_URL` có thể đặt nếu đổi địa chỉ debug. Cổng debug chỉ dùng trên máy phát triển; dừng Chrome bằng Ctrl+C sau khi thử.

## 14. Cách tự demo realtime

1. Chạy hệ thống, chuẩn bị món/bàn và tài khoản staff/admin như các giai đoạn trước.
2. Cửa sổ A là khách: mở QR bàn, nhập tên. Cửa sổ B đăng nhập staff, mở `/staff/orders`. Dùng trình duyệt/cửa sổ riêng tư hoặc profile riêng để tách phiên.
3. Khách chọn món, gửi order. Không bấm F5 ở staff: thấy thông báo **Bàn … có đơn mới** và danh sách tự tải. Nếu đang lọc completed thì chỉ có thông báo; chuyển sang đang xử lý để thấy đơn mới.
4. Mở trang đơn khách. Chờ nhãn **Đã kết nối realtime**. Staff lần lượt xác nhận, chuẩn bị, phục vụ: khách tự thấy trạng thái mới.
5. Staff xác nhận đã nhận tiền và hoàn thành. Mở thêm `/staff/tables` hoặc `/admin/tables` ở cửa sổ khác: bàn tự về trống nếu không còn đơn khác.
6. Khách đặt thêm đơn. Staff hủy lúc pending/confirmed, nhập lý do. Khách tự thấy Đã hủy và lý do.
7. Mở cùng một đơn ở hai phiên staff. A cập nhật, B tự thấy dữ liệu mới; không có bước tự xác nhận tiếp.
8. Ở DevTools của cửa sổ khách chọn Network → Offline, để Socket.IO phát hiện ngắt; staff đổi trạng thái. Chuyển Online, chờ nối lại: khách vào lại room rồi lấy đúng trạng thái qua API. Script tự động đóng transport thêm để không phải đợi heartbeat trong lúc thử.
9. Chuyển qua lại trang đơn/bàn nhiều lần, đặt thêm một đơn: chỉ một thông báo cho mã đó. Thử bộ lọc hoặc trang 2 để chứng minh dữ liệu vẫn do API quyết định.
10. Giữ nút làm mới để demo phương án dự phòng khi realtime không hoạt động. Dùng bộ test để minh họa ID/token sai, emit lỗi và 409 chính xác hơn thao tác tay.

## 15. Những câu nên giải thích được khi bảo vệ

- Vì sao API và Socket.IO có hai nhiệm vụ khác nhau? Vì sao MongoDB vẫn là nguồn chính thức?
- Vì sao room phải do backend kiểm tra quyền, không tin tên nhóm/role tự gửi?
- Vì sao khách không đăng nhập nhưng vẫn phải chứng minh quyền nghe từng đơn?
- Vì sao thông báo đơn mới phải nằm sau khi lưu, và requestId cũ không phát lại?
- Vì sao nối lại phải join/ACK trước rồi đọc lại API, thay vì tin các event đã nhận?
- Vì sao có realtime vẫn cần expectedStatus và lỗi 409?
- Vì sao phải gỡ đúng listener và chỉ tạo một socket mỗi tab?
- Vì sao phiên bản một instance chưa cần adapter, còn nhiều instance thì cần?

Tham khảo thêm: [Socket.IO Server API](https://socket.io/docs/v4/server-api/) về gắn HTTP server và disconnectSockets; [Client options](https://socket.io/docs/v4/client-options/) về auth và kết nối lại.
