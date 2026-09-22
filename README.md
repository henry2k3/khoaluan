# Hệ thống quản lý nhà hàng/cafe và gọi món bằng QR

Project khóa luận sinh viên. **Bản hiện tại: hoàn tất 9B — chuẩn bị LAN/demo/production, ngày 22/09/2026.** Nghiệp vụ giữ nguyên đến giai đoạn 8; 9A đã sửa lỗi kết nối database và thu hẹp thông tin nhân viên trong response khách. Không thêm chức năng kinh doanh ở 9B.

Hướng dẫn mới nhất nằm ở **mục 17–22** bên dưới và phần **GIAI ĐOẠN 9B** trong [GIAI_DOAN_9.md](GIAI_DOAN_9.md). Đã có seed/reset an toàn và Express phục vụ React build; chưa deploy hoặc thử điện thoại vật lý. [BAO_VE_KHOA_LUAN.md](BAO_VE_KHOA_LUAN.md) và mục 16 giữ nguyên bản 9C ngày 18/09: những câu “chưa có seed/reset” trong nhật ký đó mô tả thời điểm cũ, được thay thế bằng hướng dẫn 9B hiện tại.

Khách hàng KHÔNG có tài khoản và KHÔNG đăng nhập. Luồng đã chạy: **quét QR bàn → nhập tên → xem menu → thêm giỏ/ghi chú → gửi order → xem đơn**. Staff/admin xác nhận, chuẩn bị, phục vụ và xác nhận đã nhận tiền cho từng đơn; có hủy với lý do khi chờ/đã xác nhận. Bàn được tính trống/đang sử dụng từ các đơn. Socket.IO báo thay đổi để các màn hình tự gọi lại API; vẫn có nút làm mới dự phòng. Admin có dashboard doanh thu, biểu đồ, Top món và đơn gần đây. Chưa có thanh toán online.

Xem [GIAI_DOAN_8.md](GIAI_DOAN_8.md) để hiểu công thức thống kê, thời gian Việt Nam, snapshot, kiểm tra dữ liệu, explain/index, kết quả tính tay A–E và cách demo dashboard.

Xem [GIAI_DOAN_7.md](GIAI_DOAN_7.md) để hiểu room, xác thực socket, các event, reconnect và demo realtime. [GIAI_DOAN_6.md](GIAI_DOAN_6.md) giải thích quy tắc vận hành; [GIAI_DOAN_5.md](GIAI_DOAN_5.md) giải thích giỏ, snapshot giá và mã xem đơn; [GIAI_DOAN_4.md](GIAI_DOAN_4.md) hướng dẫn quản lý danh mục/món/bàn và QR.

### Tài liệu theo từng giai đoạn

| Giai đoạn | File riêng |
|---|---|
| 1 — Phân tích và thiết kế | [GIAI_DOAN_1.md](GIAI_DOAN_1.md) |
| 2 — Tạo nền tảng | [GIAI_DOAN_2.md](GIAI_DOAN_2.md) |
| 3 — Đăng nhập admin/staff | [GIAI_DOAN_3.md](GIAI_DOAN_3.md) |
| 4 — Danh mục, món, bàn, QR và menu | [GIAI_DOAN_4.md](GIAI_DOAN_4.md) |
| 5 — Giỏ hàng và gửi order | [GIAI_DOAN_5.md](GIAI_DOAN_5.md) |
| 6 — Nhân viên xử lý đơn và tình trạng bàn | [GIAI_DOAN_6.md](GIAI_DOAN_6.md) |
| 7 — Realtime bằng Socket.IO | [GIAI_DOAN_7.md](GIAI_DOAN_7.md) |
| 8 — Dashboard và thống kê | [GIAI_DOAN_8.md](GIAI_DOAN_8.md) |
| 9A/9B — Rà soát, LAN/demo/production | [GIAI_DOAN_9.md](GIAI_DOAN_9.md) |
| 9C — Tài liệu bảo vệ và đối chiếu code | [GIAI_DOAN_9.md](GIAI_DOAN_9.md), [BAO_VE_KHOA_LUAN.md](BAO_VE_KHOA_LUAN.md) |

Mỗi file GIAI_DOAN_1–8 là bản ghi tại giai đoạn đó; những câu “chưa có”, số test và bundle cũ không phải kết luận về bản cuối. Xem bảng đối chiếu 9C trước khi dùng lại để trình bày. Bản thiết kế tổng thể được giữ tại [PHAN_TICH_VA_THIET_KE_HE_THONG.md](PHAN_TICH_VA_THIET_KE_HE_THONG.md).

## 1. Thiết kế và các quyết định đã chốt

Đọc [bản phân tích và thiết kế](PHAN_TICH_VA_THIET_KE_HE_THONG.md) để xem toàn bộ yêu cầu, dữ liệu, API và lộ trình.

- Có `cancelled`, chỉ hủy từ `pending` hoặc `confirmed`; lưu lý do, thời gian và người thực hiện nếu là nhân viên/quản lý.
- Đơn hủy không tính doanh thu và không giữ bàn đang sử dụng.
- Mỗi đơn xử lý và thanh toán riêng, chưa thanh toán gộp.
- `completed` nghĩa là đã phục vụ và nhân viên xác nhận thanh toán.
- `User` chỉ có vai trò `admin` hoặc `staff`; tên khách được lưu bằng `orders.customerName`, không tạo User.
- Bản hiện tại vẫn chưa có giao diện/API quản lý nhân viên hoặc đổi/reset mật khẩu; tài khoản tạo bằng CLI `create:user`, không đăng ký công khai. Căn cứ: [authRoutes.js](server/src/routes/authRoutes.js), [createUser.js](server/scripts/createUser.js).

## 2. Cần có trên máy

- Node.js từ **22.12.0** trở lên và npm đi kèm. Nếu dùng Node.js 24 hoặc 26 thì cũng đáp ứng yêu cầu này.
- Docker đang chạy để sử dụng MongoDB cục bộ theo `compose.yaml`, hoặc một MongoDB riêng đã có sẵn.

Vite là công cụ chạy React khi phát triển và đóng gói giao diện khi cần triển khai. Project dùng JavaScript và cú pháp `import`/`export`, chưa dùng TypeScript.

## 3. Cấu trúc thư mục

| Đường dẫn | Mục đích |
|---|---|
| `client/` | Toàn bộ frontend, có `package.json` và thư viện riêng |
| `client/public/` | File tĩnh; có ảnh minh họa `images/coffee.svg` để thử trường imageUrl |
| `client/src/main.jsx` | Điểm bắt đầu React, gắn giao diện vào HTML và bật Router |
| `client/src/index.css` | Nạp Tailwind CSS và các kiểu cơ bản |
| `client/src/api/` | Axios nội bộ có JWT và Axios công khai riêng cho menu khách |
| `client/src/components/` | Thành phần dùng lại: chi tiết/lịch sử đơn, nhãn trạng thái, tình trạng bàn, biểu mẫu, ảnh món và QR |
| `client/src/layouts/` | Khung khách, nội bộ và thanh điều hướng riêng cho staff/admin |
| `client/src/pages/` | Trang kiểm tra kết nối và trang 404 |
| `client/src/pages/customer/` | Menu, giỏ theo QR và trang xem đơn bằng mã riêng |
| `client/src/pages/auth/` | Trang đăng nhập nhân viên và quản lý |
| `client/src/pages/staff/` | Tài khoản, danh sách/chi tiết đơn, tình trạng bàn; trang đơn dùng lại cho admin |
| `client/src/pages/admin/` | Dashboard, trang tài khoản, quản lý danh mục, món, bàn và QR |
| `client/src/contexts/` | AuthContext cho nội bộ; CartContext cho giỏ; StaffRealtimeContext cho kết nối/thông báo nội bộ |
| `client/src/realtime/` | Một socket dùng chung mỗi tab, join/ACK/reconnect và gom các lần refetch |
| `client/src/hooks/` | Tải dữ liệu admin, trạng thái loading/lỗi và thử lại |
| `client/src/routes/` | Khai báo URL và ProtectedRoute kiểm tra đăng nhập/vai trò |
| `client/src/utils/` | Token đăng nhập; lưu giỏ, tên và các mã xem đơn của khách trong trình duyệt |
| `server/` | Toàn bộ backend, có `package.json` và thư viện riêng |
| `server/src/server.js` | Kết nối MongoDB, gắn Express và Socket.IO vào cùng HTTP server; đóng khi dừng |
| `server/src/app.js` | Tạo Express, cấu hình CORS, đọc JSON và gắn các API |
| `server/src/config/` | Đọc cấu hình môi trường và kết nối Mongoose |
| `server/src/routes/` | API health/auth, catalog, order, dashboard chỉ admin và API khách |
| `server/src/controllers/` | Nhận/kiểm tra yêu cầu, đọc danh sách/chi tiết, tính tình trạng bàn và trả JSON |
| `server/src/middlewares/` | Kiểm tra JWT, vai trò, xử lý API không tồn tại và lỗi chung |
| `server/src/models/` | User cho admin/staff; Category, Product, Table và Order |
| `server/src/services/` | Tạo tài khoản; tạo đơn/tính tiền/chống gửi trùng; chuyển trạng thái bằng cập nhật có điều kiện |
| `server/src/sockets/` | Xác thực/join room, kiểm tra tài khoản online, ngắt user và phát thông báo sau khi lưu |
| `server/src/utils/` | JWT, token đơn, quy tắc trạng thái, kiểm tra bộ lọc/dữ liệu đầu vào và lỗi nghiệp vụ |
| `server/scripts/` | Kiểm tra MongoDB, kiểm tra dữ liệu chỉ đọc, explain dashboard và khởi tạo tài khoản |
| `server/tests/` | 292 kiểm thử hiện tại: 234 baseline sau 9A + 58 test 9B; database thử riêng |
| `server/tests-browser/` | Kiểm tra giỏ/đơn, xử lý nội bộ và realtime bằng nhiều cửa sổ Chrome độc lập |
| `compose.yaml` | Chạy MongoDB cục bộ bằng Docker và lưu dữ liệu qua các lần khởi động |
| `.gitignore` | Loại `.env`, thư viện đã cài, bản build và log khỏi Git |

