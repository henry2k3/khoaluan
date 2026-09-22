# Giai đoạn 6 — Nhân viên xử lý đơn và theo dõi tình trạng bàn

Đã triển khai và kiểm tra ngày **17/09/2026**. Giai đoạn này nối tiếp [GIAI_DOAN_5.md](GIAI_DOAN_5.md); thiết kế tổng thể tại [PHAN_TICH_VA_THIET_KE_HE_THONG.md](PHAN_TICH_VA_THIET_KE_HE_THONG.md).

Luồng chạy được: **khách gửi đơn → nhân viên xem danh sách → xác nhận → chuẩn bị → phục vụ → xác nhận đã nhận tiền → hoàn thành**. Có nhánh hủy khi chờ/đã xác nhận. Mỗi đơn được xử lý riêng; bàn có thể có nhiều đơn đồng thời.

Mọi nghiệp vụ dùng API. Chưa thêm Socket.IO, thông báo/âm thanh realtime, dashboard, biểu đồ, thống kê món bán chạy, thanh toán online, kho hoặc gộp hóa đơn. Không cài thêm thư viện chạy ứng dụng.

## 1. Đã tạo và sửa những gì?

| File/thư mục | Vai trò |
|---|---|
| `server/src/models/Order.js` | Thêm ngày thanh toán, thông tin hủy và chỉ mục phục vụ danh sách |
| `server/src/utils/orderStatus.js` | Một nơi khai báo sáu trạng thái, các bước hợp lệ và bốn trạng thái làm bàn bận |
| `server/src/utils/internalOrderValidation.js` | Kiểm tra bộ lọc, phân trang, trạng thái nguồn/đích, lý do hủy |
| `server/src/services/orderWorkflowService.js` | Đọc chi tiết nội bộ; kiểm tra và cập nhật đơn có điều kiện |
| `server/src/controllers/orderController.js` | Nhận yêu cầu danh sách/chi tiết/cập nhật/hủy và trả JSON |
| `server/src/routes/orderRoutes.js` | Bốn API order có JWT và quyền staff/admin |
| `server/src/controllers/tableController.js` | Đếm đơn đang xử lý theo bàn khi đọc danh sách |
| `server/src/routes/catalogRoutes.js` | Mở quyền đọc bàn cho staff, giữ các quyền quản lý chỉ cho admin |
| `server/src/controllers/publicOrderController.js` | Khách đọc thêm ngày thanh toán và thông tin hủy bằng token cũ |
| `client/src/api/orderApi.js` | Axios gọi API nội bộ, gửi JWT và trạng thái đang hiển thị |
| `client/src/pages/staff/OrdersPage.jsx` | Danh sách, bộ lọc, phân trang, làm mới; dùng chung cho admin |
| `client/src/pages/staff/OrderDetailPage.jsx` | Chi tiết, hành động, hộp xác nhận hủy/thanh toán, xử lý xung đột |
| `client/src/pages/staff/TableStatusPage.jsx` | Bàn trống/bận, số đơn và liên kết lọc đơn của bàn |
| `client/src/components/OrderSummary.jsx` | Chi tiết món, ghi chú, tiền, lịch sử; dùng chung khách/staff/admin |
| `client/src/components/OrderStatusBadge.jsx` | Nhãn và màu trạng thái đơn |
| `client/src/components/TableOccupancy.jsx` | Nhãn tình trạng bàn và số đơn đang xử lý |
| `client/src/utils/orderDisplay.js` | Tên trạng thái/nút tiếng Việt và định dạng thời gian |
| `client/src/layouts/StaffLayout.jsx` | Điều hướng tài khoản, đơn hàng, tình trạng bàn |
| `client/src/routes/AppRoutes.jsx` | Gắn các đường dẫn và bảo vệ khu vực nội bộ |
| `server/tests/orderWorkflow.test.js` | 62 test API và MongoDB thật cho nghiệp vụ mới |
| `server/tests-browser/workflow.mjs` | Kiểm thử luồng mới trên Chrome thật |

Admin dùng lại hai trang đơn của staff, truyền đường dẫn `/admin/orders` để liên kết quay lại đúng khu vực. Không có hai bản triển khai nghiệp vụ giống nhau. `useAdminData` được dùng lại cho danh sách nội bộ; tên hook có từ giai đoạn 4, không phải nơi quyết định quyền.

