# Giai đoạn 4 — Danh mục, món ăn, bàn, QR và menu khách

Đây là tài liệu ghi lại phạm vi và kết quả giai đoạn 4. Project hiện đã bổ sung giỏ hàng và order ở [GIAI_DOAN_5.md](GIAI_DOAN_5.md). Phần đăng nhập trước đó nằm ở [GIAI_DOAN_3.md](GIAI_DOAN_3.md).

**Ngày kiểm tra:** 16/09/2026.  
**Phạm vi:** Đã triển khai quản lý danh mục, món, bàn, tạo/xem/tải QR và menu khách. Chưa có giỏ hàng, tạo order, trạng thái order, Socket.IO, thống kê doanh thu hoặc thanh toán.

## 1. Những gì đã tạo

- Model `Category`, `Product`, `Table` với `createdAt` và `updatedAt` tự động.
- 10 API quản trị, tất cả yêu cầu JWT hợp lệ và vai trò `admin`.
- 4 API công khai cho khách, không yêu cầu tài khoản hoặc JWT.
- Các trang `/admin/categories`, `/admin/products`, `/admin/tables` và thanh điều hướng quản lý.
- Trang `/menu/:qrToken`: kiểm tra bàn, nhập tên, xem menu theo danh mục và xem chi tiết món.
- Hộp xem QR, tải ảnh PNG và liên kết mở đúng menu của bàn.
- Trạng thái đang tải, lỗi, thử lại, dữ liệu rỗng và kiểm tra biểu mẫu.
- 17 kiểm thử backend mới, giữ nguyên 12 kiểm thử đăng nhập.
- Một ảnh minh họa tách cà phê tại `client/public/images/coffee.svg`, dùng được bằng đường dẫn `/images/coffee.svg`.

Thư viện chạy ứng dụng mới duy nhất là `qrcode` ở backend. Không thêm thư viện quản lý state, biểu mẫu, tải ảnh hoặc giỏ hàng.

## 2. Category dùng để làm gì?

`Category` là **danh mục**, dùng để nhóm món như Cà phê, Trà, Bánh. Một danh mục có nhiều món, một món thuộc một danh mục.

| Trường | Mục đích |
|---|---|
| `name` | Tên danh mục, bắt buộc, tối đa 100 ký tự |
| `description` | Mô tả, tối đa 1000 ký tự |
| `sortOrder` | Số nguyên không âm; số nhỏ hiển thị trước |
| `isActive` | `true`: hiện; `false`: ẩn |
| `createdAt`, `updatedAt` | Thời điểm tạo và sửa |

Admin có thể thêm, sửa, ẩn và hiện danh mục. Staff không được gọi các API này.

**Ẩn danh mục cũng ẩn toàn bộ món thuộc danh mục ở menu khách.** Quy tắc được kiểm tra tại backend cho cả danh sách và API chi tiết món, không chỉ lọc trên React.

## 3. Product dùng để làm gì?

`Product` lưu món ăn hoặc đồ uống.

| Trường | Mục đích |
|---|---|
| `categoryId` | Mã danh mục đã tồn tại |
| `name`, `description` | Tên món và mô tả |
| `price` | Giá dạng số nguyên không âm, đơn vị đồng |
| `imageUrl` | URL ảnh http/https hoặc đường dẫn `/images/...`; có thể để trống |
| `isAvailable` | Món hiện còn hay tạm hết |
| `isActive` | Món còn kinh doanh và được hiển thị hay không |
| `createdAt`, `updatedAt` | Thời điểm tạo và sửa |

Ví dụ giá hợp lệ: `35000`. API từ chối `"35000"`, `"35.000đ"`, số âm và số lẻ. React chỉ định dạng thành `35.000 ₫` khi hiển thị.

Phân biệt hai trạng thái:

- `isAvailable = false`: món vẫn hiện với nhãn **Hết món**, nút **Tạm hết món** bị vô hiệu hóa.
- `isActive = false`: món không xuất hiện trong danh sách khách; gọi thẳng API chi tiết cũng không lấy được món này.

Món còn hàng hiện nút **Xem chi tiết**. Giai đoạn này chưa có nút thêm giỏ hoặc API đặt món. Khi triển khai order, backend phải kiểm tra lại trạng thái món và danh mục tại thời điểm gửi đơn.

Ảnh được hiển thị bằng đường dẫn, chưa có tải file ảnh lên. Nếu chưa có ảnh hoặc đường dẫn lỗi, giao diện hiện khung **Chưa có ảnh**.

## 4. Table và qrToken hoạt động thế nào?