Giai đoạn 3 thêm `bcrypt`, `jsonwebtoken` và `express-rate-limit`. Giai đoạn 4 thêm `qrcode` ở backend. Giai đoạn 5–6 không thêm thư viện chạy ứng dụng. Giai đoạn 7 thêm `socket.io` ở server và `socket.io-client` ở client; server có thêm `socket.io-client` trong devDependencies để chạy kiểm thử kết nối thật. Không có thư viện realtime khác. Backend dùng tính năng sẵn có của Node.js để đọc `.env` và tự chạy lại khi sửa file, nên chưa cần dotenv hoặc nodemon.

Giai đoạn 8 chỉ thêm `chart.js` ở frontend. Dashboard và thư viện biểu đồ tải riêng khi mở trang, không thêm vào lượt tải menu/giỏ. Không cần biến `.env` mới.

## 4. Chuẩn bị lần đầu

Chạy các lệnh dưới đây từ **thư mục gốc project**:

```bash
cp -n client/.env.example client/.env
cp -n server/.env.example server/.env
npm --prefix client ci
npm --prefix server ci
```

Chỉ sao chép `.env.example` khi chưa có `.env`; `cp -n` giữ nguyên file đích đã tồn tại. **Không ghi đè cấu hình/secret hiện có bằng bản mẫu**. Không công bố secret hoặc mật khẩu của máy. Trên máy mới, phải điền `JWT_SECRET` và `ORDER_TOKEN_SECRET` theo mục 6 trước khi chạy backend.

`npm ci` cài đúng phiên bản ghi trong `package-lock.json`. Hai file lock được giữ trong source để các máy cài cùng bộ phiên bản thư viện.

### MongoDB cục bộ bằng Docker

Mở Docker trước, sau đó chạy tại thư mục gốc:

```bash
docker compose up -d mongodb
docker compose ps
```

`-d` nghĩa là chạy trong nền. MongoDB dùng cổng `27017`, chỉ mở trên địa chỉ cục bộ `127.0.0.1`; dữ liệu nằm trong volume Docker tên `restaurant-qr_mongodb_data`.

Cấu hình Docker này dành cho phát triển cục bộ, không có tài khoản/mật khẩu. Nếu dùng MongoDB riêng hoặc Atlas thì không cần chạy container này; thay `MONGODB_URI` trong `server/.env`.

