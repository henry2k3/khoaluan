# Giai đoạn 1 — Phân tích yêu cầu và thiết kế hệ thống

Tài liệu này tổng hợp giai đoạn thiết kế đã chốt trước khi code. Bản thiết kế đầy đủ, được cập nhật theo tiến độ, nằm ở [PHAN_TICH_VA_THIET_KE_HE_THONG.md](PHAN_TICH_VA_THIET_KE_HE_THONG.md).

**Đề tài:** Xây dựng hệ thống quản lý nhà hàng/cafe và gọi món bằng mã QR.

## 1. Phân tích yêu cầu

| Người dùng | Chức năng trong toàn bộ đề tài |
|---|---|
| Khách hàng | Quét QR, nhập tên, xem menu/danh mục, chọn món, giỏ hàng, ghi chú, gửi đơn và theo dõi đơn |
| Nhân viên — `staff` | Đăng nhập, nhận thông báo đơn mới, xem chi tiết, xác nhận/cập nhật đơn và theo dõi bàn |
| Quản lý — `admin` | Đăng nhập, quản lý danh mục/món/bàn/QR, đơn hàng, tài khoản nhân viên và dashboard |

**Khách không có tài khoản và không đăng nhập.** Tên khách chỉ để hiển thị trong đơn, không phải căn cứ cấp quyền. Model User chỉ dùng cho admin/staff.

Dashboard về sau gồm doanh thu ngày/tháng, số đơn, món bán chạy, doanh thu theo món, số bàn đang dùng và hoạt động đơn gần đây.

Các quyết định đã chốt:

- Mỗi lần đặt mới tạo một đơn riêng, một bàn có thể có nhiều đơn. Gửi lại cùng lần gửi do lỗi mạng phải nhận lại đơn cũ.
- Chưa thanh toán gộp nhiều đơn cùng bàn.
- `completed` nghĩa là đã phục vụ và nhân viên xác nhận thanh toán.
- Chỉ hủy đơn ở `pending` hoặc `confirmed`; lưu lý do/thời gian và tài khoản thực hiện nếu nhân viên/quản lý hủy.
- Đơn hủy không tính doanh thu, không giữ bàn ở trạng thái đang sử dụng nếu không còn đơn khác đang xử lý.
- Giá là số nguyên theo đồng, như `35000`. Backend tự lấy giá và tính tiền.

## 2. Thiết kế cấu trúc hệ thống

| Phần | Công nghệ | Công việc |
|---|---|---|
| Frontend | React, Tailwind CSS, React Router, Axios | Hiển thị trang, nhận thao tác và gọi API |
| Backend | Node.js, Express.js | Kiểm tra dữ liệu/quyền, xử lý nghiệp vụ và trả kết quả |
| Database | MongoDB, Mongoose | Lưu và đọc dữ liệu theo model |
| Xác thực nội bộ | JWT | Xác minh phiên đăng nhập admin/staff |
| Realtime | Socket.IO | Thông báo thay đổi sau khi dữ liệu đã được lưu; làm ở giai đoạn sau |

**API** là nơi frontend gửi yêu cầu để backend xử lý. **Model** mô tả dữ liệu được lưu. **Realtime** là cập nhật gần như ngay khi có thay đổi.

```text
Khách / Nhân viên / Quản lý
             ↓
React + Router + Tailwind
             ↓ Axios gọi API
Node.js + Express
             ↓ Mongoose
MongoDB
```

Project tách `client/` và `server/`, dùng JavaScript dễ đọc, không chia thành nhiều dịch vụ. Backend đi theo **route → controller → service nếu cần → model**: route chọn hàm xử lý URL; controller nhận/trả HTTP; service xử lý nghiệp vụ; model đọc/ghi MongoDB.

Frontend có `pages`, `components`, `layouts`, `api`, `contexts`, `routes`, `utils`. Backend có `config`, `routes`, `controllers`, `services`, `models`, `middlewares`, `utils`, `sockets`. Middleware là hàm kiểm tra chung chạy trước/sau hàm xử lý chính, ví dụ kiểm tra đăng nhập.

