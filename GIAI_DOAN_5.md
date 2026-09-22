# Giai đoạn 5 — Giỏ hàng và gửi order

**Ngày kiểm tra: 16/09/2026.** Đã hoàn thành luồng **QR → nhập tên → menu → giỏ hàng → gửi order → MongoDB → khách xem đơn** bằng API.

Khách không có tài khoản, không có JWT và không tạo bản ghi User. Giai đoạn này chưa có Socket.IO, nhân viên xác nhận/đổi trạng thái, tính tình trạng bàn, quản lý đơn nội bộ, doanh thu hoặc thanh toán. Đơn mới luôn là `pending` — **Chờ xác nhận**.

## 1. Những gì đã tạo và nơi đọc code

| File | Mục đích |
|---|---|
| `server/src/models/Order.js` | Cấu trúc đơn trong MongoDB, các dòng món, lịch sử và chỉ mục chống trùng |
| `server/src/utils/orderValidation.js` | Kiểm tra dữ liệu khách gửi, chỉ lấy những trường được phép |
| `server/src/utils/orderToken.js` | Băm dữ liệu, tạo và kiểm tra mã xem đơn |
| `server/src/services/orderService.js` | Kiểm tra bàn/menu, tính tiền, lưu đơn và xử lý gửi lại |
| `server/src/controllers/publicOrderController.js` | Nhận yêu cầu HTTP, trả kết quả tạo/xem đơn |
| `server/src/routes/publicMenuRoutes.js` | Gắn hai API order vào nhóm API khách hiện có |
| `client/src/contexts/CartContext.jsx` | Dữ liệu giỏ dùng chung và các thao tác thêm/sửa/gửi/lưu kết quả |
| `client/src/utils/guestStorage.js` | Đọc/ghi giỏ theo QR, sinh mã lần gửi, tìm mã xem đơn đã lưu |
| `client/src/layouts/CustomerTableLayout.jsx` | Dùng chung CartContext cho menu và giỏ của một bàn |
| `client/src/components/MenuProductDetails.jsx` | Chọn số lượng và ghi chú khi thêm món |
| `client/src/components/GuestOrders.jsx` | Các liên kết mở lại đơn đã đặt trên trình duyệt này |
| `client/src/pages/customer/CartPage.jsx` | Trang giỏ, tạm tính và nút gửi/thử lại |
| `client/src/pages/customer/OrderPage.jsx` | Trang xem đơn và làm mới trạng thái |
| `server/tests/orders.test.js` | 36 kiểm thử API order bằng MongoDB thật |
| `server/tests-browser/orders.mjs` | Tự thao tác và kiểm tra giỏ/đơn trên Chrome thật |

Đã cập nhật menu, React Router, Axios công khai, cấu hình môi trường, README và tài liệu thiết kế. **Không thêm thư viện chạy ứng dụng.** Các hàm mã hóa dùng `node:crypto`, có sẵn trong Node.js.

Luồng code để trình bày: **CartPage → Axios → publicMenuRoutes → controller → orderService → Mongoose → MongoDB → trả mã đơn/token → lưu trình duyệt → OrderPage gọi API xem đơn**.

## 2. Giỏ hàng hoạt động thế nào?

**React Context** là cách chia sẻ dữ liệu giữa các thành phần React. Menu và trang giỏ cùng sử dụng CartContext. **localStorage** là vùng lưu dữ liệu của trình duyệt, giúp tải lại hoặc mở lại trình duyệt vẫn còn giỏ.

Mỗi bàn có khóa riêng:

```text
restaurant_qr_cart:v1:<qrToken>
```

Trong đó có:

- `customerName`: tên khách của bàn này.
- `items`: các món trong giỏ, giá tạm, số lượng, ảnh và ghi chú.
- `note`: ghi chú toàn đơn.
- `pending`: mã và nội dung lần gửi chưa nhận kết quả chắc chắn; bình thường là `null`.
- `orders`: danh sách các đơn đã đặt, mỗi đơn có `orderId`, `orderCode`, `status` lúc tạo và `trackingToken`.

Tên ở giai đoạn 4 được chuyển từ sessionStorage nếu tab vẫn còn tên đó. Từ giai đoạn 5, tên và giỏ lưu trong localStorage theo QR. Tên vẫn chỉ để hiển thị, không cấp quyền xem đơn.