Project dùng MongoDB 7.0 cho môi trường local: bản MongoDB 8.0 đã thử không khởi động được trên kernel `7.0.12-linuxkit` của Docker máy này. MongoDB đã công bố [lỗi tương thích MongoDB 8.x với kernel Linux mới](https://www.mongodb.com/community/forums/t/mongodb-8-x-and-linux-kernel-6-19/337547). Mongoose 9 hỗ trợ MongoDB 7.x theo [bảng tương thích chính thức](https://mongoosejs.com/docs/compatibility.html).

Dừng MongoDB mà vẫn giữ dữ liệu:

```bash
docker compose stop mongodb
```

## 5. Chạy project

Mở **hai terminal** tại thư mục gốc project.

Terminal 1 — backend:

```bash
npm --prefix server run dev
```

Khi thành công sẽ thấy:

```text
Kết nối MongoDB thành công.
Backend đang chạy tại http://localhost:3000
```

Terminal 2 — frontend:

```bash
npm --prefix client run dev
```

Mở **http://localhost:5174**. Trang sẽ tự gọi API kiểm tra và hiển thị trạng thái backend, MongoDB. Nút **Kiểm tra lại kết nối** gửi yêu cầu mới.

Mở **http://localhost:5174/login** để đăng nhập nội bộ. Admin tới `/admin`, có thanh điều hướng đến **Dashboard** (`/admin/dashboard`), đơn hàng, danh mục, món, bàn và QR. Staff tới `/staff`, có thanh điều hướng **Đơn hàng** và **Tình trạng bàn**. Trang tài khoản vẫn có kiểm tra phiên và đăng xuất.

Dùng `Ctrl+C` ở mỗi terminal để dừng. Backend đóng kết nối MongoDB khi dừng bình thường.

Vite dùng cố định cổng `5174` vì cổng `5173` trên máy đã có ứng dụng khác sử dụng. Nếu cổng bận sẽ báo lỗi để bạn xử lý thay vì tự chuyển cổng khiến cấu hình CORS không khớp.

## 6. Cấu hình `.env`

`.env` là file chứa cấu hình riêng của máy chạy. Không đưa file này lên Git. `.env.example` là bản mẫu được giữ trong source.

### `client/.env`

```dotenv
VITE_API_BASE_URL=
```

Để trống: dev tự dùng hostname đang mở với cổng **3000**; production mặc định **`/api`** cùng origin. Không cần Vite proxy, `vite.config.js` giữ nguyên. Nếu `.env` trên máy khác còn ghi `http://localhost:3000/api`, **Henry phải tự bỏ giá trị đó**; cập nhật `.env.example` không tự sửa file local ở máy khác.

Nếu backend dev dùng cổng khác, đặt địa chỉ tùy chỉnh trong **`client/.env.development`**, ví dụ `VITE_API_BASE_URL=http://localhost:3001/api`. File này chỉ dành cho dev; muốn demo LAN thì giá trị tùy chỉnh cũng phải truy cập được từ điện thoại. Khởi động lại Vite sau khi đổi env. Trong cấu hình chuẩn cổng 3000, không cần khai báo biến này ở bất cứ file nào.

`VITE_*` là dữ liệu công khai được nhúng lúc build. Không đặt secret vào đó. `.env`, `.env.local`, `.env.production*` hoặc biến do CI/shell truyền vẫn có thể ghi đè mặc định; trước deploy cần kiểm tra không còn cấu hình API localhost từ trước. Không cần đặt biến riêng để build production cùng domain.

### `server/.env`

```dotenv
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:5174
PUBLIC_APP_URL=http://localhost:5174
MONGODB_URI=mongodb://127.0.0.1:27017/restaurant_qr
JWT_SECRET=
ORDER_TOKEN_SECRET=
```

| Biến | Ý nghĩa |
|---|---|
| `NODE_ENV` | `development` khi dùng Vite; `production` khi Express phục vụ React build |
| `PORT` | Cổng backend lắng nghe |
| `CLIENT_ORIGIN` | Danh sách origin được phép, phân tách dấu phẩy; trim/bỏ dấu `/` cuối; có thể để trống nếu đã đặt PUBLIC_APP_URL |
| `PUBLIC_APP_URL` | Địa chỉ gốc ghi vào QR, luôn được thêm vào danh sách origin; tương thích cấu hình cũ bằng fallback origin CLIENT_ORIGIN đầu tiên |
| `MONGODB_URI` | Chuỗi kết nối MongoDB và tên database |
| `JWT_SECRET` | Chuỗi ngẫu nhiên ít nhất 32 ký tự để ký JWT, chỉ ở backend; bắt buộc điền trước khi chạy |
| `ORDER_TOKEN_SECRET` | Khóa riêng ít nhất 32 ký tự để tái tạo mã xem đơn khi retry; không dùng chung JWT_SECRET, không đổi tùy ý |

**CORS** là cơ chế của trình duyệt kiểm soát việc một trang gọi tới máy chủ khác địa chỉ/cổng. CORS không thay thế đăng nhập và phân quyền.

Nếu backend dev đổi `PORT` khỏi 3000, khai báo `VITE_API_BASE_URL` tương ứng trong `.env.development`. Thêm origin muốn sử dụng vào `CLIENT_ORIGIN`, hoặc đặt nó làm `PUBLIC_APP_URL`. Request không có Origin vẫn qua bước CORS nhưng phải có JWT/trackingToken khi API yêu cầu. Khởi động lại backend sau khi sửa env.

Nếu dùng MongoDB Atlas, thay `MONGODB_URI` bằng chuỗi kết nối thật trong **file `.env` cục bộ**; cần đúng tài khoản database và cấu hình cho phép IP máy kết nối. Không dán chuỗi có mật khẩu vào source, README hoặc `.env.example`.

Trên máy mới, tạo JWT secret bằng lệnh sau rồi dán kết quả vào `JWT_SECRET` trong `server/.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Chạy lệnh sinh chuỗi ngẫu nhiên thêm một lần, dùng giá trị riêng cho `ORDER_TOKEN_SECRET`. Trên máy hiện tại khóa này đã được thêm vào `.env` cục bộ, không có trong source. Giữ ổn định khóa: đổi khóa có thể làm lần gửi bị mất phản hồi không khôi phục được token cũ; token đã lưu ở trình duyệt vẫn được kiểm tra bằng hash trong MongoDB.

Không dùng mật khẩu tài khoản làm JWT secret. Thay secret sẽ khiến các token đã cấp trước đó không còn hợp lệ. Socket.IO dùng cùng `CLIENT_ORIGIN` và cổng backend; địa chỉ socket phía client suy ra từ `VITE_API_BASE_URL`, không cần biến môi trường mới.

## 7. Kiểm tra nền tảng

### Kiểm tra API

```bash
curl -i http://localhost:3000/api/health
```

API trả HTTP `200` khi backend và MongoDB hoạt động, kèm:

```json
{
  "success": true,
  "message": "Frontend → Backend → MongoDB đã kết nối thành công.",
  "data": {
    "backend": "running",
    "database": "connected"
  }
}
```

Controller gửi lệnh `ping` thật tới MongoDB trước khi báo thành công. Nếu backend đang chạy nhưng MongoDB mất kết nối, API trả `503` và trạng thái `disconnected`. Nếu MongoDB chưa sẵn sàng ngay lúc khởi động, backend báo lỗi và dừng, không mở cổng HTTP.

Sau khi MongoDB chạy lại, Mongoose tự thử kết nối lại; có thể mất vài giây. Nhấn kiểm tra lại để lấy trạng thái mới, không cần khởi động lại backend nếu tiến trình vẫn đang chạy.

### Kiểm tra quyền đọc/ghi MongoDB

```bash
npm --prefix server run check:db
```

Script kết nối bằng Mongoose, ping, tạo một bản ghi kiểm tra trong collection `foundation_checks`, đọc lại, rồi xóa đúng bản ghi vừa tạo. Không tạo model hoặc dữ liệu menu/order. Collection rỗng có thể còn lại sau kiểm tra.

### Kiểm tra đóng gói frontend

```bash
npm --prefix client run build
```

Kết quả được tạo trong `client/dist/`. Đây là bước **build**, nghĩa là đóng gói mã frontend thành các file có thể triển khai.

### Luồng cần hiểu khi giải thích code

**Trang React → `healthApi.js` → Axios → `GET /api/health` → controller → Mongoose ping MongoDB → JSON trả về → React hiển thị.**

Frontend không truy cập MongoDB trực tiếp. File `.env` backend chứa địa chỉ database; frontend chỉ biết địa chỉ API.

## 8. Kết quả kiểm tra giai đoạn 2

Đã kiểm tra thực tế ngày **16/09/2026**, với Node.js `26.7.0`, MongoDB Docker `7.0`, backend cổng `3000` và frontend cổng `5174`.

| Kiểm tra | Kết quả |
|---|---|
| Chạy frontend Vite và backend Express | Thành công |
| `npm --prefix client run build` | Thành công |
| `npm --prefix server run check:db` | Ping, ghi, đọc và dọn bản ghi kiểm tra thành công |
| Chrome mở React và Axios gọi API thật | API trả `200`, trang hiển thị kết nối MongoDB thành công |
| CORS | Phản hồi cho đúng origin `http://localhost:5174` |
| Tailwind CSS | Kiểu giao diện đã được áp dụng trong trình duyệt |
| Nút kiểm tra lại | Gửi yêu cầu API mới và cập nhật kết quả |
| React Router | Đường dẫn không tồn tại hiện trang 404; liên kết về trang chính hoạt động |
| Giao diện rộng 375px | Không bị tràn ngang |
| Giả lập chặn kết nối API trong Chrome rồi bỏ chặn | Hiện lỗi và phục hồi sau khi thử lại |
| Tạm dừng MongoDB | API trả `503`; giao diện báo backend chạy nhưng MongoDB mất kết nối |
| Khởi động lại MongoDB | Tự kết nối lại, API trở về `200`, không cần khởi động lại backend |
| API không tồn tại / JSON sai định dạng | Trả JSON lỗi với mã `404` / `400` |
| Lỗi JavaScript chưa được xử lý trong Chrome | Không phát hiện trong các luồng đã kiểm tra |

Các lần kiểm tra chỉ liên quan tới nền tảng, không phải kiểm thử nghiệp vụ đăng nhập/menu/order. MongoDB đã được bật lại sau kiểm tra mất kết nối.

## 9. Xử lý lỗi thường gặp

| Hiện tượng | Cách kiểm tra |
|---|---|
| Báo không tìm thấy `.env` | Sao chép file mẫu vào đúng thư mục `client/` hoặc `server/` |
| Backend không kết nối được MongoDB | Kiểm tra Docker đang chạy, `docker compose ps`, địa chỉ và quyền truy cập MongoDB |
| Frontend không gọi được API | Kiểm tra backend, `VITE_API_BASE_URL`, `CLIENT_ORIGIN` và cổng đang dùng |
| Cổng đã được sử dụng | Dừng tiến trình cũ hoặc đổi cổng và cập nhật cấu hình liên quan |
| Đã sửa `.env` nhưng chưa có tác dụng | Dừng và chạy lại frontend/backend |

## 10. Tài liệu công nghệ chính thức đã tham khảo

- [Vite: bắt đầu và cấu hình chạy React](https://vite.dev/guide/).
- [Tailwind CSS: tích hợp với Vite](https://tailwindcss.com/docs/installation/using-vite).
- [React Router: chế độ khai báo đường dẫn](https://reactrouter.com/start/declarative/installation).
- [Mongoose: kết nối MongoDB](https://mongoosejs.com/docs/connections.html).
- [jsonwebtoken: ký và kiểm tra JWT có thời hạn](https://github.com/auth0/node-jsonwebtoken).
- [bcrypt: băm mật khẩu và giới hạn 72 byte](https://github.com/kelektiv/node.bcrypt.js).
- [express-rate-limit: giới hạn số lần gửi yêu cầu](https://express-rate-limit.mintlify.app/quickstart/usage).

Tailwind được tích hợp bằng plugin Vite và `@import "tailwindcss"`; cấu hình cơ bản này không cần tạo thêm `tailwind.config.js` hay PostCSS riêng.

## 11. Giai đoạn 3 — đăng nhập admin/staff

### Phạm vi

- `User` chỉ có hai vai trò `admin` và `staff`.
- Khách không có tài khoản, không đăng nhập và không có role `customer`.
- Tên khách chỉ là trường hiển thị `customerName` trong thiết kế đơn hàng; chưa tạo Order model ở giai đoạn này.
- Có đăng nhập, đăng xuất trên trình duyệt, khôi phục phiên khi tải lại, kiểm tra quyền ở frontend và backend.
- Chưa có đăng ký công khai, quản lý nhân viên qua giao diện, đổi mật khẩu, menu/order hoặc Socket.IO.

### Tạo tài khoản nội bộ

**Không giả định máy đã có tài khoản hoặc mật khẩu demo mặc định.** Lượt 9C không đọc mật khẩu hoặc tạo tài khoản trong DB chính. Nếu đã có tài khoản, dùng thông tin bạn lưu riêng; nếu chưa có, chạy lệnh dưới đây. Căn cứ: [createUser.js](server/scripts/createUser.js), `createInternalUser` ở [userService.js](server/src/services/userService.js).

Để tạo tài khoản trên máy mới hoặc tạo thêm staff, điền các biến sau trong `server/.env`:

```dotenv
CREATE_USER_ROLE=staff
CREATE_USER_FULL_NAME="Nhân viên"
CREATE_USER_USERNAME=staff
CREATE_USER_PASSWORD=
```

Tự điền mật khẩu vào dòng cuối rồi chạy từ thư mục gốc:

```bash
npm --prefix server run create:user
```

Để tạo admin, dùng `CREATE_USER_ROLE=admin` và tên đăng nhập riêng. Mật khẩu phải có ít nhất 10 ký tự, tối đa 72 byte UTF-8 (một ký tự tiếng Việt có thể dùng nhiều byte). Tên đăng nhập dài 3–50 ký tự, gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang; được lưu chữ thường.

Lệnh này chỉ tạo tài khoản mới, không ghi đè hoặc thay mật khẩu tài khoản đã tồn tại. Đây là công cụ dành cho người phát triển có quyền chạy backend, **không phải API đăng ký cho khách**. Các biến `CREATE_USER_*` chỉ được đọc khi chạy lệnh này; đổi chúng không tự sửa tài khoản trong database. Sau khi lưu mật khẩu ở nơi riêng, có thể xóa `CREATE_USER_PASSWORD` khỏi `.env`.

### Cách đăng nhập

1. Chạy MongoDB, backend và frontend như mục 5.
2. Mở `http://localhost:5174/login`.
3. Nhập username/password của tài khoản nội bộ.
4. Admin được chuyển đến `/admin`, staff đến `/staff`.
5. Nhấn **Kiểm tra quyền truy cập** để gọi API có bảo vệ.
6. Nhấn **Đăng xuất** để xóa phiên trong tab đang dùng.

### API đã triển khai

| Method | API | Quyền và kết quả |
|---|---|---|
| POST | `/api/auth/login` | Nhận username/password; trả JWT và thông tin admin/staff |
| POST | `/api/auth/logout` | JWT nội bộ; ngắt các socket đang online của user, không thu hồi JWT đã sao chép |
| GET | `/api/auth/me` | Yêu cầu JWT hợp lệ và tài khoản còn hoạt động; trả thông tin người đang đăng nhập |
| GET | `/api/auth/admin-check` | Chỉ admin; API nhỏ để xác minh phân quyền, chưa có dữ liệu dashboard |
| GET | `/api/health` | Vẫn công khai để kiểm tra nền tảng |

JWT gửi qua header `Authorization: Bearer <token>`. Mã HTTP `401` nghĩa là chưa xác thực hoặc phiên không hợp lệ; `403` nghĩa là đã xác thực nhưng không có quyền; `429` là đã thử đăng nhập quá nhiều lần.

Đăng nhập sai bị giới hạn 10 lần trong 15 phút theo IP; đăng nhập thành công không bị cộng vào số lần thất bại. Giới hạn lưu trong bộ nhớ của một tiến trình backend hiện tại.

### Luồng code để trình bày

1. `LoginPage.jsx` nhận tên đăng nhập/mật khẩu và gọi `AuthContext.login`.
2. `authApi.js` dùng Axios gửi yêu cầu đến `/api/auth/login`.
3. `authController.js` kiểm tra đầu vào, lấy User và so sánh mật khẩu bằng bcrypt.
4. `token.js` tạo JWT có thời hạn hai giờ. Mật khẩu gốc và bản băm đều không có trong phản hồi.
5. `AuthContext` lưu token vào `sessionStorage`, giữ thông tin tài khoản trong trạng thái React.
6. Axios tự đính kèm token cho các lần gọi API tiếp theo.
7. `requireAuth` kiểm tra chữ ký/thời hạn token rồi đọc lại tài khoản từ MongoDB; `requireRoles` kiểm tra vai trò hiện tại.
8. `ProtectedRoute` chặn trang React theo quyền. Backend vẫn tự kiểm tra, kể cả khi người dùng gọi API trực tiếp.

**Băm mật khẩu** nghĩa là tạo một giá trị để kiểm tra mật khẩu mà không lưu mật khẩu gốc. **JWT** là chuỗi có chữ ký để chứng minh phiên đăng nhập; chữ ký được kiểm tra bằng `JWT_SECRET`. Token hiện tại chỉ mang định danh tài khoản và thông tin phục vụ xác thực; quyền không lấy tùy ý từ frontend.

`sessionStorage` giữ token khi tải lại trong cùng tab. Mật khẩu không được lưu vào trình duyệt bởi code ứng dụng. Khi nhận `401` cho token hiện tại, frontend xóa phiên và yêu cầu đăng nhập lại; lỗi mạng thông thường giữ token và cho phép thử lại.

Giới hạn của phiên bản hiện tại: chưa có cơ chế tự gia hạn token hoặc danh sách thu hồi token. Đăng xuất xóa token ở tab hiện tại và gọi API ngắt socket của user khi có mạng; không vô hiệu hóa bản token đã bị sao chép. Căn cứ: [AuthContext.jsx](client/src/contexts/AuthContext.jsx), `logout` ở [authController.js](server/src/controllers/authController.js). Backend kiểm tra tài khoản còn hoạt động ở từng yêu cầu; nếu tài khoản bị khóa/xóa hoặc đổi quyền, thay đổi có hiệu lực ở yêu cầu tiếp theo. Token trong `sessionStorage` có thể được JavaScript đọc, nên không xem đây là nơi cất bí mật an toàn tuyệt đối.

### Kiểm thử giai đoạn 3

Chạy MongoDB trước rồi chạy:

```bash
npm --prefix server test
npm --prefix client run build
```

Test backend tự tạo database riêng có tên bắt đầu bằng `restaurant_qr_auth_test_`, dùng JWT secret/mật khẩu ngẫu nhiên cho lần test và dọn đúng database đó khi xong. Không tạo hoặc xóa tài khoản thật. Có thể đặt `TEST_MONGODB_URI` nếu cần dùng MongoDB kiểm thử riêng; tài khoản kết nối phải có quyền tạo và dọn database kiểm thử.

Kết quả kiểm tra thực tế ngày 16/09/2026:

- **12/12 test backend thành công:** băm/ẩn mật khẩu; từ chối customer; từ chối trùng username và mật khẩu quá dài; đăng nhập admin/staff; không vượt quyền bằng trường role tự gửi; sai mật khẩu; đầu vào không hợp lệ; token thiếu/sửa/hết hạn; khóa/đổi quyền tài khoản; API health công khai; giới hạn thử mật khẩu.
- **Chrome:** đăng nhập admin/staff, chuyển đúng trang, gọi API có JWT, tải lại giữ phiên, đăng xuất, chặn staff vào admin ở cả giao diện và API, xử lý token sai, phục hồi sau lỗi mạng khi kiểm tra phiên.
- **Giao diện:** trang đăng nhập ở chiều rộng 375px không tràn ngang, ô mật khẩu được che; không phát hiện lỗi JavaScript chưa được xử lý trong các luồng đã thử.
- **Build frontend:** thành công.

Các kiểm tra khóa/đổi quyền dùng dữ liệu kiểm thử để xác minh middleware; chưa triển khai màn hình hoặc API quản lý tài khoản.


## 12. Giai đoạn 5 — giỏ hàng và gửi order

- `/menu/:qrToken`: nhập tên, chọn số lượng/ghi chú và thêm món vào giỏ.
- `/menu/:qrToken/cart`: sửa giỏ, ghi chú toàn đơn và gửi.
- `/orders/:orderId`: xem đơn bằng mã đã lưu trên trình duyệt, có nút làm mới.
- `POST /api/public/orders`: nhận `requestId`, QR, tên khách, mã món, số lượng, ghi chú; backend kiểm tra và tính tiền.
- `GET /api/public/orders/:id`: bắt buộc header `X-Order-Token`, không dùng JWT của khách hoặc token trong URL.

Giỏ lưu theo QR trong `localStorage`. Sau thành công, lưu danh sách đơn và token, rồi xóa phần món/ghi chú của giỏ bằng cùng một lần ghi. Khi chưa nhận được kết quả, giữ nguyên lần gửi và dùng lại `requestId` để tránh tạo trùng. Mỗi lần đặt thêm sau thành công có mã gửi mới và tạo một đơn riêng.

Kiểm tra backend và build từ thư mục gốc:

```bash
npm --prefix server test
npm --prefix client run build
npm --prefix server run check:db
```

Kết quả giai đoạn 5: **65/65 backend test**, frontend build và kiểm tra MongoDB thành công. Kiểm thử Chrome thật xác nhận các thao tác giỏ, lỗi mạng, mất phản hồi sau khi lưu đơn, lưu token thất bại rồi khôi phục, nhiều đơn cùng bàn và giao diện 375px. Cách chạy lại Chrome test và kịch bản demo nằm trong [GIAI_DOAN_5.md](GIAI_DOAN_5.md).

## 13. Giai đoạn 6 — xử lý đơn và tình trạng bàn

- Staff: `/staff/orders`, `/staff/orders/:id`, `/staff/tables`.
- Admin: `/admin/orders`, `/admin/orders/:id`, xem thêm tình trạng tại `/admin/tables`.
- Luồng: `pending → confirmed → preparing → served → completed`. Bước cuối là xác nhận đã nhận đủ tiền cho **đơn đang mở**, lưu `paidAt`.
- Chỉ hủy `pending`/`confirmed`, bắt buộc lý do; giữ đơn và lưu người/thời gian hủy.
- Mỗi bước thêm `statusHistory`. Bàn bận nếu còn ít nhất một đơn pending/confirmed/preparing/served.
- Danh sách mặc định ưu tiên đơn đang xử lý, mới nhất trước; có lọc, phân trang và nút làm mới. Khách làm mới trang đơn để xem cập nhật.

API nội bộ mới, chỉ staff/admin đã đăng nhập:

| API | Công dụng |
|---|---|
| `GET /api/orders` | Lọc và phân trang; mặc định API lấy mọi trạng thái, 20 đơn/trang, tối đa 50 |
| `GET /api/orders/:id` | Chi tiết, lịch sử/người thực hiện, thông tin hủy/thanh toán và các bước được phép |
| `PATCH /api/orders/:id/status` | Gửi `{ "expectedStatus": "pending", "status": "confirmed" }` |
| `PATCH /api/orders/:id/cancel` | Gửi `{ "expectedStatus": "pending", "cancelReason": "Khách đổi ý" }` |
| `GET /api/tables` — mở rộng | Staff/admin đọc tình trạng và số đơn đang xử lý; sửa bàn và xem QR vẫn chỉ admin |

`expectedStatus` là trạng thái nhân viên đang nhìn thấy. Backend chỉ ghi nếu trạng thái trong MongoDB vẫn khớp; dữ liệu đã đổi thì trả `409`, giao diện tải lại và yêu cầu nhân viên kiểm tra trước khi làm tiếp. Không tự gửi lại thao tác cập nhật.

Không cần thêm biến `.env`. Giữ các secret cũ, đặc biệt `ORDER_TOKEN_SECRET` để khách vẫn lấy lại được kết quả của lần gửi trước.

Kết quả ngày 17/09/2026: **127/127 backend test pass** (65 test trước + 62 test vận hành), 0 fail/skipped; frontend build, MongoDB ping/ghi/đọc thành công. Hai script Chrome giai đoạn 5 và 6 chạy thành công; các màn hình đã kiểm tra ở 375px không tràn ngang.

```bash
npm --prefix server test
npm --prefix client run build
npm --prefix server run check:db
# Sau khi mở Chrome kiểm thử riêng và chạy frontend/backend:
npm --prefix server run test:browser:orders
npm --prefix server run test:browser:workflow
```

Hướng dẫn mở Chrome kiểm thử, chi tiết kết quả và kịch bản demo: [GIAI_DOAN_6.md](GIAI_DOAN_6.md).

## 14. Giai đoạn 7 — realtime bằng Socket.IO

- Socket.IO gắn cùng HTTP server Express, không có backend riêng.
- API vẫn tạo/đổi/hủy/đọc đơn; MongoDB là dữ liệu chính thức. Socket chỉ báo thay đổi để gọi lại API.
- Bốn event: `order:created`, `order:updated`, `order:cancelled`, `table:updated`. Chỉ phát sau khi DB ghi thành công, không phát đơn mới khi trả lại requestId cũ. Lỗi emit không làm API thất bại.
- Staff/admin gửi JWT qua handshake auth; server kiểm tra tài khoản và tự join `staff`, `user:<id>`. Không có event xin join staff.
- Khách phải có trackingToken đúng để join `order:<id>`. Token không nằm trong broadcast/URL/log, GET đơn vẫn dùng `X-Order-Token`.
- Mỗi lần connect/reconnect: join lại room → chờ ACK (xác nhận) → refetch API. Không dùng connectionStateRecovery thay thế API.
- Mỗi tab một socket, cleanup đúng handler, gom các lần tải lại trong khoảng 300ms; khách quay lại tab cũng đọc lại đơn.
- Màn hình staff/admin có thông báo đơn mới và trạng thái kết nối. Các nút API/làm mới vẫn dùng được khi socket gián đoạn. Giữ nguyên conflict 409.
- `POST /api/auth/logout` mới yêu cầu JWT, ngắt các socket đang online thuộc tài khoản qua user room. Khóa tài khoản được phát hiện mỗi 5 giây và trước thông báo; chưa có giao diện khóa nhân viên. Logout không thu hồi các bản JWT bị sao chép.

**Không có biến `.env` mới. Chỉ chạy một instance Node.** Nếu muốn nhiều instance cần adapter ngoài phạm vi; không cài Redis, queue hay thư viện realtime khác.

Kết quả ngày 17/09/2026: **157/157 test backend đạt** (127 API cũ không sửa + 30 test Socket.IO), build frontend và MongoDB đạt. Đã chạy lại cả ba script Chrome giai đoạn 5/6/7. Kiểm thử realtime dùng 4 cửa sổ/context độc lập: đơn mới, đủ trạng thái, hủy/lý do, bàn, hai nhân viên, mất mạng/reconnect, ACK trước GET, lỗi 409 và không nhân listener/thông báo. Mobile 375px không tràn ngang trong các màn hình đã kiểm tra.

```bash
npm --prefix server test
npm --prefix client run build
# Backend/frontend và Chrome kiểm thử phải đang chạy:
npm --prefix server run test:browser:realtime
```

Hướng dẫn setup, cách đọc code và demo nhiều cửa sổ: [GIAI_DOAN_7.md](GIAI_DOAN_7.md).

## 15. Giai đoạn 8 — dashboard và thống kê cho admin

Mở `/admin/dashboard`: doanh thu, tổng đơn, đơn đã thanh toán/hủy, giá trị trung bình, tình trạng hiện tại của quán, biểu đồ, Top 10 món và 10 đơn gần đây. Staff không được gọi bất cứ API `/api/dashboard/*` nào.

| API mới — GET, chỉ admin | Nội dung |
|---|---|
| `/api/dashboard/summary` | Số liệu chính và cảnh báo dữ liệu |
| `/api/dashboard/revenue` | Biểu đồ giờ/ngày, mốc trống bằng 0 |
| `/api/dashboard/products` | Số lượng và doanh thu theo snapshot món |
| `/api/dashboard/recent-orders` | Đơn mới nhất được tạo trong kỳ, danh sách giới hạn |

- Revenue/completedOrders/trung bình/món bán chạy: chỉ **completed + paidAt kiểu Date trong kỳ**. Revenue cộng totalAmount đã lưu, không lấy giá Product hiện tại.
- totalOrders/cancelledOrders: lọc **createdAt**. CancelledOrders nghĩa là đơn tạo trong kỳ và hiện đã hủy; không phải số thao tác hủy theo cancelledAt, luôn ≤ totalOrders.
- activeOrders/activeTables/bàn trống: **hiện tại, mọi ngày**, không phụ thuộc kỳ; không lưu status bàn.
- Múi giờ **Asia/Ho_Chi_Minh**. Preset do backend tính từ now: today, 7d (hôm nay + 6 ngày trước), 30d, month (+ month=YYYY-MM). API hỗ trợ from/to YYYY-MM-DD, tối đa 366 ngày, from=to hợp lệ. Khoảng nửa mở từ 00:00 VN đến trước 00:00 ngày sau to.
- Today vẽ 24 giờ, các kỳ khác vẽ theo ngày. Tên món thống kê lấy snapshot mới nhất trong kỳ sau khi group theo productId; Product đổi tên/giá/ẩn không sửa lịch sử.
- Realtime dùng lại bốn event giai đoạn 7; debounce 1,5 giây, tab ẩn chờ hiện lại; kỳ không chứa hôm nay bỏ qua event. Reconnect sau ACK đọc lại API. Đổi bộ lọc hủy request cũ.

Trước khi triển khai với dữ liệu của quán, chạy kiểm tra **chỉ đọc**:

```bash
npm --prefix server run check:data
```

Nếu phát hiện completed thiếu/sai paidAt, lineTotal sai, totalAmount sai hoặc thiếu productId: **dừng và chờ quyết định xử lý**, không tự sửa/backfill. Kết quả trước giai đoạn 8: database restaurant_qr có **0 đơn**, cả bốn nhóm lỗi đều **0**. Dashboard vẫn cảnh báo khi có completed thiếu/sai paidAt xuất hiện sau này.

Đã đo explain và thêm đúng một index `{ status: 1, paidAt: 1 }`; giữ index createdAt hiện có. Trên 3.660 đơn trong database thử, query một ngày giảm từ đọc 3.660 xuống 10 document, cùng trả 10 đơn. Hai query doanh thu/số đơn dùng IXSCAN; không có COLLSCAN trong kế hoạch đã kiểm tra.

```bash
npm --prefix server run explain:dashboard
npm --prefix server test
npm --prefix client run build
# Sau khi mở Chrome kiểm thử ở cổng 9224 theo giai đoạn 7:
npm --prefix server run test:browser:dashboard
```

Kết quả: **211/211 backend test đạt** (157 cũ giữ nguyên + 54 mới), build thành công; Chrome dashboard và ba script Chrome cũ giai đoạn 5/6/7 đều đạt, 375px không tràn ngang trong các màn hình đã kiểm tra. Bộ A–E đúng revenue **300.000đ**, totalOrders **4**, completedOrders **2**, trung bình **150.000đ**, activeOrders **2**, activeTables **1**; Cà phê sữa **6 ly/150.000đ** dù Product đã đổi giá lên 30.000đ.

Script Chrome dashboard tự mở frontend thử cổng 5175, API cổng ngẫu nhiên và database riêng; dùng giờ cố định, tự dọn sau khi xong. Không sửa `.env` hoặc dữ liệu đang có của quán. Không chạy đồng thời hai bản script dashboard.

Hướng dẫn code, quy ước từng field, bộ dữ liệu tính tay đầy đủ, kết quả test và demo: [GIAI_DOAN_8.md](GIAI_DOAN_8.md).


## 16. Bản đối chiếu cuối 9C — tài liệu bảo vệ

Lượt này chỉ thay đổi Markdown, không đổi chức năng hoặc dependency. Chi tiết: [GIAI_DOAN_9.md](GIAI_DOAN_9.md). Bộ hướng dẫn nói trước hội đồng, checklist trước demo, kịch bản 5–8 phút, dự phòng, Q&A và Mermaid: [BAO_VE_KHOA_LUAN.md](BAO_VE_KHOA_LUAN.md).

Kết quả chạy lại ngày 18/09/2026:

| Lệnh từ thư mục gốc | Kết quả thực tế |
|---|---|
| `npm --prefix server test` | 211 test / 6 suite, 211 pass, 0 fail/skipped/cancelled |
| `npm --prefix client run build` | Thành công; JS chính 424,97 kB, dashboard 160,76 kB, CSS 25,73 kB (kích thước Vite báo, chưa gzip) |
| `npm --prefix server run check:data` | 4 nhóm lỗi đều 0; DB có 0 order/0 item, chưa phải bộ dữ liệu demo |
| `npm --prefix server run explain:dashboard` | Hai query dùng IXSCAN; DB trống nên examined/returned đều 0; không thêm index ở 9C |

Không chạy lại Chrome/điện thoại thật trong 9C; kết quả trình duyệt/375px ở mục giai đoạn 6–8 là kết quả lịch sử. Script kiểm thử nằm trong [server/package.json](server/package.json), quy trình build tại [client/package.json](client/package.json). Nguồn kiểm tra dữ liệu: [checkData.js](server/scripts/checkData.js); nguồn explain: [explainDashboard.js](server/scripts/explainDashboard.js).

Chạy local sau khi đã cài dependency, cấu hình `.env` và có MongoDB:

```bash
# Từ thư mục gốc, nếu dùng MongoDB Docker cục bộ:
docker compose up -d mongodb
# Terminal 1:
npm --prefix server run dev
# Terminal 2:
npm --prefix client run dev
```

Mở `http://localhost:5174/login`; backend ở cổng 3000. Khi demo điện thoại, đổi `CLIENT_ORIGIN`, `PUBLIC_APP_URL`, `VITE_API_BASE_URL` sang địa chỉ LAN phù hợp và chạy frontend với `npm --prefix client run dev -- --host 0.0.0.0`; xem checklist chi tiết trong tài liệu bảo vệ. Căn cứ: [env.js](server/src/config/env.js), [vite.config.js](client/vite.config.js), `getTableQr` ở [tableController.js](server/src/controllers/tableController.js).

**Chuẩn bị dữ liệu bằng chức năng hiện có:** chưa có `reset:demo`/`seed:demo`; tạo tài khoản còn thiếu bằng mục 11, tạo danh mục/món/Bàn 05 bằng admin, xử lý hết các đơn thử của bàn theo luồng hợp lệ, rồi chạy check:data. Không xóa DB hoặc volume để thay cho script reset chưa có. Phải tạo QR lại theo mạng tại phòng, thử điện thoại, tập có bấm giờ và tự quay video dự phòng trước ngày bảo vệ.

## 17. 9B — Chạy LAN và điện thoại

**[TOOL CHẠY THỦ CÔNG — đọc cấu hình/code]** QR dựng ở backend, hàm `getTableQr` trong [tableController.js](server/src/controllers/tableController.js), từ `PUBLIC_APP_URL`. MongoDB chỉ giữ `qrToken`. Đổi IP/domain: sửa env và **restart backend**, mở lại QR; không đổi token, không cần build lại frontend chỉ vì đổi địa chỉ QR. Nếu tự khai báo `VITE_API_BASE_URL`, thay giá trị này ở production thì phải build lại vì Vite nhúng nó vào bundle.

**[TOOL CHẠY THỦ CÔNG — đọc cơ chế sessionStorage]** Origin gồm giao thức + hostname + cổng. JWT nằm trong sessionStorage, không phải localStorage. Trong checklist demo: **mở tab mới độc lập hoặc đổi từ localhost sang IP đều phải đăng nhập lại**. Một số cách nhân bản tab/mở tab có opener có thể sao chép sessionStorage ban đầu; không dựa vào hành vi đó để chuẩn bị demo. Giỏ/token khách dùng localStorage cũng tách theo origin: đổi IP/domain không tự chuyển đơn đã lưu ở origin cũ.

Thực hiện theo thứ tự; `<IP-Mac>` là IP thật của máy, không chép nguyên ký hiệu này vào env:

| Bước | Thao tác | Kết quả đúng cần thấy |
|---|---|---|
| 1 | Kết nối Mac và điện thoại cùng Wi-Fi | Hai thiết bị dùng mạng cho phép liên lạc với nhau |
| 2 | Chạy `ipconfig getifaddr en0`; nếu không có kết quả, xem Wi-Fi → Details → TCP/IP trên Mac | Lấy được IP hiện tại; không dùng IP cũ |
| 3 | Chạy `docker compose up -d mongodb` tại gốc project | MongoDB healthy; không cần mở cổng MongoDB cho điện thoại |
| 4 | Trong `server/.env`, đặt `PUBLIC_APP_URL=http://<IP-Mac>:5174` và `CLIENT_ORIGIN=http://localhost:5174,http://<IP-Mac>:5174` | QR hướng tới điện thoại; cả hai origin được phép |
| 5 | Giữ `client/.env` có `VITE_API_BASE_URL=`; bỏ override dev cũ nếu đang có | Frontend tự chọn backend cùng hostname, cổng 3000 |
| 6 | Chạy/restart `npm --prefix server run dev` | Backend kết nối MongoDB, lắng nghe cổng 3000 trên các interface |
| 7 | Terminal khác: `npm --prefix client run dev -- --host 0.0.0.0` | Vite phục vụ cổng 5174 qua LAN |
| 8 | Điện thoại mở `http://<IP-Mac>:5174`; laptop đăng nhập lại admin/staff ở origin sẽ dùng | Trang tải được; API health báo connected |
| 9 | Admin mở `/admin/tables`, xem QR Bàn 05 đang hoạt động và trống | URL QR bắt đầu bằng IP LAN, không phải localhost |
| 10 | Điện thoại quét QR, nhập tên, thêm hai món và ghi chú “ít đá” | Menu/giỏ đúng Bàn 05, tính tổng tạm tính |
| 11 | Gửi order | Chuyển sang trang đơn; laptop staff tự thấy đơn mới |
| 12 | Staff xác nhận → chuẩn bị → phục vụ | Điện thoại tự cập nhật từng trạng thái |
| 13 | Staff xác nhận đã nhận tiền và hoàn thành | Khách thấy hoàn thành, dashboard tăng tiền, bàn trống nếu không còn đơn khác |

Nguồn: [baseUrl.js](client/src/api/baseUrl.js), [env.js](server/src/config/env.js), [realtimeServer.js](server/src/sockets/realtimeServer.js). Danh sách origin được parse một lần, cộng origin PUBLIC_APP_URL, so khớp chính xác; không wildcard. `crypto.getRandomValues` đang dùng để sinh requestId chạy được trên HTTP LAN; không đổi sang `crypto.randomUUID` hoặc thêm clipboard yêu cầu secure context.

**[TEST TỰ ĐỘNG]** Đã chạy Chrome desktop qua IP LAN/HTTP không secure context với bản React production: đặt món, giữ tracking khi reload, realtime, mất mạng/rejoin/refetch, dashboard/bàn và 375px đạt. Đây là cùng máy Mac gọi qua IP của mình, không chứng minh Wi-Fi cho phép điện thoại khác truy cập.

**[CHƯA KIỂM TRA — Henry cần làm]** Thử điện thoại vật lý Android Chrome/iOS Safari: khóa màn hình rồi mở lại; chuyển app rồi quay lại; tắt Wi-Fi 20 giây rồi bật; reload đơn không mất tracking. Sau khi đổi origin, đăng nhập lại staff/admin, mở lại QR, không in QR theo IP cũ.

Lỗi thường gặp và cách xử lý:

| Hiện tượng | Kiểm tra/xử lý |
|---|---|
| Không mở được frontend | Kiểm tra IP mới, `--host`, Mac không ngủ và firewall cho phép Node/Vite cổng 5174 |
| Có UI nhưng API/socket lỗi | Backend đang chạy cổng 3000, firewall cho phép cổng này; kiểm tra origin và env dev cũ |
| Cùng tên Wi-Fi vẫn không truy cập được | Wi-Fi khách có AP/client isolation: chặn thiết bị nói chuyện trực tiếp; dùng hotspot điện thoại rồi cho Mac kết nối, lấy lại IP và sinh lại QR |
| Một thiết bị vào được, thiết bị khác không | Kiểm tra cùng mạng/subnet, VPN/route và cổng; tạm ngắt VPN để xác định nguyên nhân |
| QR mở địa chỉ cũ | Cập nhật PUBLIC_APP_URL, restart backend, mở/tải lại QR |
| Backend chỉ mở localhost ở cấu hình khác | Code hiện tại `server.listen(env.port)` không giới hạn localhost; kiểm tra wrapper/proxy hoặc cấu hình triển khai bên ngoài |

## 18. 9B — Seed và reset demo

**[TOOL CHẠY THỦ CÔNG — đối chiếu script]** Seed/reset chỉ là lệnh CLI, không có API hoặc nút frontend. Dùng database demo riêng; không trỏ vào database quán đang có dữ liệu. Trong `server/.env`, tự cấu hình:

```dotenv
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/restaurant_qr_demo
DEMO_DB_NAME=restaurant_qr_demo
DEMO_ADMIN_PASSWORD=
DEMO_STAFF_PASSWORD=
```

Điền hai mật khẩu riêng do Henry chọn, ít nhất 10 ký tự và tối đa 72 byte UTF-8; không để trống, không commit file này. Giữ cấu hình PUBLIC_APP_URL/JWT_SECRET/ORDER_TOKEN_SECRET đã có. Đổi database trong env xong cần restart backend để giao diện đọc đúng database demo. Nếu muốn quay lại dữ liệu quán, trỏ lại database cũ; không reset nó.

```bash
# Database demo rỗng:
npm --prefix server run seed:demo
npm --prefix server run check:data

# Chỉ khi chủ động muốn xóa toàn bộ database demo để làm lại:
npm --prefix server run reset:demo -- --confirm
npm --prefix server run seed:demo
```

Không chạy hai tiến trình seed/reset đồng thời; dừng backend demo trước khi reset và mở lại sau khi seed xong. Reset tạo lại ID/qrToken khi seed lần sau; mở QR mới và xóa giỏ thử cũ nếu cần. Không tự reset để chữa seed lỗi giữa chừng: script giữ nguyên dữ liệu đã ghi và báo cần người vận hành quyết định.

| Dữ liệu | Số lượng/nội dung |
|---|---|
| Users | 3: `demo_admin`, `demo_staff1`, `demo_staff2`; hai staff dùng DEMO_STAFF_PASSWORD |
| Categories | 5 |
| Products | 20 |
| Tables | 10; **Bàn 05 hoạt động, QR hợp lệ, không có đơn đang xử lý** |
| Orders | 12: 8 completed, 1 cancelled, 1 pending, 1 confirmed, 1 preparing |
| Order items | 24 dòng snapshot |
| Thời gian | Hôm nay, hôm qua, 3 và 6 ngày trước theo ngày Việt Nam; không dùng ngày cố định |

**[TEST TỰ ĐỘNG]** Seed dùng [createInternalUser](server/src/services/userService.js), bcrypt băm mật khẩu; ba tài khoản đều đăng nhập được. Database rỗng được tạo đủ index, kể cả unique. Seed từ chối khi bất kỳ collection nào đã có dữ liệu; không tự xóa. Mật khẩu demo bắt buộc ở mọi môi trường, kể cả production. Thêm lớp bảo vệ: seed cũng phải đúng DEMO_DB_NAME thực tế và không dùng database hệ thống.

**[TEST TỰ ĐỘNG]** Reset chỉ chạy khi đồng thời: NODE_ENV khác production, `mongoose.connection.name` đúng DEMO_DB_NAME, có `--confirm`. Không parse URI để quyết định quyền xóa. Trước khi xóa, in đúng host và database, không in URI/user/password. Test xác nhận database khác vẫn nguyên vẹn. Nguồn: [seedDemo.js](server/scripts/seedDemo.js), [demoData.js](server/scripts/demoData.js), [resetDemo.js](server/scripts/resetDemo.js), [demo.test.js](server/tests/demo.test.js).

**[TEST TỰ ĐỘNG]** `check:data` được CLI seed chạy tự động: 12 orders/24 items, bốn nhóm lỗi đều 0. Bằng chứng lấy từ database thử có dữ liệu thật, được dọn sau test; chưa seed/reset database quán hoặc tạo mật khẩu demo cố định trên máy Henry. Đơn mẫu để xem dashboard/nội bộ; trình duyệt không được cấp token xem những đơn mẫu này. Khi demo khách, dùng QR Bàn 05 tạo đơn mới.

## 19. 9B — Build và chạy production local

**[TOOL CHẠY THỦ CÔNG — đọc code và chạy build]** Express **5.2.1** phục vụ thư mục **`client/dist`**. React, API và Socket.IO dùng cùng một Node server/origin. Route SPA dùng `/{*path}`, sau API và Socket.IO; không dùng `app.get('*')` không tương thích Express 5. API không tồn tại vẫn JSON 404; asset thiếu không bị trả nhầm HTML.

Từ gốc project, **build client trước rồi start server**. Dừng backend dev đang chiếm cổng 3000 trước khi chạy bản production local; không cần chạy Vite:

```bash
npm --prefix client run build
NODE_ENV=production PORT=3000 PUBLIC_APP_URL=http://localhost:3000 CLIENT_ORIGIN= TRUST_PROXY=0 npm --prefix server start
```

Các biến gán trước lệnh chỉ áp dụng tiến trình đó; secret và MONGODB_URI vẫn đọc từ `server/.env`. Lệnh start dùng `--env-file-if-exists`, nên hosting chỉ truyền env cũng chạy được mà không cần tạo `.env`. Mở `http://localhost:3000`, `/login`, `/admin/dashboard`. Origin mới dùng cổng 3000: đăng nhập lại, giỏ/token ở cổng 5174 không tự chuyển sang.

```bash
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/admin/dashboard
curl -i http://localhost:3000/api/duong-dan-khong-ton-tai
# Không có output là đạt; rg trả exit 1 khi không tìm thấy:
rg 'localhost:3000' client/dist
```

**[TEST TỰ ĐỘNG]** Refresh `/`, `/login`, `/admin/dashboard`, `/menu/abc`, `/orders/123` trả React; API lạ trả JSON 404. Chrome chạy bản build thật qua Express đã đăng nhập/đặt món/xử lý/realtime thành công. Không coi việc trả index.html là bỏ qua phân quyền: React vẫn kiểm tra phiên, backend API vẫn kiểm tra JWT/role.

## 20. 9B — Chuẩn bị deploy

**[TOOL CHẠY THỦ CÔNG — chuẩn bị cấu hình và đọc code]** Kiến trúc mặc định: HTTPS reverse proxy của hosting → **một Node instance** chạy Express + Socket.IO → MongoDB. Proxy chuyển tiếp cả HTTP và WebSocket `/socket.io/`; frontend gọi `/api`. Giữ nguyên room/rejoin/ACK/refetch; không Redis hoặc backend socket riêng.

Hosting cần chạy Node liên tục, hỗ trợ WebSocket và env, HTTPS/WSS. Không chọn dịch vụ chỉ chạy serverless request ngắn. Giữ cả cấu trúc `server/` và `client/dist/` trong bản triển khai vì server tìm build theo vị trí file, không theo thư mục terminal.

Các lệnh build trên hosting, tại gốc repo:

```bash
npm --prefix client ci --include=dev
npm --prefix client run build
npm --prefix server ci --omit=dev
```

Sau đó cấu hình start command:

```bash
npm --prefix server start
```

Vite/Tailwind là công cụ build nên client cần devDependencies ở bước build, dù hosting đặt NODE_ENV=production. Không cần client devDependencies để chạy Express sau build. Trên hosting đã có env, kiểm tra dữ liệu bằng `node server/scripts/checkData.js`; lệnh này không yêu cầu `.env` vật lý.

| Biến production | Cấu hình |
|---|---|
| NODE_ENV | `production` |
| PORT | Cổng hosting cấp hoặc cổng đã chọn |
| MONGODB_URI | MongoDB Atlas/MongoDB tương thích, tài khoản và quyền/IP phù hợp; giữ bí mật |
| JWT_SECRET | Khóa ngẫu nhiên riêng ≥32 ký tự, giữ ổn định |
| ORDER_TOKEN_SECRET | Khóa riêng ≥32 ký tự, giữ ổn định để retry khôi phục token |
| PUBLIC_APP_URL | `https://domain-thuc-te.com`; backend dựng QR từ đây |
| CLIENT_ORIGIN | Có thể bỏ trống khi cùng domain; PUBLIC_APP_URL luôn được cho phép |
| TRUST_PROXY | Mặc định `0` khi Node trực tiếp; số hop proxy tin cậy đúng topology hosting, thường `1` nếu thực sự chỉ có một proxy |
| VITE_API_BASE_URL | Không cần đặt; mặc định `/api`, không chứa secret |

Không dùng `TRUST_PROXY=true`; chỉ cấu hình số hop khi đã biết đường đi qua proxy và không có đường truy cập ngắn hơn cho phép giả X-Forwarded-For. Chưa thử proxy hosting thật; cấu hình sai có thể làm rate limit nhận nhầm IP hoặc sai protocol. Các biến DEMO_* chỉ cấu hình ở môi trường demo, không đưa tài khoản mẫu vào hệ thống kinh doanh production.

**[CHƯA KIỂM TRA — Henry cần làm]** Chưa deploy, kiểm tra HTTPS/WSS thực tế, proxy/log hosting, Atlas hoặc free plan. Không khẳng định gói nào miễn phí hay mất bao lâu để wake. Nếu chọn gói có sleep/hibernate, xác minh điều kiện và thời gian khởi động từ tài liệu chính thức của nhà cung cấp: khi server ngủ, API/socket có thể gián đoạn; mở hệ thống trước buổi bảo vệ, thử lại kết nối. Không coi build/local production thành công là deployment thành công.

## 21. 9B — Backup/restore MongoDB

Backup là bản sao để khôi phục khi mất dữ liệu; nên làm trước thay đổi lớn. Với quy mô demo, dừng các tiến trình ghi dữ liệu trong lúc sao lưu để các collection nhất quán. Không coi một file dump chưa từng thử khôi phục là bảo đảm phục hồi được.

Dùng MongoDB Database Tools hoặc tools đã có trong container MongoDB local. Tại gốc project, đổi tên file mỗi lần để tránh ghi đè bản cũ:

```bash
mkdir -p backups
docker compose exec -T mongodb mongodump --db restaurant_qr_demo --archive --gzip > backups/demo-before-change.archive.gz
```

Restore thử vào **database khác, mới và rỗng**; tên `restaurant_qr_restore_check` phải được xác nhận chưa có dữ liệu. Không dùng `--drop`, không trỏ vào DB hiện tại:

```bash
docker compose exec -T mongodb mongorestore --archive --gzip --nsFrom='restaurant_qr_demo.*' --nsTo='restaurant_qr_restore_check.*' < backups/demo-before-change.archive.gz
MONGODB_URI=mongodb://127.0.0.1:27017/restaurant_qr_restore_check npm --prefix server run check:data
```

`--archive --gzip` tạo/đọc bản nén; `--nsFrom/--nsTo` đổi database đích khi phục hồi. Xem hướng dẫn chính thức [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) và [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/). Nếu không dùng Docker, gọi trực tiếp hai lệnh với `--host`, `--port` và đường dẫn `--archive=...` trên máy có Database Tools.

Khi dùng Atlas/DB có mật khẩu, dùng file YAML riêng ngoài Git qua `--config` hoặc nhập mật khẩu qua prompt; không dán URI có password vào command/history. Giới hạn quyền file và giữ backup ở nơi riêng, không public. Lưu secret vận hành bằng cơ chế bảo mật riêng để khôi phục ứng dụng; không đưa secret vào source. Atlas có thể có backup theo gói: **[CHƯA KIỂM TRA — Henry cần làm]** xác minh quyền/gói đang dùng, không mặc định là đã có backup.

**[TOOL CHẠY THỦ CÔNG — gọi `--version`]** Container hiện có mongodump/mongorestore **100.18.0**. **[CHƯA KIỂM TRA — Henry cần làm]** Chưa chạy dump/restore thực tế ở lượt này; không restore hoặc xóa DB hiện tại.

## 22. 9B — Kiểm thử và checklist cuối

```bash
npm --prefix server test
npm --prefix client run build
```

**[TEST TỰ ĐỘNG]** Backend **292/292** đạt, 9 suites, 0 fail/skipped/cancelled: 234 baseline + 58 mới. Không xóa/skip/nới assertion test cũ. Test seed/reset dùng tên database ngẫu nhiên riêng, khác DEMO_DB_NAME thật và dọn sau khi chạy.

**[TOOL CHẠY THỦ CÔNG — output build Vite 8.3.0]** 236 modules; HTML 0,47 kB, CSS 25,73 kB (gzip 5,73), JS chính 425,06 kB (gzip 131,16), dashboard 160,76 kB (gzip 56,01). Không tìm thấy `localhost:3000` hoặc giá trị secret server đã đối chiếu trong build.

Test Chrome production chạy **riêng**, không nằm trong npm test. Dùng `fetch`, `WebSocket`, `node:http`, `node:fs` của Node và các package project đã có; không thêm Playwright/Puppeteer. Trước hết mở một Chrome thử riêng, không dùng profile đang đăng nhập cá nhân:

```bash
# Terminal Chrome; giữ mở trong lúc test. Cổng 9224 cần trống.
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-first-run --remote-debugging-port=9224 --user-data-dir=/private/tmp/restaurant-9b-chrome about:blank
```

```bash
# Terminal khác, sau build và MongoDB đang chạy:
npm --prefix server run test:browser:production
# Thử qua IP Mac, thay <IP-Mac> bằng IP thật:
BROWSER_HOST=<IP-Mac> npm --prefix server run test:browser:production
```

Script tự mở/dừng Express cổng ngẫu nhiên, seed và dọn database thử; không cần Vite/backend chính chạy. `CHROME_DEBUG_URL` đổi địa chỉ debug nếu dùng cổng khác. Dừng Chrome thử sau khi xong. Ba browser script cũ nhận thêm `BROWSER_FRONTEND_URL` nếu muốn chọn origin cụ thể; mặc định dùng origin đầu tiên trong CLIENT_ORIGIN hoặc PUBLIC_APP_URL. Không đổi assertion của chúng.

**[CHƯA KIỂM TRA — Henry cần làm]** Trước bảo vệ: cấu hình database demo và mật khẩu trên máy sẽ dùng; seed/check:data; thử Android/iOS thật; kiểm tra mạng phòng; đăng nhập lại từng tab/origin admin/staff; Bàn 05 trống; sinh QR theo mạng hiện tại; thử khóa màn hình/chuyển app/mất Wi-Fi 20 giây; tập có bấm giờ và quay video dự phòng. Nếu dùng bản deploy, kiểm tra HTTPS/WSS, proxy, server thức và backup/restore trên database thử trước.

**ĐÃ DỪNG SAU 9B — KHÔNG THỰC HIỆN LẠI 9C.**