## 3. Thiết kế MongoDB

**Collection** là tập hợp các bản ghi cùng loại, gần giống một bảng dữ liệu.

| Collection | Nội dung và quan hệ |
|---|---|
| `users` | Tên nhân viên/quản lý, username, passwordHash, role admin/staff, isActive |
| `categories` | Tên danh mục, mô tả, thứ tự, trạng thái hiện/ẩn |
| `products` | Thuộc một category; tên, mô tả, giá, ảnh, còn/hết món, đang/ngừng kinh doanh |
| `tables` | Tên bàn, sức chứa, qrToken duy nhất, trạng thái phục vụ |
| `orders` | Tên khách/bàn, món đã đặt, giá thời điểm đặt, số lượng, ghi chú, tổng, trạng thái, mã xem đơn và lịch sử |

Các model dùng `createdAt`, `updatedAt` để ghi thời điểm tạo/sửa.

- Một Category có nhiều Product.
- Một Table có nhiều Order.
- Danh sách món được nhúng vào Order vì thường đọc cùng đơn.
- Order lưu cả tên và giá món lúc đặt, gọi là **snapshot**. Đổi giá Product không sửa tiền đơn cũ.
- `qrToken` nhận diện bàn; không cấp quyền xem mọi đơn tại bàn.
- Khách có `trackingToken` riêng cho từng đơn; database giữ bản băm, không giữ token thật.
- Không lưu ảnh QR vào database; tạo ảnh khi admin cần xem/tải.
- Tình trạng bàn trống/đang dùng sẽ tính từ đơn đang xử lý, không lưu thêm một giá trị dễ lệch.

Trạng thái đơn:

| Giá trị | Hiển thị |
|---|---|
| `pending` | Chờ xác nhận |
| `confirmed` | Đã xác nhận |
| `preparing` | Đang chuẩn bị |
| `served` | Đã phục vụ |
| `completed` | Hoàn thành — đã phục vụ và xác nhận thanh toán |
| `cancelled` | Đã hủy |

Luồng bình thường: `pending → confirmed → preparing → served → completed`. Nhánh hủy chỉ xuất phát từ pending/confirmed. Chi tiết trường, quan hệ và chỉ mục xem phần 3 của tài liệu thiết kế đầy đủ.

## 4. Các nhóm API

| Nhóm | API chính | Quyền |
|---|---|---|
| Nền tảng | `GET /api/health` | Công khai |
| Đăng nhập | `POST /api/auth/login`, `GET /api/auth/me` | Nội bộ |
| Menu/QR khách | `GET /api/public/tables/:qrToken`, `/categories`, `/products`, `/products/:id` dưới tiền tố `/api/public` | Công khai |
| Đơn khách | `POST /api/public/orders`, `GET /api/public/orders/:id` | Tạo không cần tài khoản; đọc cần mã xem đơn |
| Danh mục | GET/POST `/api/categories`, PATCH `/api/categories/:id` | Admin |
| Món | GET/POST `/api/products`, PATCH `/api/products/:id` | Admin |
| Bàn/QR | GET/POST `/api/tables`, PATCH `/api/tables/:id`, GET `/api/tables/:id/qr` | Admin |
| Vận hành đơn | Danh sách/chi tiết, xác nhận/chuyển trạng thái/hủy | Staff/admin, giai đoạn 6 |
| Dashboard và nhân viên | Thống kê và quản lý tài khoản | Admin, giai đoạn sau |

`GET` lấy dữ liệu, `POST` tạo hoặc thực hiện thao tác, `PATCH` sửa một phần dữ liệu. Backend luôn kiểm tra quyền; không chỉ ẩn nút trên React. API dự kiến đầy đủ nằm ở phần 4 của tài liệu thiết kế.

## 5. Các màn hình React

