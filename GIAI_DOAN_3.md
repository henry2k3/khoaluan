# Giai đoạn 3 — Đăng nhập admin/staff

Tài liệu này tách phần đăng nhập đã triển khai khỏi README. Phạm vi dưới đây là giai đoạn 3; project hiện đã phát triển tiếp đến giai đoạn 5. Kết quả Chrome giai đoạn 3 là kết quả đã ghi nhận trước đó; 12 kiểm thử backend đăng nhập cũng vừa chạy lại thành công trong bộ 65 test hiện tại.


## Phạm vi

- `User` chỉ có hai vai trò `admin` và `staff`.
- Khách không có tài khoản, không đăng nhập và không có role `customer`.
- Tên khách chỉ là trường hiển thị `customerName` trong thiết kế đơn hàng; chưa tạo Order model ở giai đoạn này.
- Có đăng nhập, đăng xuất trên trình duyệt, khôi phục phiên khi tải lại, kiểm tra quyền ở frontend và backend.
- Chưa có đăng ký công khai, quản lý nhân viên qua giao diện, đổi mật khẩu, menu/order hoặc Socket.IO.

## Tạo tài khoản nội bộ

**Trên máy hiện tại:** đã tạo tài khoản quản lý `admin`. Mật khẩu ngẫu nhiên nằm ở biến `CREATE_USER_PASSWORD` trong `server/.env` cục bộ. Giá trị thật không được đưa vào README, file mẫu hoặc mã nguồn. Tài khoản staff dùng khi kiểm thử đã được dọn, không để lại tài khoản kiểm thử trong database chính.

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

## Cách đăng nhập

1. Chạy MongoDB, backend và frontend theo [GIAI_DOAN_2.md](GIAI_DOAN_2.md).
2. Mở `http://localhost:5174/login`.
3. Nhập username/password của tài khoản nội bộ.
4. Admin được chuyển đến `/admin`, staff đến `/staff`.
5. Nhấn **Kiểm tra quyền truy cập** để gọi API có bảo vệ.
6. Nhấn **Đăng xuất** để xóa phiên trong tab đang dùng.

## API đã triển khai

| Method | API | Quyền và kết quả |
|---|---|---|
| POST | `/api/auth/login` | Nhận username/password; trả JWT và thông tin admin/staff |
| GET | `/api/auth/me` | Yêu cầu JWT hợp lệ và tài khoản còn hoạt động; trả thông tin người đang đăng nhập |
| GET | `/api/auth/admin-check` | Chỉ admin; API nhỏ để xác minh phân quyền, chưa có dữ liệu dashboard |
| GET | `/api/health` | Vẫn công khai để kiểm tra nền tảng |

JWT gửi qua header `Authorization: Bearer <token>`. Mã HTTP `401` nghĩa là chưa xác thực hoặc phiên không hợp lệ; `403` nghĩa là đã xác thực nhưng không có quyền; `429` là đã thử đăng nhập quá nhiều lần.

Đăng nhập sai bị giới hạn 10 lần trong 15 phút theo IP; đăng nhập thành công không bị cộng vào số lần thất bại. Giới hạn lưu trong bộ nhớ của một tiến trình backend hiện tại.

## Luồng code để trình bày

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

Giới hạn của phiên bản hiện tại: chưa có cơ chế tự gia hạn token hoặc danh sách thu hồi token. Đăng xuất xóa token ở tab hiện tại, không vô hiệu hóa bản token đã bị sao chép. Backend kiểm tra tài khoản còn hoạt động ở từng yêu cầu; nếu tài khoản bị khóa/xóa hoặc đổi quyền, thay đổi có hiệu lực ở yêu cầu tiếp theo. Token trong `sessionStorage` có thể được JavaScript đọc, nên không xem đây là nơi cất bí mật an toàn tuyệt đối.

## Kiểm thử giai đoạn 3

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

## Những file cần đọc