## 2. Trạng thái và lý do phải xử lý đúng thứ tự

| Trạng thái hiện tại | Hiển thị | Được chuyển tới |
|---|---|---|
| `pending` | Chờ xác nhận | `confirmed`, `cancelled` |
| `confirmed` | Đã xác nhận | `preparing`, `cancelled` |
| `preparing` | Đang chuẩn bị | `served` |
| `served` | Đã phục vụ | `completed` |
| `completed` | Hoàn thành | Không có |
| `cancelled` | Đã hủy | Không có |

Không cho bỏ qua bước vì các trạng thái phản ánh những việc thực tế khác nhau. Ví dụ, xác nhận tiếp nhận đơn không đồng nghĩa đã phục vụ hay đã nhận tiền. Bước sai trả lỗi `400`, không đổi đơn và không thêm lịch sử.

Backend giữ bảng quy tắc và kiểm tra trước khi ghi. Chi tiết nội bộ trả `allowedTransitions`, tức **danh sách bước được phép**, để React hiện nút tương ứng. Người dùng tự sửa frontend hoặc gọi API thủ công vẫn không thể bỏ qua kiểm tra backend.

`cancelled` phải đi qua API hủy có lý do; API đổi trạng thái thông thường không nhận đích này. Không có API mở lại, sửa món, sửa tiền hoặc xóa đơn trong giai đoạn này.

## 3. Order và lịch sử trạng thái

Giữ nguyên dữ liệu giai đoạn 5: mã đơn, tên khách, ID/tên bàn, danh sách món có tên/giá chụp tại lúc đặt, số lượng, ghi chú, thành tiền từng dòng, tổng tiền, mã bảo vệ đã băm, mã chống gửi trùng, thời gian tạo/cập nhật.

Các trường mới:

| Trường | Kiểu, mặc định | Ý nghĩa |
|---|---|---|
| `paidAt` | Date, `null` | Lúc nhân viên xác nhận đã nhận tiền cho đơn |
| `cancelReason` | String, `""` | Lý do hủy, bỏ khoảng trắng đầu/cuối, 1–1000 ký tự khi hủy |
| `cancelledAt` | Date, `null` | Lúc backend xử lý hủy |
| `cancelledBy` | ObjectId tham chiếu User, `null` | ID staff/admin đã đăng nhập và thực hiện hủy |

Mỗi lần đổi trạng thái thêm một phần tử vào `statusHistory`:

```json
[
  { "status": "pending", "changedAt": "2026-09-17T02:00:00.000Z", "changedBy": null },
  { "status": "confirmed", "changedAt": "2026-09-17T02:01:00.000Z", "changedBy": "<ID nhân viên>" }
]
```

Ví dụ trên minh họa định dạng JSON; ID thật là ObjectId MongoDB. Khách tạo pending nên người thực hiện để trống. Các bước nội bộ lấy ID từ tài khoản đã được backend xác thực, không lấy từ body frontend. Thời gian do server tạo, MongoDB lưu theo UTC; giao diện hiển thị giờ Việt Nam.

**Lịch sử giúp trả lời: đơn đi qua bước nào, lúc nào, do ai làm?** API nội bộ đọc thêm họ tên/tên đăng nhập từ User để dễ xem. MongoDB giữ ID gốc; tên hiển thị là tên hiện tại của tài khoản, chưa lưu bản chụp tên nhân viên. Nếu tài khoản không còn, giao diện báo rõ. Khách không được hiển thị tên tài khoản nội bộ.

Các đơn pending đã lưu từ giai đoạn 5 tiếp tục xử lý được. Không phải tạo lại dữ liệu hoặc xóa database; các trường mới chưa có được xem là chưa thanh toán/chưa hủy.

## 4. Hoàn thành và thanh toán

`completed` nghĩa là **đã phục vụ và nhân viên xác nhận đã nhận đủ tiền**. Chỉ chuyển từ `served`.

