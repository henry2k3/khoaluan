# Giai đoạn 2 — Tạo nền tảng

Tài liệu này tách phần nền tảng đã có trong README thành hướng dẫn riêng. Các kết quả giai đoạn 2 bên dưới được ghi nhận trong README ngày **16/09/2026**. Code hiện tại đã phát triển tiếp đến giai đoạn 5; các ví dụ cấu hình chạy máy mới đã cập nhật để dùng được với code hiện tại.

## 1. Mục tiêu và kết quả

Tạo nền để **React gọi được Express, Express kết nối được MongoDB**. Giai đoạn 2 chưa triển khai đăng nhập, menu, order hoặc Socket.IO nghiệp vụ.

Đã tạo:

- Frontend React bằng Vite, dùng JavaScript.
- Tailwind CSS để viết giao diện, React Router để chuyển trang, Axios để gọi API.
- Backend Node.js + Express, đọc cấu hình `.env`, cấu hình CORS, nhận JSON, xử lý lỗi chung.
- Kết nối MongoDB bằng Mongoose, chỉ mở cổng backend sau khi kết nối thành công.
- Trang kiểm tra kết nối, API health, script kiểm tra đọc/ghi MongoDB.
- Cấu trúc thư mục, `.env.example`, `.gitignore`, Docker Compose cho MongoDB local.

**Vite** là công cụ chạy frontend khi phát triển và đóng gói khi triển khai. **CORS** cho phép trình duyệt đọc phản hồi từ backend khác địa chỉ/cổng; CORS không thay thế đăng nhập.

## 2. Các thư mục dùng để làm gì?

| Đường dẫn | Mục đích |
|---|---|
| `client/` | Frontend và thư viện riêng |
| `client/src/main.jsx` | Bắt đầu React, gắn Router vào ứng dụng |
| `client/src/index.css` | Nạp Tailwind và kiểu dùng chung |
| `client/src/pages/` | Các trang, ban đầu gồm trang kết nối và 404 |
| `client/src/components/` | Các phần giao diện dùng lại |
| `client/src/layouts/` | Khung trang dùng chung |
| `client/src/api/` | Các hàm Axios gọi backend |
| `client/src/routes/` | Đường dẫn React |
| `client/src/contexts/`, `hooks/`, `utils/` | Chỗ cho dữ liệu dùng chung, logic tái sử dụng và hàm hỗ trợ ở các giai đoạn tiếp theo |
| `client/public/` | File tĩnh như ảnh |
| `server/` | Backend và thư viện riêng |
| `server/src/server.js` | Kết nối database, mở cổng HTTP, đóng khi dừng |
| `server/src/app.js` | Tạo Express, gắn cấu hình, route và xử lý lỗi |
| `server/src/config/` | Đọc biến môi trường, kết nối MongoDB |
| `server/src/routes/` | Khai báo các đường dẫn API |
| `server/src/controllers/` | Nhận yêu cầu, xử lý và trả phản hồi |
| `server/src/middlewares/` | Các bước chung như kiểm tra và xử lý lỗi |
| `server/src/models/`, `services/`, `utils/` | Chỗ cho cấu trúc dữ liệu, nghiệp vụ và hàm hỗ trợ; bổ sung qua các giai đoạn |
| `server/src/sockets/` | Dành cho Socket.IO, chưa triển khai ở nền tảng |
| `server/scripts/` | Chạy các công việc nội bộ, gồm kiểm tra database |
| `compose.yaml` | Chạy MongoDB local bằng Docker |
| `.gitignore` | Không đưa `.env`, node_modules, dist hoặc log vào Git |

Các thư mục ban đầu dành chỗ không có nghĩa là đã có nghiệp vụ tương ứng. Danh sách file đầy đủ của từng phần nằm ở tài liệu giai đoạn 3–5.

## 3. Luồng kiểm tra nền tảng

```text
Trang React
  → healthApi.js / Axios
  → GET /api/health
  → healthController.js
  → Mongoose gửi ping đến MongoDB
  → JSON kết quả
  → React hiển thị trạng thái
```

**Ping** là gửi yêu cầu nhỏ để kiểm tra database thực sự phản hồi. Frontend không truy cập MongoDB trực tiếp.

API `GET /api/health` công khai:

- `200` khi backend và MongoDB hoạt động.
- `503` nếu backend vẫn chạy nhưng không kiểm tra được MongoDB.
- JSON có `success`, `message`, `data.backend`, `data.database`.

Nếu MongoDB chưa sẵn sàng lúc khởi động, backend báo lỗi và dừng. Nếu mất kết nối sau khi đã khởi động, Mongoose tự thử kết nối lại; nút kiểm tra trên giao diện gọi lại API.

## 4. Chuẩn bị và chạy project

Cần Node.js đáp ứng `engines` trong package.json, npm và MongoDB. Máy hiện tại đã chạy thành công bằng Node.js **26.7.0** và MongoDB Docker **7.0**.