| File | Mục đích |
|---|---|
| `server/src/models/User.js` | Cấu trúc tài khoản; chỉ admin/staff, passwordHash mặc định không chọn khi truy vấn |
| `server/src/services/userService.js` | Kiểm tra dữ liệu và băm mật khẩu khi tạo tài khoản nội bộ |
| `server/scripts/createUser.js` | Lệnh khởi tạo tài khoản từ biến môi trường |
| `server/src/routes/authRoutes.js` | API đăng nhập, xem phiên và kiểm tra admin; giới hạn thử đăng nhập |
| `server/src/controllers/authController.js` | Kiểm tra đăng nhập, so sánh mật khẩu và trả token |
| `server/src/utils/token.js` | Ký/kiểm tra JWT thời hạn 2 giờ |
| `server/src/utils/userResponse.js` | Chỉ trả trường tài khoản được phép hiển thị |
| `server/src/middlewares/authMiddleware.js` | Kiểm tra token, tài khoản hoạt động và role hiện tại |
| `client/src/pages/auth/LoginPage.jsx` | Form đăng nhập |
| `client/src/contexts/AuthContext.jsx` | Đăng nhập, khôi phục phiên và đăng xuất |
| `client/src/routes/ProtectedRoute.jsx` | Kiểm tra quyền trước khi hiển thị trang React |
| `client/src/api/axiosClient.js` | Đính kèm JWT cho API nội bộ và xử lý 401 |
| `client/src/utils/authStorage.js` | Đọc/ghi/xóa token đăng nhập trong sessionStorage |
| `server/tests/auth.test.js` | 12 kiểm thử backend đăng nhập/phân quyền |

## User lưu những gì?

| Trường | Ý nghĩa |
|---|---|
| `fullName` | Tên nhân viên/quản lý |
| `username` | Tên đăng nhập, chuẩn hóa chữ thường, không trùng |
| `passwordHash` | Bản băm mật khẩu; không lưu mật khẩu gốc |
| `role` | Chỉ `admin` hoặc `staff` |
| `isActive` | Tài khoản còn được phép truy cập không |
| `createdAt`, `updatedAt` | Thời điểm tạo và sửa |

Khách nhập tên ở menu không gọi User model hoặc API đăng nhập. Mã xem đơn của khách được triển khai riêng ở giai đoạn 5.

## Chạy với code hiện tại

Cấu hình `JWT_SECRET` trong `server/.env`, là chuỗi ngẫu nhiên ít nhất 32 ký tự. Giai đoạn 5 đã thêm `ORDER_TOKEN_SECRET` và code hiện tại yêu cầu cả hai khóa. Dùng giá trị riêng cho từng khóa, không đặt trong client hoặc đưa lên Git. Trên máy hiện tại đã cấu hình; không chép đè `.env` bằng file mẫu.

Từ thư mục gốc, sau khi MongoDB chạy:

```bash
# Terminal backend
npm --prefix server run dev
```

```bash
# Terminal frontend
npm --prefix client run dev
```

Mở `http://localhost:5174/login`. Hướng dẫn cấu hình MongoDB, cổng và khóa đầy đủ nằm trong [GIAI_DOAN_2.md](GIAI_DOAN_2.md).

## Cách tự demo đăng nhập và phân quyền

1. Tạo tài khoản admin/staff bằng lệnh nội bộ nếu chưa có, sử dụng username khác nhau.
2. Mở `/login`, nhập sai mật khẩu: giao diện báo thông tin đăng nhập không đúng.
3. Đăng nhập admin: chuyển `/admin`. Nhấn kiểm tra quyền, refresh vẫn giữ phiên.
4. Đăng xuất: quay về đăng nhập. Mở thẳng `/admin` lúc chưa đăng nhập sẽ bị chặn.
5. Đăng nhập staff: chuyển `/staff`. Mở `/admin` sẽ thấy thông báo không có quyền.
6. Kiểm thử API bằng bộ test để chứng minh staff không vượt quyền dù gọi trực tiếp backend.

Hiện tại admin còn có các trang danh mục/món/bàn của giai đoạn 4; đó không phải phạm vi đăng nhập giai đoạn 3.

## Các câu hỏi cần nắm khi bảo vệ

- **Xác thực** kiểm tra phiên đăng nhập hợp lệ; **phân quyền** kiểm tra người này được làm gì.
- Vì sao cần kiểm tra quyền ở backend dù React đã chặn trang?
- Vì sao database lưu bản băm mật khẩu và API không trả passwordHash?
- Vì sao JWT có thời hạn? Đăng xuất trên trình duyệt có thu hồi mọi bản token bị sao chép không?
- Vì sao đọc role/isActive từ MongoDB ở mỗi request thay vì tin role frontend gửi?
- Vì sao tên khách không dùng làm tài khoản và khách không được thêm role customer?

Tiếp theo: [GIAI_DOAN_4.md](GIAI_DOAN_4.md).