Một món có một dòng trong giỏ. Thêm lại món sẽ cộng số lượng, tối đa 99. Ghi chú đang nhập trong hộp thêm món áp dụng cho dòng đó. Có thể sửa ghi chú tại giỏ, tăng/giảm và xóa món. Tối đa 50 món khác nhau trong một đơn.

Đổi từ QR bàn A sang QR bàn B sẽ mở dữ liệu riêng của B. Quay lại A vẫn có giỏ A. Sau khi gửi thành công, chỉ phần món/ghi chú được xóa; tên và danh sách đơn đã đặt vẫn còn.

Nếu trình duyệt không cho lưu hoặc hết dung lượng, giao diện báo lỗi. Lần gửi phải được lưu trước khi gọi API. Sau khi server tạo đơn, **lưu token và xóa phần giỏ bằng cùng một lần ghi localStorage**: nếu ghi thất bại thì giữ lần gửi để khôi phục. Đã kiểm tra tình huống này trên Chrome.

## 3. Order lưu những gì?

| Nhóm | Dữ liệu |
|---|---|
| Nhận diện | `orderCode`, `customerName`, `tableId`, `tableName` |
| Mỗi dòng món | `productId`, `productName`, `unitPrice`, `quantity`, `note`, `lineTotal` |
| Toàn đơn | `note`, `totalAmount`, `status` |
| Truy cập và chống trùng | `trackingTokenHash`, `trackingTokenNonce`, `requestIdHash`, `requestPayloadHash` |
| Lịch sử | `statusHistory`: `status`, `changedAt`, `changedBy` |
| Thời gian | `createdAt`, `updatedAt` do Mongoose quản lý |

Lần tạo ghi một lịch sử `pending`, `changedBy = null` vì khách không có tài khoản. Model nhận diện sáu trạng thái đã chốt, gồm cả `cancelled`, nhưng **chưa có API đổi trạng thái hay hủy đơn**. Các trường thanh toán/hủy sẽ thêm khi triển khai giai đoạn 6.

`orderCode` có dạng `ORD-20260916-A12B34C56D`: ngày theo giờ Việt Nam và 10 ký tự ngẫu nhiên. MongoDB có chỉ mục duy nhất; nếu tình cờ trùng mã thì backend thử mã khác. Đây là mã để đọc và trao đổi, không phải bí mật bảo vệ đơn.

## 4. Vì sao backend phải tự tính tiền?

Người dùng có thể sửa JavaScript hoặc gửi API bằng công cụ khác. Giá trong trình duyệt chỉ là tạm tính. Backend phải tự kiểm tra:

1. QR đúng, bàn tồn tại và đang hoạt động.
2. Món tồn tại, đang kinh doanh và còn hàng.
3. Danh mục của món đang hoạt động.
4. Số lượng là số nguyên **1–99**, không nhận chuỗi, số âm, số lẻ, `0`, `null` hoặc boolean.
5. Tên khách 1–100 ký tự; ghi chú món tối đa 500, ghi chú đơn tối đa 1000.
6. Lấy giá từ MongoDB, tính từng dòng rồi cộng tổng. Chặn kết quả vượt giới hạn số nguyên an toàn của JavaScript.

```text
lineTotal = unitPrice từ MongoDB × quantity
totalAmount = tổng lineTotal
```

Ví dụ: 2 cà phê × 35.000đ + 3 bánh × 25.000đ = **145.000đ**. Dù frontend gửi `totalAmount = 1` hoặc `unitPrice = 1`, backend vẫn tính theo giá thật. Các trường giá, tên món, tên bàn hoặc trạng thái tự khai từ frontend không được dùng làm dữ liệu chính thức.

Nếu quản lý vừa đổi giá sau khi khách thêm giỏ, đơn dùng giá hiện hành lúc backend nhận đơn. Giao diện giỏ có thông báo điều này; tổng chính thức nằm ở trang đơn vừa đặt.

## 5. Snapshot giá món là gì?

**Snapshot** nghĩa là bản ghi lại dữ liệu tại thời điểm đặt. Đơn giữ tên bàn, tên món, đơn giá và thành tiền của riêng nó.