| Màn hình | Đường dẫn |
|---|---|
| Nhập tên/menu khách | `/menu/:qrToken` |
| Giỏ hàng theo bàn | `/menu/:qrToken/cart` |
| Khách xem đơn | `/orders/:orderId` |
| Đăng nhập | `/login` |
| Khu vực nhân viên | `/staff` |
| Quản lý danh mục/món/bàn | `/admin/categories`, `/admin/products`, `/admin/tables` |
| Vận hành đơn/bàn — dự kiến | `/staff/orders`, `/staff/orders/:id`, `/staff/tables` |
| Quản lý đơn, thống kê, nhân viên — dự kiến | `/admin/orders`, `/admin/dashboard`, `/admin/users` |

Ưu tiên màn hình điện thoại cho khách, luôn có trạng thái đang tải, lỗi, dữ liệu rỗng và kiểm tra form cơ bản. Những đường dẫn dự kiến không có nghĩa đã được triển khai.

## 6. Socket.IO hoạt động ở đâu?

Socket.IO làm ở giai đoạn 7, sau khi API đã ổn định:

1. Khách gửi đơn bằng API; backend lưu MongoDB thành công rồi mới báo đơn mới cho nhân viên.
2. Nhân viên đổi trạng thái bằng API; backend lưu rồi thông báo cho khách sở hữu đơn.
3. Nhóm kết nối nhân viên và nhóm theo từng đơn được gọi là **room**. Backend kiểm tra JWT/token trước khi cho vào room.
4. Khi mất mạng rồi kết nối lại, giao diện gọi API đọc trạng thái thật từ MongoDB.

Socket.IO truyền thông báo; MongoDB lưu dữ liệu chính thức. Giai đoạn 5 hiện chỉ có API và nút làm mới, chưa có các sự kiện này.

## 7. Các giai đoạn phát triển

| Giai đoạn | Phạm vi | Trạng thái hiện tại |
|---|---|---|
| 1 | Phân tích và thiết kế | Đã chốt |
| 2 | Nền tảng React/Express/MongoDB | Đã hoàn thành |
| 3 | Đăng nhập admin/staff | Đã hoàn thành |
| 4 | Danh mục, món, bàn, QR, menu khách | Đã hoàn thành |
| 5 | Giỏ, gửi đơn, xem đơn bằng API | Đã hoàn thành |
| 6 | Vận hành đơn/bàn, hủy, xác nhận thanh toán từng đơn | Chưa làm |
| 7 | Socket.IO và phục hồi kết nối | Chưa làm |
| 8 | Dashboard | Chưa làm |
| 8b | Quản lý tài khoản nhân viên | Chưa làm |
| 9 | Hoàn thiện, triển khai và tài liệu bảo vệ | Chưa làm |

## 8. Những phần quan trọng khi bảo vệ

- Phân biệt khách không có tài khoản với admin/staff có tài khoản.
- Vì sao tách frontend, backend và database?
- Vì sao backend tự tính tiền và kiểm tra quyền?
- Vì sao Order cần lưu snapshot tên/giá và lịch sử trạng thái?
- Vì sao orderId/QR không thay thế mã bảo vệ đơn?
- Làm sao chống gửi trùng khi mạng chậm hoặc mất phản hồi?
- `served` khác `completed` thế nào? Vì sao chỉ đơn đã thanh toán mới tính doanh thu?
- Khi hủy đơn, tình trạng bàn và doanh thu phải thay đổi ra sao?
- API, Socket.IO và MongoDB có vai trò khác nhau như thế nào?

Giai đoạn 1 là **thiết kế**, không có test chạy ứng dụng riêng. Kết quả chạy thực tế được ghi ở các giai đoạn triển khai tiếp theo. Thiết kế được cập nhật dần nhưng không triển khai trước những phần chưa được yêu cầu.

Tiếp theo: [GIAI_DOAN_2.md](GIAI_DOAN_2.md).