`Table` lưu thông tin bàn:

| Trường | Mục đích |
|---|---|
| `name` | Tên bàn |
| `capacity` | Số chỗ, số nguyên từ 1 đến 100 |
| `qrToken` | Mã ngẫu nhiên riêng của bàn |
| `isActive` | Bàn có đang phục vụ không |
| `createdAt`, `updatedAt` | Thời điểm tạo và sửa |

Khi tạo bàn, backend dùng `crypto.randomBytes(24)` tạo mã ngẫu nhiên 24 byte, đổi thành chuỗi 48 ký tự hex. **Hex** là cách biểu diễn dùng các ký tự 0–9 và a–f.

MongoDB có **unique index** — chỉ mục không cho hai bàn lưu cùng token. Nếu tình cờ bị trùng, API thử tạo token khác. API không nhận token tự nhập từ admin, cũng không cho sửa token sau khi tạo.

Sửa tên bàn, số chỗ hoặc bật/tắt bàn giữ nguyên `qrToken`, nên không cần đổi mã nhận diện đã in. Chưa lưu hoặc tính tình trạng trống/đang sử dụng vì chưa có order.

Khi admin nhấn **Xem QR**, backend:

1. Tìm bàn theo `_id`.
2. Tạo URL `PUBLIC_APP_URL + /menu/ + qrToken`.
3. Dùng `qrcode` tạo ảnh PNG.
4. Trả URL và ảnh cho trình duyệt để xem hoặc tải.

Ảnh được trả dạng **data URL**, nghĩa là nội dung ảnh được mã hóa ngay trong chuỗi để trình duyệt hiển thị. **Không lưu ảnh QR vào MongoDB.**

## 5. Khách quét QR thì hệ thống xử lý ra sao?

1. Mở `/menu/:qrToken`.
2. React gọi `GET /api/public/tables/:qrToken` để xác định bàn.
3. QR sai/bàn không tồn tại: báo lỗi rõ ràng (`404`).
4. Bàn tắt: báo **Bàn này hiện không phục vụ. Vui lòng liên hệ nhân viên.** (`403`).
5. Bàn hợp lệ: yêu cầu nhập tên từ 1 đến 100 ký tự, không chấp nhận chỉ có khoảng trắng.
6. Nhấn **Bắt đầu gọi món** để xem menu; hệ thống kiểm tra lại bàn trước khi tải dữ liệu.
7. Hiển thị tên bàn, tên khách, danh mục, ảnh, mô tả, giá và tình trạng món.
8. Khách lọc theo danh mục, xem chi tiết món, đổi tên hoặc làm mới menu.

Tên được lưu trong `sessionStorage` theo từng `qrToken`, chỉ ở tab trình duyệt. Tải lại cùng bàn có thể giữ tên; mở QR khác yêu cầu tên riêng. Tên chưa được ghi vào MongoDB vì giai đoạn này chưa tạo đơn.

Trang khách nằm ngoài `AuthProvider` và sử dụng Axios riêng **không đọc/gửi JWT**. Khách không có User, không nhập mật khẩu. Tên không dùng để xác thực hoặc cấp quyền.

**Làm mới menu** kiểm tra lại cả bàn và menu. Nếu admin vừa tắt bàn, khách làm mới sẽ thấy lỗi không phục vụ. Giai đoạn này chưa tự cập nhật bằng Socket.IO.

## 6. Những API mới

Các API thành công trả `{ success: true, data: ... }`; lỗi trả `{ success: false, message: ... }`. Danh sách hiện trả toàn bộ dữ liệu phù hợp với quy mô demo, chưa có phân trang.

### Công khai — không cần JWT

| Method | API | Chức năng |
|---|---|---|
| GET | `/api/public/tables/:qrToken` | Xác định bàn đang phục vụ |
| GET | `/api/public/categories` | Danh mục đang hiển thị, sắp theo sortOrder |
| GET | `/api/public/products` | Món đang hiển thị thuộc danh mục đang hiện |
| GET | `/api/public/products/:id` | Chi tiết món đang hiển thị |

Danh sách món hỗ trợ `?categoryId=<id>`. API công khai không cho query tùy ý vượt qua điều kiện ẩn món/danh mục. Các API menu dùng `Cache-Control: no-store` để tránh lấy lại phản hồi cũ từ bộ nhớ đệm trình duyệt.

### Quản trị — chỉ admin