Ví dụ, khách đặt cà phê 35.000đ. Quản lý đổi giá thành 40.000đ hoặc đổi tên món sau đó, đơn cũ vẫn giữ 35.000đ và tên cũ. Trang đơn đọc dữ liệu đã lưu trong Order, không lấy giá mới để tính lại. Đã kiểm tra cả trường hợp món gốc bị xóa.

## 6. trackingToken và quyền xem đơn

`trackingToken` là **mã bí mật để mở đúng đơn**. Nó không phải tài khoản hoặc JWT của khách.

- Backend sinh 32 byte ngẫu nhiên, gọi là `nonce` — một số ngẫu nhiên riêng của đơn.
- Dùng nonce và khóa `ORDER_TOKEN_SECRET` với HMAC-SHA256 để tạo token. **HMAC** là phép tạo mã có dùng khóa bí mật.
- Trình duyệt nhận token thật. MongoDB lưu `trackingTokenHash` là bản băm SHA-256, cùng nonce; không lưu token thật.
- **Băm** là chuyển dữ liệu thành dấu kiểm tra một chiều. Khi đọc đơn, backend băm token khách gửi và so sánh với hash đã lưu.
- HMAC giúp server tái tạo cùng token khi khách gửi lại sau mất phản hồi. Chỉ có nonce/hash trong database thì chưa đủ tính token; còn cần khóa riêng của backend.

API xem đơn bắt buộc header `X-Order-Token`. **Header** là phần thông tin đi kèm yêu cầu HTTP. Token không xuất hiện trong đường dẫn, không gửi trong query, không được backend ghi vào log. Khi triển khai thực tế phải dùng HTTPS để bảo vệ dữ liệu trên đường truyền.

Chỉ biết `orderId`, `orderCode`, tên khách hoặc QR bàn đều chưa đủ xem chi tiết. Thiếu token, sai token, token của đơn khác hoặc đơn không tồn tại đều nhận cùng lỗi `404` không chứa chi tiết đơn. Đọc đúng đơn vẫn dùng được sau khi bàn/món bị tắt, vì đó là đơn đã đặt.

Ai có token thật sẽ mở được đơn tương ứng. Không chia sẻ dữ liệu localStorage hoặc ảnh chụp phần token. Xóa dữ liệu trình duyệt, đổi thiết bị, đổi địa chỉ frontend hoặc mở cửa sổ riêng tư sẽ không tự có mã cũ. Giai đoạn này chưa có khôi phục qua tài khoản khách.

## 7. Chống gửi order trùng

**Idempotency** ở đây nghĩa là gửi lại cùng một lần đặt vẫn chỉ có một kết quả đơn hàng.

1. Trước POST, trình duyệt sinh `requestId` bằng 32 byte ngẫu nhiên, biểu diễn 64 ký tự hex, rồi lưu cả mã và nội dung gửi vào `pending`.
2. Backend băm requestId và nội dung đã kiểm tra. Nếu đã có đơn cùng mã và nội dung, trả lại đúng đơn và cùng trackingToken.
3. Nếu là lần mới, backend kiểm tra bàn/món, tính tiền và lưu Order. `requestIdHash` có **unique index** — chỉ mục không cho lưu hai đơn cùng mã lần gửi.
4. Nếu hai yêu cầu đến đồng thời, MongoDB chỉ cho một yêu cầu lưu. Yêu cầu còn lại đọc đúng đơn vừa có.
5. Nếu cùng mã nhưng nội dung khác, trả `409`; không tự tạo đơn khác.
6. Khi thành công, frontend lưu id/token và xóa phần giỏ. Lần đặt thêm tiếp theo sinh requestId mới.

Mất mạng, timeout (chờ quá thời gian), lỗi server hoặc mất phản hồi sau khi đã lưu: giữ nguyên mã/nội dung. Nút **Kiểm tra lại lần gửi** gửi lại chúng. Trong lúc chưa rõ kết quả, không sửa giỏ hoặc đổi tên để tránh biến một lần gửi thành hai nội dung khác nhau. Tải lại trang vẫn giữ được lần gửi.

Lỗi kiểm tra rõ ràng như món hết hoặc bàn tắt: giữ món/ghi chú, bỏ trạng thái đang chờ để khách sửa. Backend kiểm tra lần gửi đã xử lý **trước** kiểm tra menu hiện tại, nên đơn cũ vẫn khôi phục được nếu quản lý tắt món/bàn sau khi lưu.