Giao diện mở hộp xác nhận, ghi rõ mã đơn/số tiền và yêu cầu đánh dấu đã nhận tiền. Sau đó backend cập nhật đồng thời status, `paidAt` và lịch sử bước completed. Người xác nhận thanh toán nằm ở `statusHistory.changedBy` của bước này; không cần trường `paidBy` riêng.

Đây là ghi nhận thanh toán do nhân viên xác nhận, không kiểm chứng giao dịch ngân hàng. Mỗi order hoàn thành riêng. Hoàn thành order A không thanh toán order B dù cùng bàn. Đơn completed không đổi tiếp, nên thao tác lặp không ghi đè thời điểm thanh toán.

Quy tắc doanh thu đã chốt vẫn là chỉ tính đơn completed theo `paidAt`. Giai đoạn 6 chưa tạo API thống kê/doanh thu nên chưa có số liệu doanh thu để kiểm thử.

## 5. Hủy đơn và giữ lịch sử

Staff/admin mở đơn pending hoặc confirmed, bấm **Hủy đơn**, nhập lý do rồi xác nhận. Backend kiểm tra trạng thái và lưu `cancelled`, lý do, thời gian, ID người hủy và một dòng lịch sử trong cùng lần ghi.

Đơn preparing/served/completed/cancelled không có nút hủy; API cũng từ chối. Không cho dùng API status để hủy mà thiếu lý do.

Không xóa đơn hủy vì cần tra cứu khách đã gọi gì, số tiền trước khi hủy, nguyên nhân, thời gian và người thực hiện. Đơn hủy vẫn có trong bộ lọc lịch sử và khách vẫn đọc được bằng token đúng. Nó không giữ bàn bận, không có `paidAt` và không đủ điều kiện tính doanh thu.

## 6. Hai nhân viên cùng xử lý thì sao?

Frontend gửi thêm `expectedStatus`, nghĩa là **trạng thái nhân viên đang nhìn thấy lúc bấm**.

Ví dụ A và B đều đang thấy pending:

1. A gửi `expectedStatus=pending`, đích `confirmed`.
2. Backend kiểm tra và ghi nếu đơn trong MongoDB vẫn là pending.
3. A thành công; MongoDB đã chuyển confirmed.
4. B gửi yêu cầu cũ với `expectedStatus=pending`: điều kiện không khớp, backend trả **409 Conflict**, nghĩa là dữ liệu đã thay đổi.
5. Màn hình B hiện lỗi, tải lại chi tiết mới nhất và chỉ cho thao tác tiếp sau khi tải xong. Không tự xác nhận thêm bước nữa.

Điều kiện quan trọng nằm **ngay trong câu lệnh ghi**, không chỉ kiểm tra ở lần đọc trước đó:

```js
Order.findOneAndUpdate(
  { _id: id, status: change.expectedStatus },
  { $set: changes, $push: { statusHistory: historyEntry } },
  { returnDocument: 'after', runValidators: true },
);
```