| Method | API | Chức năng |
|---|---|---|
| GET | `/api/categories` | Danh sách danh mục, gồm cả mục ẩn |
| POST | `/api/categories` | Tạo danh mục |
| PATCH | `/api/categories/:id` | Sửa hoặc ẩn/hiện danh mục |
| GET | `/api/products` | Danh sách món quản trị |
| POST | `/api/products` | Tạo món |
| PATCH | `/api/products/:id` | Sửa món, giá, tình trạng còn/hết hoặc ẩn/hiện |
| GET | `/api/tables` | Danh sách bàn |
| POST | `/api/tables` | Tạo bàn và token tự động |
| PATCH | `/api/tables/:id` | Sửa hoặc bật/tắt bàn |
| GET | `/api/tables/:id/qr` | Tạo PNG QR và URL menu của bàn |

Tất cả 10 API đều đi qua `requireAuth` và `requireRoles('admin')`. Người chưa đăng nhập nhận `401`, staff nhận `403`. Backend chỉ nhận những trường được phép sửa, không đưa nguyên dữ liệu từ trình duyệt vào database.

## 7. Kết quả kiểm tra thực tế

### Backend

```bash
npm --prefix server test
```

**Kết quả: 29/29 test thành công, không có test bị bỏ qua.** Gồm 12 test đăng nhập cũ và 17 test mới:

- Admin tạo/sửa danh mục, ẩn/hiện và kiểm tra thứ tự.
- Cả 10 API quản trị từ chối người chưa đăng nhập và staff; dữ liệu không bị sửa bởi yêu cầu trái quyền.
- Tạo/sửa món, giá thực lưu là số nguyên đồng; từ chối chuỗi tiền, giá lẻ/âm/quá lớn.
- Kiểm tra danh mục tồn tại, URL ảnh và các trường trạng thái.
- Món hết vẫn hiện với `isAvailable = false`.
- Món ẩn và món thuộc danh mục ẩn không lộ qua public list/detail.
- Tạo/sửa bàn, token khác nhau, unique index thực sự từ chối token trùng.
- Sửa bàn giữ QR; API không cho gửi token tùy ý.
- QR trả ảnh PNG và URL đúng bàn; ảnh không được lưu trong document bàn.
- Bàn tắt, QR sai, ID sai và dữ liệu rỗng trả đúng lỗi.
- Public menu không cần đăng nhập; chưa có API hoặc collection order.

Test dùng database riêng bắt đầu bằng `restaurant_qr_catalog_test_` và dọn sau khi chạy, không sửa dữ liệu thật.

### Trình duyệt Chrome

- Thao tác thật qua form: tạo/sửa danh mục; tạo món; sửa giá; đánh dấu hết; tạo/sửa bàn.
- Thử mất kết nối API rồi nhấn thử lại.
- Mở hộp QR, **giải mã ảnh PNG bằng bộ đọc độc lập** và xác nhận kết quả đúng URL bàn.
- Nhấn tải QR trong Chrome, xác nhận file PNG thực sự được tải và nội dung file khớp chính xác ảnh backend tạo.
- Nhập tên hợp lệ; từ chối tên chỉ có khoảng trắng; giữ tên khi tải lại và không mang tên sang bàn khác.
- Menu hiển thị đúng ảnh, mô tả, giá; lọc danh mục và trạng thái danh mục không có món.
- Nút món hết bị vô hiệu hóa; ẩn món/danh mục qua UI làm chúng biến mất khỏi menu khách sau tải lại.
- Bàn tắt báo lỗi khi làm mới menu; bật lại và thử lại thành công; QR sai báo lỗi.
- Theo dõi request xác nhận menu khách không gửi Authorization và không gọi API auth, kể cả tab đang lưu token admin.
- Staff và người chưa đăng nhập bị chặn khỏi cả ba trang quản trị.
- Menu và ba trang quản trị không tràn ngang ở chiều rộng 375px.
- Không phát hiện lỗi JavaScript chưa được xử lý trong các luồng đã kiểm tra.

Kiểm tra trình duyệt dùng dữ liệu có tên riêng và đã dọn sau khi xong. Thư viện đọc QR độc lập chỉ cài trong thư mục kiểm thử tạm, không thêm vào project.

### Frontend

```bash
npm --prefix client run build
```

Đóng gói frontend thành công. QR đã được giải mã và mở trong trình duyệt; chưa quét bằng điện thoại vật lý. Cách cấu hình để tự quét trên điện thoại được mô tả bên dưới.

## 8. Cách tự demo

### Demo ngay trên máy tính

Nếu ứng dụng chưa chạy, mở Docker và chạy tại thư mục gốc:

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

Thực hiện theo thứ tự:

1. Mở `http://localhost:5174/login`, đăng nhập admin. Tài khoản đã tạo ở giai đoạn 3; thông tin khởi tạo cục bộ nằm trong `server/.env`.
2. Vào **Danh mục**, thêm `Cà phê` với thứ tự `1` và `Trà` với thứ tự `2`.
3. Vào **Món ăn / Đồ uống**, thêm `Cà phê sữa`, danh mục Cà phê, giá `35000`, ảnh `/images/coffee.svg`, nhập mô tả.
4. Thêm `Trà đào` giá `45000`, rồi nhấn **Đánh dấu hết**.
5. Vào **Bàn & QR**, tạo `Bàn 01`, số chỗ `4`, bật phục vụ.
6. Nhấn **Xem QR**. Thử **Tải QR PNG** hoặc **Mở menu của bàn**.
7. Ở menu khách, nhập `Nguyễn Văn A`, nhấn **Bắt đầu gọi món**.
8. Kiểm tra đúng Bàn 01, danh mục và giá. Cà phê mở được chi tiết, Trà đào có nút bị vô hiệu hóa.
9. Quay lại admin, ẩn Cà phê hoặc cả danh mục Cà phê. Ở trang khách, nhấn **Làm mới menu** để thấy món biến mất.
10. Tắt Bàn 01. Mở lại QR hoặc làm mới menu để xem thông báo không phục vụ; bật lại bàn để tiếp tục demo.

Các bước trên chưa tạo giỏ hàng hoặc đơn hàng. Dữ liệu kiểm thử tự động đã dọn, nên nếu database chưa có danh mục/món/bàn, hãy bắt đầu từ bước 2.

### Quét bằng điện thoại trong cùng Wi-Fi

Điện thoại và máy tính cần cùng mạng, điện thoại truy cập được các cổng 5174 và 3000 của máy tính. `localhost` trên điện thoại chỉ chính điện thoại, không phải máy tính chạy project.

Lấy IP mạng nội bộ của máy. Trên Mac có thể thử:

```bash
ipconfig getifaddr en0
```

Ví dụ IP là `192.168.1.10` (**thay bằng IP thật của máy bạn**).

Sửa `server/.env`:

```dotenv
CLIENT_ORIGIN=http://192.168.1.10:5174
PUBLIC_APP_URL=http://192.168.1.10:5174
```

Sửa `client/.env`:

```dotenv
VITE_API_BASE_URL=http://192.168.1.10:3000/api
```

Khởi động lại backend. Chạy frontend cho phép truy cập từ mạng nội bộ:

```bash
npm --prefix client run dev -- --host 0.0.0.0
```

Mở admin bằng **`http://192.168.1.10:5174/login`** để khớp `CLIENT_ORIGIN`. Mở lại hộp QR để tạo ảnh chứa địa chỉ IP mới, rồi dùng camera điện thoại quét. QR in trước khi đổi địa chỉ vẫn chứa URL cũ; cần tải/in lại ảnh QR nếu địa chỉ máy thay đổi.

`MONGODB_URI` không cần đổi: backend vẫn kết nối MongoDB trên máy tính. Không đưa JWT secret hoặc mật khẩu database vào frontend.

## 9. Các file chính để đọc code

| File/thư mục | Vai trò |
|---|---|
| `server/src/models/Category.js`, `Product.js`, `Table.js` | Cấu trúc dữ liệu |
| `server/src/routes/catalogRoutes.js` | Gắn phân quyền admin cho API quản trị |
| `server/src/routes/publicMenuRoutes.js` | API công khai cho khách |
| `server/src/controllers/*Controller.js` | Xử lý từng nhóm chức năng |
| `server/src/utils/catalogValidation.js` | Kiểm tra đầu vào và giới hạn trường được sửa |
| `client/src/pages/admin/` | Biểu mẫu và danh sách quản trị |
| `client/src/pages/customer/CustomerMenuPage.jsx` | Kiểm tra bàn, nhập tên và menu |
| `client/src/api/publicMenuApi.js` | Axios không có JWT cho khách |
| `client/src/components/QrModal.jsx` | Xem và tải QR |
| `server/tests/catalog.test.js` | 17 kiểm thử backend giai đoạn 4 |

Luồng xử lý dễ trình bày: **React gọi Axios → Express kiểm tra quyền và dữ liệu → controller đọc/ghi Mongoose → trả JSON → React cập nhật giao diện**. Với khách, API công khai không có bước đăng nhập, nhưng vẫn kiểm tra bàn và điều kiện hiển thị dữ liệu.