`requestId` cũng cần giữ riêng vì người có mã cùng nội dung có thể dùng API tạo để lấy lại kết quả/token. Database chỉ lưu hash của requestId. Không đưa requestId vào URL hoặc log.

Cơ chế này chống lặp **cùng mã lần gửi**, không tự gộp hai yêu cầu có mã khác nhau chỉ vì món giống nhau. Dữ liệu chống trùng nằm trong MongoDB, không nằm trong biến nhớ của tiến trình Node. Không có transaction nhiều collection: đơn, snapshot và dấu nhận biết gửi trùng được lưu cùng một document (bản ghi) Order.

## 8. Cùng bàn đặt nhiều lần

Sau đơn A thành công, khách nhấn **Về menu / Đặt thêm món**, chọn tiếp và gửi đơn B. A và B có id, mã dễ đọc và token riêng. Mỗi đơn giữ tên và giá tại lần đặt của mình.

Menu/giỏ hiển thị **Đơn đã đặt trên trình duyệt này** để mở lại A, B, C. Không có API công khai liệt kê mọi đơn của tất cả khách cùng bàn. Sau này nhân viên sẽ xử lý và hoàn thành từng đơn riêng; chưa gộp thanh toán theo bàn.

## 9. Hai API mới

### POST `/api/public/orders`

Không yêu cầu đăng nhập. Body gồm `requestId`, `qrToken`, `customerName`, `items: [{ productId, quantity, note }]`, `note`. Không gửi giá làm nguồn dữ liệu chính thức.

Phản hồi thành công:

```text
{
  success: true,
  data: { orderId, orderCode, status: "pending", trackingToken },
  replayed: false
}
```

- `201`: tạo mới.
- `200`, `replayed: true`: trả lại lần gửi đã xử lý.
- `400`: tên/giỏ/số lượng sai, món không còn phục vụ hoặc tổng vượt giới hạn.
- `403`: bàn đang tắt.
- `404`: QR/bàn không tồn tại.
- `409`: cùng mã lần gửi nhưng nội dung khác.
- `503`: lỗi cần thử lại cùng lần gửi, ví dụ không tái tạo được token do đổi khóa.

### GET `/api/public/orders/:id`

Gửi header `X-Order-Token: <token thật đã lưu trên trình duyệt>`. Không nhận token trong URL.

`200` trả mã đơn, tên khách/bàn, các dòng món đã lưu, ghi chú, tổng, trạng thái, lịch sử và thời gian. Không trả token, hash, nonce hoặc dữ liệu chống trùng. Thiếu/sai token nhận `404`.

Cả hai API dùng `Cache-Control: no-store`, yêu cầu trình duyệt không lưu phản hồi API vào bộ nhớ đệm. Trạng thái mới nhất luôn lấy qua API khi mở đơn hoặc nhấn làm mới.

## 10. Cấu hình và chạy project

Giữ `client/.env` như trước. Trong `server/.env` thêm khóa riêng:

```dotenv
ORDER_TOKEN_SECRET=
```

Trên máy hiện tại đã tạo khóa ngẫu nhiên trong `.env` cục bộ. Source và `.env.example` không chứa giá trị thật. Trên máy mới, sinh chuỗi rồi điền vào biến trên:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Không dùng chung giá trị với JWT_SECRET. Khóa phải có ít nhất 32 ký tự và chỉ nằm ở backend. **Giữ khóa ổn định**: thay khóa có thể khiến lần gửi bị mất phản hồi không nhận lại được token cũ; server trả lỗi và không tạo trùng. Token đã lưu thành công ở trình duyệt vẫn được kiểm tra bằng hash trong đơn.

Từ thư mục gốc, mở Docker rồi chạy:

```bash
docker compose up -d mongodb
```

Terminal backend:

```bash
npm --prefix server run dev
```

Terminal frontend:

```bash
npm --prefix client run dev
```

Frontend: **http://localhost:5174**. Backend: **http://localhost:3000**. Khởi động lại backend sau khi sửa `.env`. Không sao chép đè `.env.example` lên `.env` hiện có.

## 11. Kết quả test thực tế