Đoạn trên minh họa cách ghi; code đầy đủ nằm trong service. `changes` chứa status và ngày thanh toán hoặc thông tin hủy. `$push` thêm một dòng lịch sử. **Cập nhật nguyên tử** nghĩa là các thay đổi trong một document Order được ghi cùng nhau; không có trạng thái hủy mà lịch sử/người hủy chỉ được ghi một nửa. MongoDB hỗ trợ cách kiểm tra giá trị hiện tại trong bộ lọc của cập nhật một document. [Tài liệu MongoDB về tính nguyên tử](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

Không cần thêm Redis, collection khóa hoặc giao dịch nhiều document. Cách dùng `findOneAndUpdate` và trả dữ liệu sau cập nhật được mô tả trong [tài liệu Mongoose](https://mongoosejs.com/docs/tutorials/findoneandupdate.html).

Nếu mất phản hồi hoặc lỗi máy chủ 5xx sau khi bấm, frontend cũng tải lại đơn trước khi cho xử lý tiếp; không tự gửi lại thao tác. Nếu đã đổi trạng thái thì hiển thị kết quả mới, nếu chưa đổi thì nhân viên có thể kiểm tra và thao tác lại.

## 7. Tình trạng bàn được tính thế nào?

Không thêm trường status vào Table. Khi gọi `GET /api/tables`, backend đếm Order theo tableId và chỉ lấy bốn trạng thái:

**pending + confirmed + preparing + served**.

Số đơn lớn hơn 0 → `occupancy=occupied` (**Đang sử dụng**). Bằng 0 → `occupancy=empty` (**Trống**). `activeOrderCount` là số đơn đang xử lý, không phải số món hay số khách.

| Các đơn của một bàn | Số đang xử lý | Tình trạng |
|---|---:|---|
| Chưa có đơn | 0 | Trống |
| A completed, B preparing | 1 | Đang sử dụng |
| A completed, B served | 1 | Đang sử dụng, còn chờ thanh toán B |
| A completed, B completed | 0 | Trống |
| A cancelled, B pending | 1 | Đang sử dụng |
| A cancelled, B cancelled | 0 | Trống |

`isActive` có nghĩa khác: bàn có nhận **đơn mới** hay không. Admin vẫn được bật/tắt bàn như giai đoạn 4. Tắt bàn không hủy các đơn đã tồn tại; bàn tắt vẫn hiện bận nếu còn đơn và nhân viên vẫn xử lý/thu tiền các đơn đó. Staff chỉ đọc bàn, không sửa hoặc lấy QR quản trị.

Tình trạng phản ánh dữ liệu lúc gọi API. Sau thao tác ở màn hình khác, bấm **Làm mới bàn**. “Trống” là không còn đơn đang xử lý, không phải xác nhận vật lý khách đã rời bàn.

## 8. Những API mới và thay đổi

Tất cả API nội bộ dưới đây cần `Authorization: Bearer <JWT>` của staff/admin. Backend kiểm tra tài khoản còn hoạt động và quyền hiện tại. Token khách hoặc chỉ biết ID order không cấp quyền vào API nội bộ.

| Method và URL | Nội dung |
|---|---|
| `GET /api/orders` | Danh sách tóm tắt và thông tin phân trang |
| `GET /api/orders/:id` | Chi tiết món/tiền/ghi chú, lịch sử/người xử lý, thanh toán/hủy, `allowedTransitions` |
| `PATCH /api/orders/:id/status` | Đổi sang bước kế tiếp; body có `expectedStatus` và `status` |
| `PATCH /api/orders/:id/cancel` | Hủy; body có `expectedStatus` và `cancelReason` |
| `GET /api/tables` — mở rộng | Staff/admin xem bàn, `occupancy`, `activeOrderCount`; staff không nhận qrToken |
| `GET /api/public/orders/:id` — giữ bảo vệ cũ | Khách dùng `X-Order-Token`; nhận thêm ngày thanh toán, lý do/thời gian hủy |

Danh sách nhận các tham số tùy chọn:

| Tham số | Giá trị |
|---|---|
| `page` | Số nguyên 1–100000, mặc định 1 |
| `limit` | Số nguyên 1–50, mặc định 20 |
| `status` | Một trong sáu trạng thái, hoặc `active` cho bốn trạng thái đang xử lý |
| `tableId` | ObjectId của bàn |
| `date` | Ngày đặt dạng YYYY-MM-DD, từ 00:00 đến trước 00:00 hôm sau theo giờ Việt Nam |
| `orderCode` | Mã hoặc phần đầu mã, tối đa 40 ký tự chữ/số/gạch ngang; chuẩn hóa chữ hoa |

Ví dụ: `GET /api/orders?status=active&page=1&limit=20&tableId=<ID bàn>`. API mặc định lấy mọi trạng thái, sắp mới nhất trước. Giao diện mặc định gửi `status=active` để ưu tiên đơn cần xử lý; chọn **Tất cả trạng thái** sẽ bỏ tham số status khi gọi API.

Phản hồi danh sách: `data.orders` là các đơn trên trang; `data.pagination` có `page`, `limit`, `total`, `totalPages`. Trang vượt dữ liệu trả danh sách rỗng; tổng trang API là 0 nếu không có đơn, giao diện hiển thị tối thiểu 1 để dễ đọc. Không tải toàn bộ lịch sử một lần.

Body xác nhận:

```json
{ "expectedStatus": "pending", "status": "confirmed" }
```

Body hủy:

```json
{ "expectedStatus": "confirmed", "cancelReason": "Khách đổi ý trước khi chế biến" }
```

Không nhận từ frontend: người thực hiện, paidAt, cancelledAt, tiền hay statusHistory. Thiếu/sai dữ liệu hoặc bước chuyển trả `400`; chưa đăng nhập `401`; thiếu quyền `403`; ID không tồn tại `404`; dữ liệu trạng thái đã cũ `409`. Riêng API khách tiếp tục dùng cùng lỗi `404` cho thiếu/sai token hoặc không có đơn, tránh lộ sự tồn tại đơn.

API trả danh sách/chi tiết nội bộ không trả token, hash, nonce hay mã chống gửi trùng. Các API order nội bộ và đọc tình trạng bàn dùng `Cache-Control: no-store` để trình duyệt không dùng lại kết quả cũ từ bộ nhớ đệm.

## 9. Các màn hình

- `/staff/orders`: bộ lọc trạng thái/bàn/ngày/mã, giới hạn trang, danh sách và nút làm mới.
- `/staff/orders/:id`: chi tiết, lịch sử, các nút đúng bước; xác nhận riêng khi hủy hoặc nhận tiền.
- `/staff/tables`: tình trạng và số đơn đang xử lý; bấm xem đơn sẽ lọc đúng bàn.
- `/admin/orders`, `/admin/orders/:id`: dùng lại màn hình xử lý đơn.
- `/admin/tables`: giữ form bàn/QR, thêm tình trạng và liên kết đơn đang xử lý.
- `/orders/:orderId`: khách nhấn **Làm mới trạng thái** để thấy thay đổi, lịch sử và thông tin thanh toán/hủy; giữ `X-Order-Token`.

Các trang có loading (đang tải), thông báo lỗi/thử lại và dữ liệu rỗng. Khi tải lại chi tiết hoặc gặp xung đột, các hành động trên dữ liệu cũ được gỡ khỏi màn hình. Giao diện ưu tiên điện thoại, các khối và nút xuống dòng khi cần.

## 10. Kết quả kiểm thử thực tế

| Kiểm tra | Kết quả ngày 17/09/2026 |
|---|---|
| Toàn bộ backend | **127/127 pass**, 0 fail, 0 skipped, 0 cancelled |
| Phân nhóm backend | 12 auth + 17 catalog + 36 tạo/xem order + 62 vận hành đơn/bàn |
| Frontend build | Thành công |
| MongoDB | Kết nối, ping, ghi và đọc thành công |
| Chrome giai đoạn 5 | Toàn bộ script giỏ/đơn chạy lại thành công |
| Chrome giai đoạn 6 | Toàn bộ script xử lý đơn/bàn thành công |
| Mobile 375px | Không tràn ngang ở danh sách, chi tiết, hộp hủy/thanh toán, bàn, trang khách đã kiểm tra |
| Lỗi JavaScript chưa xử lý | Không phát hiện trong các luồng Chrome đã chạy |

Backend mới kiểm tra:

- Staff/admin đọc được; không đăng nhập, token khách hoặc JWT không thuộc User nội bộ bị từ chối. Staff vẫn không quản lý món/danh mục hay sửa bàn.
- Ma trận **30 trường hợp chuyển trạng thái** và **6 trường hợp hủy từ từng trạng thái**; dữ liệu không thay đổi khi bị từ chối.
- Bắt buộc lý do và trạng thái nguồn; từ chối giả ID người xử lý, thời gian, tiền và lịch sử. Ghi đúng paidAt/cancelledAt/cancelledBy và lịch sử có tài khoản qua đủ luồng.
- Sáu trạng thái ảnh hưởng bàn đúng; bàn chưa có đơn, nhiều đơn, một đơn xong nhưng còn đơn khác; tất cả xong thì trống; bàn tắt có đơn tồn đọng; không ghi tình trạng vào Table.
- Hai nhân viên xác nhận đồng thời chỉ một thành công; thao tác cũ dù đích có vẻ hợp lệ cũng bị 409; chuẩn bị và hủy cùng lúc không ghi dữ liệu chồng chéo; hoàn thành lặp không đổi paidAt/lịch sử.
- Phân trang, thứ tự, trang rỗng, giới hạn, lọc trạng thái/bàn/nhóm active, ranh giới ngày Việt Nam, tìm mã; dữ liệu lọc và ID sai.
- Khách vẫn đọc được trạng thái mới, thanh toán/hủy bằng trackingToken đúng; thiếu/sai token bị từ chối. Giữ toàn bộ kiểm tra snapshot, giá, chống tạo trùng của giai đoạn 5.

Chrome mới đã thao tác thật: đăng nhập staff; mở danh sách/chi tiết; bốn bước chính; xác nhận checkbox nhận tiền; hủy pending/confirmed và kiểm tra lý do bắt buộc; không còn nút hủy khi chuẩn bị/phục vụ hoặc nút cập nhật ở trạng thái kết thúc; tình trạng bàn và liên kết lọc; xung đột do tài khoản khác cập nhật qua API thật; lỗi mạng và thử lại; bộ lọc/phân trang 5+1/rỗng; khách làm mới thấy dữ liệu mới; admin dùng chung trang xử lý.

Một kỳ vọng của test catalog giai đoạn 4 được đổi có chủ đích: staff GET `/api/tables` nay phải thành công theo yêu cầu giai đoạn 6. Các kỳ vọng staff bị từ chối quản lý danh mục/món/sửa bàn vẫn giữ nguyên. Test Chrome kiểm tra `X-Order-Token` trên GET đọc đơn; request OPTIONS hỏi quyền CORS không mang token nên không được nhầm với GET.

Backend tests dùng database riêng có hậu tố ngẫu nhiên rồi tự dọn. Chrome tests tạo dữ liệu và tài khoản thử riêng trong database local, sau đó chỉ xóa đúng các ID đã tạo; không sửa dữ liệu demo có sẵn. Ảnh màn hình kiểm tra lưu ở `/private/tmp/restaurant-qr-stage6-detail-mobile.png`. Ảnh không chứa mật khẩu/token.

## 11. Cách chạy và tự kiểm tra

Tại thư mục gốc project, khởi động MongoDB:

```bash
docker compose up -d mongodb
```

Backend và frontend ở hai terminal riêng:

```bash
npm --prefix server run dev
```

```bash
npm --prefix client run dev
```

Frontend: **http://localhost:5174**; backend: **http://localhost:3000**. Nếu đã chạy thì không mở thêm tiến trình trùng cổng.

Không có biến `.env` mới cho giai đoạn 6. Giữ `MONGODB_URI`, `PORT`, `CLIENT_ORIGIN`, `PUBLIC_APP_URL`, `JWT_SECRET`, `ORDER_TOKEN_SECRET` trong `server/.env`; `VITE_API_BASE_URL` trong `client/.env`. Không sao chép đè file môi trường đã cấu hình, không đưa secret thật vào source. Hướng dẫn tạo tài khoản admin/staff bằng `create:user` và các biến `CREATE_USER_*` nằm trong [README.md](README.md) mục 11; chưa có giao diện quản lý tài khoản.

Chạy lại toàn bộ test và build:

```bash
npm --prefix server test
npm --prefix client run build
npm --prefix server run check:db
```

Để chạy kiểm thử trình duyệt trên macOS, giữ frontend/backend đang chạy, mở Chrome riêng ở terminal khác:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-first-run --no-default-browser-check --remote-debugging-port=9224 --user-data-dir=/private/tmp/restaurant-qr-browser-check about:blank
```

Sau đó chạy lần lượt:

```bash
npm --prefix server run test:browser:orders
npm --prefix server run test:browser:workflow
```

Script dùng CDP, tức giao thức điều khiển Chrome, qua WebSocket có sẵn trong Node.js, không cần cài Playwright. Chỉ mở cổng debug trên máy phát triển. Dùng Ctrl+C tại terminal Chrome để dừng sau khi thử. Nếu đổi địa chỉ debug, đặt `CHROME_DEBUG_URL` khi chạy script.

## 12. Kịch bản tự demo giai đoạn 6

1. Chạy hệ thống. Dùng admin tạo danh mục, món giá **35.000đ** và một bàn đang phục vụ theo hướng dẫn giai đoạn 4. Chuẩn bị ít nhất một tài khoản staff.
2. Mở QR của bàn trên trình duyệt khách; nhập tên, đặt hai lần để có **đơn A** và **đơn B**. Giữ trang theo dõi đơn A.
3. Đăng nhập staff ở cửa sổ khác, vào `/staff/orders`. Bấm **Làm mới danh sách**, lọc đúng bàn; thấy hai đơn pending. Vào `/staff/tables`: bàn đang sử dụng, 2 đơn đang xử lý.
4. Mở A, xem món/ghi chú/tổng tiền. Bấm **Xác nhận đơn → Bắt đầu chuẩn bị → Đã phục vụ**. Mỗi bước thêm người/thời gian vào lịch sử; ở preparing không còn nút hủy.
5. Trên trang khách A bấm **Làm mới trạng thái**: thấy trạng thái staff vừa cập nhật. Không có cập nhật tự động ở giai đoạn này.
6. Staff bấm **Xác nhận thanh toán & hoàn thành**, kiểm tra mã/số tiền, đánh dấu đã nhận tiền rồi xác nhận. A completed và có thời gian thanh toán. Làm mới bàn: vẫn bận vì còn B.
7. Mở B pending, bấm **Hủy đơn**, nhập **Khách đổi ý** rồi xác nhận. Xem lý do/thời gian/người hủy. Làm mới bàn: trống. Lọc cancelled hoặc tất cả để tìm lại B.
8. Tạo đơn C, xác nhận rồi hủy để demo nhánh confirmed → cancelled. Tạo đơn D đến preparing: không có nút hủy; gọi API cố hủy cũng bị từ chối.
9. Tạo đơn E pending. Mở chi tiết E ở **hai cửa sổ đăng nhập độc lập** (hai trình duyệt hoặc một cửa sổ riêng tư; có thể dùng hai tài khoản staff). Cả hai đều đang thấy pending. Cửa sổ A xác nhận trước. Cửa sổ B bấm nút xác nhận cũ: thấy lỗi dữ liệu đã thay đổi, tự tải lại confirmed; lịch sử chỉ có một lần xác nhận.
10. Thử lọc mã/trạng thái/bàn/ngày, chọn 5 đơn/trang và chuyển trang nếu đủ dữ liệu. Admin vào `/admin/orders` để thử cùng luồng; staff không mở được trang quản lý danh mục/món.
11. Mở URL đơn khách trên trình duyệt chưa đặt: thiếu mã xem đơn nên không đọc được. Trang khách ban đầu vẫn xem được sau khi làm mới.
12. Thử tắt mạng bằng DevTools ở màn hình chi tiết rồi cập nhật: có lỗi, dữ liệu được tải lại trước khi thao tác tiếp; bật mạng và bấm **Thử lại**. Không tự gửi lại bước tiếp theo.

Nếu dùng điện thoại thật, cấu hình IP LAN theo giai đoạn 4; `localhost` trên điện thoại là điện thoại, không phải máy tính. Lưu giỏ/token vẫn theo trình duyệt và địa chỉ website đã dùng đặt món.

## 13. Những điểm nên trình bày khi bảo vệ

- Sáu trạng thái phản ánh quy trình; backend giữ quy tắc, frontend chỉ hiển thị các bước được cấp.
- Order lưu bản chụp tên/giá, nên xử lý hoặc đổi giá món sau này không làm sai tiền đơn cũ.
- Mỗi lần xử lý lưu thời gian và tài khoản trong lịch sử; đơn hủy được giữ để kiểm tra lại.
- `completed` khác `served`: đã xác nhận nhận tiền, có paidAt, xử lý riêng từng đơn.
- Bàn suy ra từ tập đơn đang xử lý, nên hoàn thành/hủy một đơn không làm mất các đơn khác cùng bàn.
- Chỉ kiểm tra trước khi ghi là chưa đủ; điều kiện trạng thái phải nằm trong lệnh cập nhật MongoDB để chống hai nhân viên bấm cùng lúc.
- JWT bảo vệ API nội bộ; trackingToken bảo vệ quyền xem đúng đơn của khách. Tên khách và mã QR không thay thế hai cơ chế này.
- Nghiệp vụ đã chạy bằng API; giai đoạn sau có thể thêm Socket.IO để báo thay đổi rồi tải dữ liệu mới, không thay thế các quy tắc backend.