Lần đầu trên máy mới, từ gốc project:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
npm --prefix client ci
npm --prefix server ci
```

**Chỉ sao chép khi chưa có `.env`**, tránh ghi đè cấu hình/khóa đã có. `npm ci` cài theo package-lock.json, giúp các máy dùng cùng phiên bản.

Mở Docker rồi chạy:

```bash
docker compose up -d mongodb
docker compose ps
```

MongoDB local dùng `127.0.0.1:27017`. Volume Docker giữ dữ liệu qua các lần khởi động. Muốn dừng mà giữ dữ liệu:

```bash
docker compose stop mongodb
```

Mở hai terminal ở thư mục gốc:

```bash
# Terminal backend
npm --prefix server run dev
```

```bash
# Terminal frontend
npm --prefix client run dev
```

Mở **http://localhost:5174**. Backend ở **http://localhost:3000**. Dùng Ctrl+C ở từng terminal để dừng. Vite cố định cổng 5174 vì cổng 5173 trên máy có ứng dụng khác.

## 5. Cấu hình `.env`

`client/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api
```

Biến `VITE_` được đưa vào frontend và có thể bị người dùng xem. Không để secret trong frontend.

`server/.env` với code hiện tại:

```dotenv
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:5174
PUBLIC_APP_URL=http://localhost:5174
MONGODB_URI=mongodb://127.0.0.1:27017/restaurant_qr
JWT_SECRET=
ORDER_TOKEN_SECRET=
```

| Biến | Ý nghĩa và giai đoạn sử dụng |
|---|---|
| `PORT` | Cổng backend |
| `CLIENT_ORIGIN` | Địa chỉ frontend được CORS cho phép |
| `MONGODB_URI` | Chuỗi kết nối MongoDB; có thể thay bằng MongoDB riêng/Atlas |
| `NODE_ENV` | Môi trường chạy, local dùng development |
| `JWT_SECRET` | Giai đoạn 3: khóa ký JWT nội bộ |
| `PUBLIC_APP_URL` | Giai đoạn 4: địa chỉ frontend ghi vào QR |
| `ORDER_TOKEN_SECRET` | Giai đoạn 5: khóa riêng để khôi phục mã xem đơn khi gửi lại |

JWT_SECRET và ORDER_TOKEN_SECRET không thuộc nghiệp vụ nền tảng ban đầu nhưng **đều bắt buộc khi chạy code hiện tại**. Trên máy đang làm việc đã cấu hình giá trị ngẫu nhiên trong `.env` cục bộ. Trên máy mới, chạy lệnh sau hai lần, dùng mỗi kết quả cho một khóa riêng:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Không đưa khóa thật vào source hoặc file mẫu. Không tự thay khóa của project đang dùng. Khởi động lại frontend/backend sau khi sửa `.env` tương ứng. Nếu đổi cổng backend, phải sửa lại VITE_API_BASE_URL.

## 6. Các lệnh kiểm tra

```bash
curl -i http://localhost:3000/api/health
npm --prefix server run check:db
npm --prefix client run build
```

- `check:db` kết nối, ping, ghi/đọc một bản ghi thử rồi xóa đúng bản ghi đó. Không tạo món hoặc đơn.
- `build` đóng gói React vào `client/dist/`. Không phải lệnh chạy server triển khai.

Node.js đọc `.env` bằng tùy chọn `--env-file` và theo dõi thay đổi backend bằng `--watch`. Project không cần dotenv hoặc nodemon cho hai việc này.

## 7. Kết quả kiểm tra đã ghi nhận

| Kiểm tra giai đoạn 2 | Kết quả |
|---|---|
| Chạy React/Vite và Express | Thành công |
| Chrome mở React và Axios gọi API thật | API 200, hiển thị MongoDB hoạt động |
| MongoDB ping, ghi, đọc, dọn bản ghi thử | Thành công |
| Frontend build | Thành công |
| React Router và trang 404 | Hoạt động |
| Tailwind và màn hình 375px | Có áp dụng kiểu, không tràn ngang trong luồng đã thử |
| Chặn API rồi khôi phục trong Chrome | Hiện lỗi, thử lại thành công |
| Tạm dừng rồi bật lại MongoDB | Health trả 503 rồi phục hồi 200 |
| JSON sai / API không tồn tại | Trả 400 / 404 |

Đây là kết quả nền tảng đã ghi ở README, không phải kiểm thử đăng nhập hoặc order. Ở lần hoàn tất giai đoạn 5, lệnh build, check:db và health cũng đã được chạy lại thành công.

## 8. Các điểm cần giải thích

- Frontend hiển thị, backend xử lý, database lưu dữ liệu.
- Axios gọi API; React Router đổi trang; Tailwind định dạng giao diện.
- Mongoose kết nối MongoDB và dùng model để quản lý cấu trúc dữ liệu.
- CORS kiểm soát truy cập trong trình duyệt, không bảo vệ quyền nghiệp vụ.
- `.env` chứa cấu hình riêng; `.env.example` chỉ làm mẫu.
- Vì sao backend chỉ báo sẵn sàng sau khi kết nối được database?

Tiếp theo: [GIAI_DOAN_3.md](GIAI_DOAN_3.md).