| Kiểm tra | Kết quả |
|---|---|
| Backend toàn bộ | **65/65 pass**, 0 fail, 0 skipped: 12 auth + 17 catalog + 36 order |
| Frontend `npm --prefix client run build` | Thành công |
| `npm --prefix server run check:db` | Kết nối, ping, ghi và đọc MongoDB thành công |
| Chrome thật với React → Axios → Express → MongoDB | Toàn bộ kịch bản trong script thành công |
| Menu, giỏ, trang đơn ở 375px | Không tràn ngang trong các kịch bản kiểm tra |
| Lỗi JavaScript chưa được xử lý trong các luồng Chrome đã kiểm tra | Không phát hiện |

Backend đã kiểm tra đủ các nhóm yêu cầu: tạo đơn/tên/lịch sử; bàn sai/tắt; món mất/ẩn/hết; danh mục ẩn/xóa; số lượng sai và biên 1/99; giả giá không ảnh hưởng; lineTotal/totalAmount; snapshot sau sửa/xóa món; token đúng/sai/thiếu/của đơn khác; hash không lộ; lặp requestId; **8 request đồng thời**; retry sau tắt bàn/món; hai lần đặt thật cùng bàn; giới hạn ghi chú/giỏ và số tiền an toàn.

Giữ toàn bộ kiểm tra đăng nhập/phân quyền/catalog. Một kỳ vọng cũ của giai đoạn 4 là “API order chưa tồn tại” được cập nhật thành “API order công khai kiểm tra và từ chối body thiếu”, vì giai đoạn 5 đã chính thức thêm API này. Không bỏ kiểm tra bảo vệ API admin hoặc ẩn món/danh mục.

Chrome đã thao tác thực tế:

- Nhập tên, thêm món bằng hộp số lượng/ghi chú; món hết bị vô hiệu hóa.
- Tăng/giảm/xóa, ghi chú món và toàn đơn, refresh giữ giỏ.
- Hai QR có giỏ/tên riêng, chuyển qua lại không lẫn dữ liệu.
- Món vừa hết sau khi thêm giỏ: API từ chối, giỏ vẫn còn và sửa được.
- Chặn mạng trước POST: giỏ/mã gửi giữ qua reload, thử lại thành công.
- Giữ phản hồi sau khi MongoDB đã lưu: giỏ chưa bị xóa; làm mất phản hồi, reload/thử lại không tạo đơn thứ ba cho hai lần đặt thật.
- Bấm gửi hai lần, giá món đổi sau khi thêm giỏ, trang đơn hiển thị giá MongoDB.
- Làm localStorage báo hết dung lượng đúng lúc lưu token: giỏ/lần gửi còn nguyên, khôi phục storage rồi thử lại nhận đúng đơn.
- Lưu và mở lại nhiều đơn, thiếu token không hiển thị chi tiết, lỗi khi tải đơn và thử lại.
- Khách không gọi auth, không gửi JWT, token chỉ nằm trong header khi đọc đơn.

Backend tests dùng database riêng có hậu tố ngẫu nhiên và tự dọn. Chrome test tạo category/product/table/order riêng trong database local rồi chỉ xóa các bản ghi do chính lần test đó tạo. Không để lại tài khoản hoặc đơn thử cho người dùng.

### Chạy lại kiểm tra

```bash
npm --prefix server test
npm --prefix client run build
npm --prefix server run check:db
```

Để chạy Chrome test trên macOS, giữ backend/frontend đang chạy. Mở một Chrome headless (trình duyệt chạy không cần cửa sổ) với **hồ sơ kiểm thử riêng** ở terminal khác:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-first-run --no-default-browser-check --remote-debugging-port=9224 --user-data-dir=/private/tmp/restaurant-qr-browser-check about:blank
```

Sau đó, từ gốc project:

```bash
npm --prefix server run test:browser:orders
```

Script dùng CDP (giao thức điều khiển Chrome) qua WebSocket có sẵn trong Node.js, không cần cài Playwright. Nó mở/đóng tab thử riêng, tạo/dọn dữ liệu thử và lưu một ảnh màn hình ở `/private/tmp/restaurant-qr-stage5-order-mobile.png`. Dùng Ctrl+C ở terminal Chrome sau khi kiểm tra. Cổng debug chỉ dành cho máy phát triển, không mở công khai.

## 12. Cách tự demo toàn bộ giai đoạn 5

1. Chạy MongoDB, backend và frontend. Đăng nhập admin tại `/login`.
2. Tạo danh mục đang hiện; tạo cà phê **35.000đ**, bánh **25.000đ** và một món đánh dấu hết. Tạo hai bàn A/B đang hoạt động.
3. Mở QR bàn A, nhập **Nguyễn Văn A**. Thêm 2 cà phê ghi chú **Ít đá**, thêm 3 bánh.
4. Mở **Giỏ hàng (5)**. Tăng/giảm thử, xóa/thêm lại món; ghi chú toàn đơn **Mang nước trước**. Tạm tính lúc 2 cà phê + 3 bánh là **145.000đ**.
5. Refresh: giỏ/ghi chú còn. Mở QR B: không có món từ A. Quay lại A và kiểm tra đúng giỏ.
6. Nhấn **Gửi order**. Trang `/orders/:orderId` hiển thị tên, bàn, món, ghi chú, tổng **145.000đ**, thời gian và **Chờ xác nhận**.
7. Nhấn **Làm mới trạng thái** và refresh: vẫn đọc được đúng đơn. Giai đoạn này chưa có thao tác đổi trạng thái.
8. Admin đổi giá cà phê thành **40.000đ**. Mở lại đơn cũ: cà phê vẫn **35.000đ**.
9. Từ đơn, chọn **Về menu / Đặt thêm món**, đặt thêm một lần. Menu có cả hai mã đơn, mỗi mã mở đúng dữ liệu riêng.
10. Sao chép URL `/orders/:id` sang cửa sổ riêng tư: không có mã xem đơn nên không xem được nội dung.
11. Thử món vừa hết: thêm một món vào giỏ, admin đánh dấu hết, rồi gửi. Giỏ còn nguyên và có thông báo món hết để sửa.
12. Thử lỗi mạng: ở giỏ, dùng DevTools → Network → Offline rồi gửi. Chuyển về Online, refresh và nhấn **Kiểm tra lại lần gửi**. Trường hợp mất phản hồi sau khi server đã lưu được script Chrome kiểm tra tự động chính xác hơn thao tác tay.

Nếu demo điện thoại, cấu hình địa chỉ LAN theo GIAI_DOAN_4.md; `localhost` trên điện thoại không trỏ về máy tính. Giỏ/token lưu theo origin (giao thức + tên máy + cổng), nên đổi từ localhost sang IP LAN không tự mang dữ liệu trình duyệt cũ theo.

## 13. Các điểm cần nắm để bảo vệ

- Vì sao khách không cần User/JWT, nhưng vẫn cần mã riêng để xem đơn?
- Vì sao không được tin giá frontend? Ví dụ giả giá 1đ sẽ được xử lý thế nào?
- Vì sao Order giữ cả tên/giá thay vì chỉ tham chiếu Product?
- Vì sao QR chỉ nhận diện bàn, không cấp quyền xem tất cả đơn của bàn?
- Khi server lưu xong nhưng mạng đứt, làm sao biết gửi lại là đơn cũ?
- Unique index bảo vệ thế nào khi hai request đến cùng lúc?
- Vì sao phải lưu token thành công trước khi bỏ giỏ? Vì sao hash một chiều cần thêm cách tái tạo token cho retry?
- Phân biệt một lần gửi lại và một lần đặt thêm thật sự; hai đơn cùng bàn không bị gộp.

Giới hạn cần hiểu: QR không chứng minh khách đang ngồi tại bàn; localStorage phụ thuộc trình duyệt; chưa có giới hạn số đơn theo khách, tồn kho định lượng hoặc giao dịch khóa menu trong lúc admin sửa đồng thời. Kiểm tra giá/trạng thái dựa trên dữ liệu đọc khi backend xử lý. Không khẳng định đã có nghiệp vụ vận hành hoặc bảo vệ triển khai công khai ngoài phạm vi đã kiểm tra.

Tài liệu chính thức tham khảo: [Node.js crypto: randomBytes, Hash và HMAC](https://nodejs.org/api/crypto.html), [Mongoose: validation và unique index](https://mongoosejs.com/docs/validation.html). `unique` tạo chỉ mục MongoDB; nó không phải một hàm kiểm tra đầu vào của Mongoose, vì vậy code chờ chỉ mục và xử lý lỗi trùng từ database.
