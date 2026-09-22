# Phân tích và thiết kế hệ thống quản lý nhà hàng/cafe và gọi món bằng mã QR

**Loại project:** Khóa luận sinh viên  
**Ngày lập tài liệu:** 16/09/2026  
**Trạng thái đối chiếu 9C — 18/09/2026:** Source hiện có chức năng đến giai đoạn 8: dashboard chỉ admin, thống kê từ Order theo giờ Việt Nam, doanh thu dựa trên paidAt và snapshot món. Socket.IO báo thay đổi để đọc lại API. Giữ toàn bộ nghiệp vụ xử lý từng đơn, thanh toán riêng, lịch sử, conflict 409 và tình trạng bàn suy ra từ đơn. Khách không có tài khoản. Chưa triển khai thanh toán online hoặc gộp hóa đơn.

Tài liệu này phân tích yêu cầu, đề xuất kiến trúc, thiết kế MongoDB, API, màn hình React, cách sử dụng Socket.IO và lộ trình phát triển. Hệ thống phục vụ một nhà hàng/cafe, chia thành ba khu vực: khách hàng, nhân viên và quản lý.

Nguyên tắc thực hiện:

- Code rõ ràng, dễ hiểu và có thể giải thích khi bảo vệ khóa luận.
- Không làm kiến trúc quá phức tạp.
- Không cài thư viện không cần thiết.
- Giải thích bằng tiếng Việt đơn giản; giải thích thuật ngữ kỹ thuật khi sử dụng.
- Phát triển theo từng giai đoạn, không làm toàn bộ project cùng lúc.
- Chốt thiết kế trước khi bắt đầu viết code.

> Tài liệu này đã được hiệu chỉnh trong lượt 9C chỉ viết tài liệu. Không tìm thấy tài liệu/code riêng 9A–9B hoặc script reset/seed demo trong workspace; không coi những phần đó là đã có. Bản trình bày, sáu sơ đồ và Q&A dẫn code nằm ở [BAO_VE_KHOA_LUAN.md](BAO_VE_KHOA_LUAN.md). Các thay đổi so với GIAI_DOAN_1–8 và kết quả kiểm tra mới nhất nằm ở [GIAI_DOAN_9.md](GIAI_DOAN_9.md).

## 1. Phân tích yêu cầu

### 1.1. Công nghệ bắt buộc

| Thành phần | Công nghệ |
|---|---|
| Frontend | React, Tailwind CSS, React Router, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Realtime | Socket.IO |
| Authentication | JWT |

### 1.2. Phạm vi phiên bản đầu tiên

Phạm vi phiên bản đầu và các quy tắc đã chốt:

- Một nhà hàng/cafe, chưa quản lý nhiều chi nhánh.
- Khách gọi món tại bàn, KHÔNG có tài khoản và KHÔNG đăng nhập.
- Luồng khách: quét QR bàn → nhập tên khách → xem menu → đặt món.
- Tên khách chỉ hiển thị trong đơn hàng, không phải tài khoản và không dùng để xác thực.
- Nhân viên và quản lý đăng nhập bằng tài khoản.
- Mỗi lần đặt mới sẽ tạo một đơn riêng; gửi lại cùng `requestId` trả đơn đã xử lý, không tạo thêm.
- Một bàn có thể có nhiều đơn đang xử lý.
- Mỗi đơn được xử lý, thanh toán và hoàn thành riêng; chưa thanh toán gộp nhiều đơn cùng bàn.
- Thanh toán trực tiếp tại quầy hoặc với nhân viên; chưa tích hợp cổng thanh toán.
- Đơn chuyển sang **Hoàn thành** sau khi đã phục vụ và nhân viên xác nhận thanh toán.
- Doanh thu được tính từ các đơn đã hoàn thành.
- Có hủy đơn (`cancelled`), chỉ khi đơn đang ở `pending` hoặc `confirmed`; lưu lý do, thời gian và người thực hiện nếu là nhân viên/quản lý.
- Đơn hủy không tính doanh thu và không giữ bàn ở trạng thái đang sử dụng.
- Chưa có quản lý kho nguyên liệu, đặt bàn, giao hàng, mã giảm giá hoặc hóa đơn điện tử.

Ba quyết định về hủy đơn, thanh toán riêng và ý nghĩa `completed` đã được người dùng xác nhận. Các chức năng nghiệp vụ sẽ được triển khai ở giai đoạn tương ứng, không nằm trong giai đoạn tạo nền tảng.

### 1.3. Ba nhóm người dùng

| Nhóm | Chức năng chính | Giới hạn |
|---|---|---|
| Khách hàng | Quét QR, nhập tên, xem menu, chọn món, gửi đơn, theo dõi đơn | Không có tài khoản; tên không cấp quyền truy cập đơn |
| Nhân viên | Đăng nhập, xử lý đơn, theo dõi bàn | Không quản lý tài khoản, danh mục hoặc cấu hình món |
| Quản lý | Toàn bộ chức năng vận hành, quản lý dữ liệu và thống kê | Có quyền cao nhất trong hệ thống |

**Phân quyền** nghĩa là xác định người dùng được phép thực hiện hành động nào. Việc này phải được kiểm tra ở backend; chỉ ẩn nút trên giao diện là chưa đủ.

### 1.4. Luồng khách hàng gọi món

1. Khách quét QR tại bàn.
2. Trình duyệt xác định đúng bàn và yêu cầu nhập tên khách.
3. Khách nhập tên để hiển thị trong đơn; hệ thống không tạo tài khoản hoặc yêu cầu mật khẩu.
4. Khách xem menu theo danh mục, chọn món và số lượng.
5. Khách nhập ghi chú cho từng món hoặc toàn đơn.
6. Khách kiểm tra giỏ hàng và gửi đơn.
7. Backend kiểm tra bàn, tên hiển thị, món, số lượng và giá.
8. Backend lưu đơn vào MongoDB, gồm `customerName`.
9. Hệ thống thông báo đơn mới cho nhân viên.
10. Khách theo dõi các lần cập nhật trạng thái bằng mã truy cập riêng của đơn.

Hai khách có thể trùng tên. Không tra cứu hoặc cấp quyền xem đơn bằng tên khách. Mã truy cập đơn không phải tài khoản khách, không phải JWT đăng nhập nội bộ. Giai đoạn 5 đã triển khai xác định bàn, nhập tên, giỏ, gửi đơn và xem đơn bằng API. Từ giai đoạn 7, khách có trackingToken đúng được nghe thông báo của riêng đơn và tự gọi lại API; nút làm mới vẫn là phương án dự phòng.

**Giỏ hàng chưa phải là đơn hàng.** Chỉ khi backend tạo đơn thành công thì nhà hàng mới nhận được yêu cầu.

### 1.5. Luồng nhân viên xử lý đơn

1. Đăng nhập.
2. Xem danh sách đơn hiện tại.
3. Nhận thông báo khi có đơn mới.
4. Mở chi tiết và xác nhận đơn.
5. Cập nhật quá trình chuẩn bị, phục vụ.
6. Xác nhận thanh toán và hoàn thành đơn.

### 1.6. Quy tắc trạng thái đơn

| Trạng thái hiển thị | Giá trị lưu | Ý nghĩa |
|---|---|---|
| Chờ xác nhận | `pending` | Khách đã gửi, nhân viên chưa nhận xử lý |
| Đã xác nhận | `confirmed` | Nhân viên đã tiếp nhận |
| Đang chuẩn bị | `preparing` | Đơn đang được chế biến |
| Đã phục vụ | `served` | Các món trong đơn đã được phục vụ |
| Hoàn thành | `completed` | Đã phục vụ và xác nhận thanh toán |
| Đã hủy | `cancelled` | Đơn dừng xử lý, không tính doanh thu |

Luồng chính:

**Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Đã phục vụ → Hoàn thành**

Backend đã kiểm tra thứ tự chuyển trạng thái tại `orderStatus.js` và `orderWorkflowService.js`. Không cho chuyển trực tiếp từ “Chờ xác nhận” sang “Hoàn thành”. Chi tiết nội bộ trả `allowedTransitions` để React chỉ hiện nút phù hợp; mỗi yêu cầu vẫn được backend kiểm tra lại.

Trong phiên bản đầu, trạng thái áp dụng cho **toàn bộ đơn**, chưa theo dõi riêng từng món.

Nhánh hủy: **Chờ xác nhận → Đã hủy** hoặc **Đã xác nhận → Đã hủy**.

Quy tắc hủy đã chốt:

- Chỉ cho hủy từ `pending` hoặc `confirmed`.
- Không cho hủy từ `preparing`, `served`, `completed` hoặc `cancelled`.
- Bắt buộc lưu lý do hủy và thời gian hủy do backend xác định.
- Nếu nhân viên/quản lý hủy, backend lấy người thực hiện từ tài khoản đã xác thực, không tin mã người dùng gửi tùy ý từ frontend.
- Ghi nhận lần hủy vào lịch sử trạng thái; giữ nguyên đơn và danh sách món để tra cứu.
- Đơn hủy không được tính doanh thu hoặc số lượng món đã bán.
- `completed` và `cancelled` là trạng thái kết thúc; không mở lại đơn trong phạm vi hiện tại.

API hủy nội bộ dành cho nhân viên/quản lý. Quyền khách tự hủy chưa được chốt; thiết kế hiện tại chưa thêm API khách tự hủy. Trường người hủy cho phép trống nếu sau này có thao tác hủy không qua tài khoản nội bộ.

### 1.7. Quy tắc tình trạng bàn

Giai đoạn 6 tính hai tình trạng khi đọc danh sách bàn:

- **Trống:** không có đơn đang xử lý.
- **Đang sử dụng:** có ít nhất một đơn thuộc `pending`, `confirmed`, `preparing` hoặc `served`.

Đơn `completed` và `cancelled` không được tính là đơn đang xử lý. Hủy đơn cuối cùng đang xử lý sẽ làm bàn chuyển về trống; nếu còn đơn khác đang xử lý thì bàn vẫn đang sử dụng.

Ví dụ: bàn 05 có ba đơn, hai đơn đã hoàn thành nhưng một đơn đang chuẩn bị thì bàn vẫn đang sử dụng.

Đây là tình trạng **suy ra từ đơn hàng**, không phải cảm biến xác định khách có đang ngồi tại bàn hay không. Khách vừa ngồi nhưng chưa gọi món thì hệ thống vẫn có thể hiển thị bàn trống.

## 2. Thiết kế cấu trúc toàn bộ hệ thống

### 2.1. Kiến trúc tổng thể

Hệ thống gồm ba phần:

| Thành phần | Công nghệ | Trách nhiệm |
|---|---|---|
| Giao diện | React, Tailwind CSS, React Router, Axios | Hiển thị màn hình, nhận thao tác và gọi API |
| Máy chủ | Node.js, Express.js, Socket.IO, JWT | Kiểm tra dữ liệu, phân quyền, xử lý nghiệp vụ và gửi thông báo |
| Cơ sở dữ liệu | MongoDB, Mongoose | Lưu tài khoản, menu, bàn và đơn hàng |

Các khái niệm chính:

- **Frontend:** phần giao diện chạy trên trình duyệt.
- **Backend:** phần xử lý chạy trên máy chủ.
- **API:** các địa chỉ để frontend gửi yêu cầu và nhận dữ liệu từ backend.
- **Mongoose:** thư viện mô tả cấu trúc dữ liệu và làm việc với MongoDB.
- **JWT:** chuỗi có chữ ký dùng để xác thực nhân viên và quản lý.
- **Socket.IO:** thư viện duy trì kết nối để máy chủ chủ động gửi thông báo tới trình duyệt.

React giao tiếp với Express qua API. Express đọc và ghi MongoDB. Socket.IO chạy cùng backend để gửi cập nhật tức thời.

**Frontend không kết nối trực tiếp với MongoDB.**

### 2.2. Cấu trúc thư mục hiện có

Project có hai thư mục chính: `client` và `server`.

**Frontend — `client/src`:**

| Thư mục | Nội dung |
|---|---|
| `api/` | Cấu hình Axios và các hàm gọi API |
| `components/` | Thành phần dùng lại như nút, thẻ món, hộp xác nhận |
| `layouts/` | Khung giao diện khách hàng và khu vực nội bộ |
| `pages/customer/` | Menu, giỏ hàng, theo dõi đơn |
| `pages/auth/` | Đăng nhập |
| `pages/staff/` | Xử lý đơn, theo dõi bàn |
| `pages/admin/` | Dashboard, quản lý món/danh mục/bàn; trang thông tin tài khoản đang đăng nhập, chưa có quản lý nhân viên |
| `contexts/` | Dữ liệu dùng chung: đăng nhập, giỏ hàng, kết nối Socket.IO |
| `hooks/` | Logic React dùng lại khi thực sự cần |
| `realtime/` | Socket singleton mỗi tab, join/ACK/reconnect và gom refetch khoảng 300ms |
| `routes/` | Khai báo đường dẫn và kiểm tra quyền vào trang |
| `utils/` | Định dạng tiền, ngày giờ, nhãn trạng thái |

**Backend — `server/src`:**

| Thư mục | Nội dung |
|---|---|
| `config/` | Kết nối MongoDB và cấu hình môi trường |
| `models/` | Cấu trúc dữ liệu Mongoose |
| `routes/` | Khai báo các API |
| `controllers/` | Nhận yêu cầu, gọi xử lý và trả kết quả |
| `services/` | Nghiệp vụ cần tập trung, chủ yếu tạo đơn và chuyển trạng thái |
| `middlewares/` | Kiểm tra đăng nhập, quyền và xử lý lỗi chung |
| `sockets/` | Xác thực kết nối và gửi sự kiện Socket.IO |
| `utils/` | Hàm hỗ trợ dùng chung |

Luồng xử lý thông thường:

**Route → Middleware → Controller → Model → MongoDB**

Với nghiệp vụ đơn hàng có nhiều bước, controller gọi thêm service.

Không cần tạo một service cho mọi thao tác đơn giản. Ví dụ, tạo danh mục có thể xử lý trực tiếp trong controller.

### 2.3. Giới hạn thư viện

Ngoài các công nghệ bắt buộc, một số thư viện hỗ trợ có lý do rõ ràng:

- `bcrypt`: băm mật khẩu để không lưu mật khẩu gốc.
- `jsonwebtoken`: tạo và kiểm tra JWT.
- `qrcode`: tạo ảnh QR cho từng bàn.
- `socket.io-client`: kết nối Socket.IO từ React.
- `cors`: cho phép frontend gọi backend khi chạy khác địa chỉ hoặc cổng.
- `chart.js`: từ giai đoạn 8, biểu đồ cột doanh thu; chỉ tải khi mở dashboard, không thêm wrapper hoặc thư viện chart khác.

Ban đầu có thể dùng React Context cho đăng nhập và giỏ hàng, chưa cần Redux. Ảnh món có thể dùng đường dẫn ảnh; chức năng tải ảnh lên làm sau khi luồng gọi món đã ổn định.

## 3. Thiết kế MongoDB

MongoDB lưu dữ liệu trong **collection**, có thể hiểu gần giống bảng trong cơ sở dữ liệu quan hệ. Mỗi bản ghi gọi là **document**.

Đề xuất năm collection chính:

**users, categories, products, tables, orders.**

### 3.1. `users` — tài khoản nội bộ

`User` model chỉ dùng cho `admin` và `staff`. Không có vai trò `customer`, không có đăng ký/đăng nhập khách và không tạo `User` khi khách nhập tên.

| Trường | Ý nghĩa |
|---|---|
| `_id` | Mã tài khoản |
| `fullName` | Họ tên |
| `username` | Tên đăng nhập, không trùng |
| `passwordHash` | Mật khẩu đã băm |
| `role` | `admin` hoặc `staff` |
| `isActive` | Tài khoản có được sử dụng không |
| `createdAt`, `updatedAt` | Thời điểm tạo và cập nhật |

Không lưu mật khẩu dạng văn bản và không trả `passwordHash` về frontend.

Chưa có API hoặc giao diện tạo/sửa/khóa nhân viên. Hiện dùng lệnh nội bộ `npm run create:user`, gọi `createInternalUser` để tạo admin hoặc staff từ cấu hình của người vận hành. Backend kiểm tra `isActive` khi xác thực; trường này không đồng nghĩa đã có màn hình khóa. Căn cứ: [createUser.js](server/scripts/createUser.js), [userService.js](server/src/services/userService.js), [authMiddleware.js](server/src/middlewares/authMiddleware.js).

### 3.2. `categories` — danh mục

| Trường | Ý nghĩa |
|---|---|
| `_id` | Mã danh mục |
| `name` | Tên: Cà phê, Trà, Bánh… |
| `description` | Mô tả |
| `sortOrder` | Thứ tự hiển thị |
| `isActive` | Có hiển thị không |
| `createdAt`, `updatedAt` | Thời gian |

Một danh mục có nhiều món; mỗi món thuộc một danh mục trong phiên bản đầu.

Giai đoạn 4 đã có thêm/sửa/ẩn/hiện danh mục. `name` bắt buộc, tối đa 100 ký tự; `description` tối đa 1000 ký tự; `sortOrder` là số nguyên không âm. Ẩn danh mục cũng loại các món thuộc danh mục khỏi API menu công khai.

### 3.3. `products` — món ăn/đồ uống

| Trường | Ý nghĩa |
|---|---|
| `_id` | Mã món |
| `categoryId` | Tham chiếu danh mục |
| `name` | Tên món |
| `description` | Mô tả |
| `price` | Giá bán |
| `imageUrl` | Đường dẫn ảnh |
| `isAvailable` | Hiện có thể gọi món không |
| `isActive` | Món còn được sử dụng trong menu không |
| `createdAt`, `updatedAt` | Thời gian |

Hai trường trạng thái có mục đích khác nhau:

- `isAvailable = false`: món tạm hết, có thể vẫn hiển thị nhưng không cho đặt.
- `isActive = false`: món đã ngừng kinh doanh, ẩn khỏi menu khách.

Giá tiền nên lưu bằng **số nguyên theo đơn vị đồng**, ví dụ `35000`, không lưu chuỗi `"35.000đ"`.

Nếu danh mục bị ẩn thì các món thuộc danh mục đó cũng không được đặt qua API khách hàng.

Giai đoạn 4 kiểm tra `categoryId` có tồn tại và `price` là số nguyên không âm ngay tại API, không nhận chuỗi tiền. Ảnh dùng URL http/https hoặc đường dẫn `/images/...`; chưa tải ảnh lên. Giai đoạn 5, món còn có nút thêm giỏ, chọn số lượng và ghi chú. Món hết không thêm được; backend kiểm tra lại món và danh mục tại thời điểm nhận đơn.

### 3.4. `tables` — bàn

| Trường | Ý nghĩa |
|---|---|
| `_id` | Mã bàn |
| `name` | Tên bàn, ví dụ Bàn 01 |
| `capacity` | Số chỗ ngồi |
| `qrToken` | Chuỗi ngẫu nhiên, duy nhất để nhận diện bàn qua QR |
| `isActive` | Bàn có nhận đơn không |
| `createdAt`, `updatedAt` | Thời gian |

QR chứa một đường dẫn dạng:

`https://ten-mien/menu/<qrToken>`

Frontend lấy `qrToken` từ đường dẫn, gọi API để biết bàn nào và bàn có còn hoạt động không.

Không cần lưu ảnh QR trong MongoDB; có thể tạo ảnh từ đường dẫn khi cần xem hoặc tải xuống.

Giai đoạn 4 tạo `qrToken` bằng 24 byte ngẫu nhiên, biểu diễn thành 48 ký tự hex. MongoDB có chỉ mục duy nhất; API thử tạo lại nếu xảy ra trùng token. Admin không tự đặt/sửa token. Sửa tên, số chỗ hoặc bật/tắt bàn không đổi token. `capacity` là số nguyên từ 1 đến 100.

API QR dùng thư viện `qrcode`, trả URL menu và ảnh PNG dạng data URL để xem/tải. Địa chỉ gốc lấy từ `PUBLIC_APP_URL` (mặc định theo `CLIENT_ORIGIN`), không lấy từ dữ liệu tùy ý của trình duyệt.

**Bản hiện tại không lưu riêng tình trạng trống/đang sử dụng.** Backend tính từ các đơn có trạng thái `pending`, `confirmed`, `preparing`, `served` để tránh lệch dữ liệu; loại trừ cả đơn hoàn thành và đơn hủy.

`qrToken` nhận diện bàn, **không phải bằng chứng người dùng đang có mặt tại bàn**. Người có ảnh QR vẫn có thể mở đường dẫn; đây là giới hạn cần nêu khi bảo vệ.

### 3.5. `orders` — đơn hàng

| Trường | Ý nghĩa |
|---|---|
| `_id` | Mã định danh đơn |
| `orderCode` | Mã dễ đọc để nhân viên trao đổi |
| `tableId` | Tham chiếu bàn |
| `tableName` | Tên bàn tại thời điểm đặt |
| `customerName` | Tên khách nhập khi gọi món, chỉ dùng hiển thị; không duy nhất và không tham chiếu User |
| `items` | Danh sách món đã gọi |
| `note` | Ghi chú toàn đơn |
| `totalAmount` | Tổng tiền do backend tính |
| `status` | Trạng thái hiện tại |
| `trackingTokenHash` | Bản băm SHA-256 mã xem đơn, mặc định không chọn khi truy vấn |
| `trackingTokenNonce` | 32 byte ngẫu nhiên do backend sinh, dùng cùng ORDER_TOKEN_SECRET để tái tạo token khi retry |
| `requestIdHash` | Băm mã lần gửi, có unique index để chống tạo trùng |
| `requestPayloadHash` | Băm nội dung đã kiểm tra, chặn dùng lại cùng mã gửi cho nội dung khác |
| `statusHistory` | Lịch sử thay đổi trạng thái |
| `paidAt` | Thời điểm xác nhận thanh toán |
| `cancelReason` | Lý do hủy; API hủy bắt buộc nhập, schema mặc định chuỗi rỗng |
| `cancelledAt` | Thời gian hủy do backend ghi nhận |
| `cancelledBy` | Tham chiếu tài khoản nhân viên/quản lý thực hiện hủy; có thể trống khi không có tài khoản nội bộ |
| `createdAt`, `updatedAt` | Thời gian |

Mỗi phần tử trong `items` gồm:

| Trường | Ý nghĩa |
|---|---|
| `productId` | Mã món gốc |
| `productName` | Tên món lúc đặt |
| `unitPrice` | Đơn giá lúc đặt |
| `quantity` | Số lượng |
| `note` | Ghi chú món |
| `lineTotal` | Đơn giá × số lượng |

Mỗi phần tử trong `statusHistory` gồm `status`, `changedAt`, `changedBy`. Lần tạo đơn của khách không cần có tài khoản nhân viên.

`customerName` là chuỗi đã bỏ khoảng trắng thừa đầu/cuối, bắt buộc có nội dung và tối đa 100 ký tự. Tên được lưu lại trong từng đơn để việc đổi tên ở lần gọi món sau không làm thay đổi đơn cũ. Không dùng tên để ký JWT, cấp quyền hoặc tìm danh tính khách.

**Đã triển khai giai đoạn 6:** Order có `paidAt`, `cancelReason` (tối đa 1000 ký tự), `cancelledAt`, `cancelledBy`. Khi chuyển `served` sang `completed`, nhân viên xác nhận đã nhận tiền; backend lưu đồng thời trạng thái, `paidAt` và lịch sử. Khi hủy, backend lưu đồng thời `cancelled`, lý do, thời gian, ID tài khoản thực hiện và lịch sử. Các trường ngày/người mặc định `null`, lý do mặc định chuỗi rỗng. Mỗi đơn lưu và xử lý thanh toán riêng. API nội bộ đọc tên người thực hiện từ User, chưa lưu snapshot tên nhân viên; ID gốc vẫn nằm trong MongoDB. Đơn pending cũ thiếu các trường mới vẫn đọc và xử lý được. Riêng completed thiếu paidAt hợp lệ là dữ liệu cần báo qua check:data/dataWarnings, không được tự dùng createdAt/updatedAt thay thế. Căn cứ: [Order.js](server/src/models/Order.js), [checkData.js](server/scripts/checkData.js), `dashboardSummary` tại [dashboardService.js](server/src/services/dashboardService.js).

**Vì sao lưu cả tên và giá món trong đơn?**

Ví dụ, khách đặt cà phê giá 30.000đ. Hôm sau quản lý đổi giá thành 35.000đ thì đơn cũ vẫn phải giữ giá 30.000đ.

Cách lưu này gọi là **snapshot**, nghĩa là lưu lại dữ liệu tại thời điểm phát sinh giao dịch.

### 3.6. Quan hệ giữa dữ liệu

| Quan hệ | Diễn giải |
|---|---|
| Category → Product | Một danh mục có nhiều món |
| Table → Order | Một bàn có nhiều đơn theo thời gian |
| Order → Items | Một đơn chứa nhiều dòng món |
| User → Status history | Một nhân viên có thể thực hiện nhiều lần cập nhật |

Các dòng món được nhúng trong đơn vì thường cần đọc cùng đơn. Danh mục, bàn và tài khoản lưu riêng vì được nhiều bản ghi sử dụng.

### 3.7. Chỉ mục cần thiết

**Index**, hay chỉ mục, giúp tìm kiếm nhanh hơn và có thể bảo đảm dữ liệu không trùng.

Đề xuất ban đầu:

- `users.username`: duy nhất.
- `tables.qrToken`: duy nhất.
- `orders.orderCode`: duy nhất; đã tạo ở giai đoạn 5.
- `orders.requestIdHash`: duy nhất; bảo vệ cả các request đến đồng thời.
- `orders.tableId`: đã tạo ở giai đoạn 5.
- `products.categoryId`: lọc món theo danh mục.
- `orders.createdAt (giảm dần) + _id (giảm dần)`: đã thêm ở giai đoạn 6, danh sách mới nhất và thứ tự ổn định khi trùng thời gian.
- `orders.status + createdAt (giảm dần) + _id (giảm dần)`: đã thêm ở giai đoạn 6, lọc trạng thái.
- `orders.tableId + status + createdAt (giảm dần)`: đã thêm ở giai đoạn 6, lọc đơn theo bàn/trạng thái.
- `orders.status + paidAt`: đã thêm ở giai đoạn 8 sau explain; query doanh thu dùng IXSCAN, giảm số document đọc từ 3.660 xuống 10 trong benchmark một ngày với 3.660 đơn thử. Query số đơn dùng lại index createdAt, không thêm index mới cho field này.

Không cần tạo chỉ mục cho mọi trường.

## 4. API hiện có và phần chưa triển khai

Dùng tiền tố chung `/api`.

- `GET`: lấy dữ liệu.
- `POST`: tạo dữ liệu hoặc thực hiện thao tác.
- `PATCH`: cập nhật một phần dữ liệu.

### 4.1. API khách hàng

| Method | API | Mục đích |
|---|---|---|
| GET | `/api/public/tables/:qrToken` | Xác định bàn, kiểm tra bàn hoạt động |
| GET | `/api/public/categories` | Lấy danh mục đang hiển thị |
| GET | `/api/public/products` | Lấy menu; lọc bằng categoryId, chưa có tìm theo tên món |
| GET | `/api/public/products/:id` | Xem chi tiết món |
| POST | `/api/public/orders` | Tạo đơn từ giỏ hàng |
| GET | `/api/public/orders/:id` | Xem đơn với mã truy cập hợp lệ |

Khi tạo đơn, khách gửi `requestId` (32 byte ngẫu nhiên, biểu diễn 64 ký tự hex), mã QR bàn, `customerName`, mã món, số lượng và ghi chú. Số lượng phải là số nguyên 1–99; tối đa 50 món khác nhau; ghi chú món tối đa 500 ký tự, toàn đơn tối đa 1000 ký tự. API này không yêu cầu tài khoản/JWT nội bộ. **Backend tự lấy giá từ MongoDB và tính tổng tiền**, không tin tổng tiền do frontend gửi.

Backend trả `orderId`, `orderCode`, `status`, `trackingToken`; HTTP 201 cho đơn mới, 200 nếu cùng lần gửi đã được xử lý. `orderCode` có dạng `ORD-YYYYMMDD-<10 ký tự hex>` với ngày theo giờ Việt Nam.

Backend sinh nonce ngẫu nhiên, dùng HMAC-SHA256 với `ORDER_TOKEN_SECRET` riêng để tạo trackingToken, chỉ lưu hash và nonce. Khi retry đúng requestId và nội dung, server tái tạo cùng token; không lưu token thật trong MongoDB. Khách gửi token bằng header `X-Order-Token` khi đọc đơn; thiếu/sai token trả cùng lỗi 404, không lộ chi tiết. Không ghi token/requestId/body nhạy cảm vào log, không đặt chúng trong URL. Các API public dùng `Cache-Control: no-store`.

Trình duyệt giữ nguyên mã lần gửi và nội dung khi mất mạng/5xx; MongoDB dùng unique index trên requestIdHash để chỉ lưu một đơn. Cùng mã nhưng khác nội dung trả 409. Mã lần gửi cũng cần giữ riêng vì có thể dùng để lấy lại kết quả và token. Chi tiết luồng và giới hạn: [GIAI_DOAN_5.md](GIAI_DOAN_5.md).

Không dùng riêng số bàn hoặc mã đơn dễ đoán để cho phép xem chi tiết đơn. QR bàn cũng không cấp quyền xem tất cả đơn của những khách khác.

Trong phạm vi đầu tiên, khách theo dõi các đơn đã đặt trên chính trình duyệt của mình. Đổi thiết bị hoặc xóa dữ liệu trình duyệt có thể mất mã truy cập.

### 4.2. API đăng nhập

| Method | API | Quyền |
|---|---|---|
| POST | `/api/auth/login` | Đăng nhập tài khoản admin/staff bằng username và password |
| POST | `/api/auth/logout` | Giai đoạn 7: JWT nội bộ; ngắt các socket đang online của tài khoản qua user room |
| GET | `/api/auth/me` | Nhân viên, quản lý |
| GET | `/api/auth/admin-check` | Chỉ quản lý; kiểm tra phân quyền trong giai đoạn 3 |

Sau khi đăng nhập, frontend gửi JWT kèm các yêu cầu nội bộ. Backend kiểm tra chữ ký, thời hạn token và tài khoản còn hoạt động.

Phiên bản đầu có thể dùng JWT có thời hạn, chưa cần cơ chế tự cấp lại token phức tạp. Cần hiểu rằng xóa token trên trình duyệt để đăng xuất không tự vô hiệu hóa một bản token đã bị sao chép.

Triển khai giai đoạn 3: bcrypt băm mật khẩu; JWT có thời hạn 2 giờ, chỉ chứa định danh tài khoản và các thông tin thời hạn/chữ ký. Backend đọc lại `User` để kiểm tra `isActive` và quyền hiện tại. Frontend giữ token trong `sessionStorage`, gọi `/auth/me` khi tải lại để xác nhận phiên và xóa token khi đăng xuất hoặc nhận lỗi xác thực `401`. Không có API đăng ký công khai, không có API đăng nhập khách. Tài khoản ban đầu được tạo bằng lệnh nội bộ; CRUD nhân viên và đổi/reset mật khẩu vẫn chưa có trong code cuối được đối chiếu, không chỉ riêng giai đoạn 3.

### 4.3. API đơn hàng nội bộ

| Method | API | Quyền |
|---|---|---|
| GET | `/api/orders` | Nhân viên, quản lý |
| GET | `/api/orders/:id` | Nhân viên, quản lý |
| PATCH | `/api/orders/:id/status` | Nhân viên, quản lý |
| PATCH | `/api/orders/:id/cancel` | Nhân viên, quản lý; bắt buộc lý do hủy |

Đã triển khai giai đoạn 6. Danh sách hỗ trợ `page` (mặc định 1), `limit` (mặc định 20, tối đa 50), `status` (một trạng thái hoặc `active` cho bốn trạng thái đang xử lý), `tableId`, `date` (ngày đặt YYYY-MM-DD theo giờ Việt Nam), `orderCode` (tìm phần đầu mã). API mặc định không lọc trạng thái; giao diện mặc định gửi `status=active`. Sắp xếp mới nhất trước, trả `orders` và `pagination`. Chi tiết nội bộ không trả các hash/token bí mật.

**Phân trang** nghĩa là lấy từng nhóm dữ liệu, chẳng hạn 20 đơn mỗi lần, thay vì tải toàn bộ lịch sử.

API hủy chỉ chấp nhận đơn `pending` hoặc `confirmed`, xác định người hủy từ tài khoản đăng nhập và ghi thời gian trên backend. API chuyển trạng thái thông thường không cho chuyển sang `cancelled` để tránh bỏ qua kiểm tra lý do hủy. Hủy đơn và cập nhật trạng thái đều cần kiểm tra trạng thái hiện tại khi ghi dữ liệu để tránh hai nhân viên thao tác xung đột.

Cả hai PATCH bắt buộc `expectedStatus`, là trạng thái đang hiển thị lúc nhân viên thao tác. API status nhận thêm `status`; API cancel nhận thêm `cancelReason`. Backend kiểm tra bước chuyển rồi ghi bằng điều kiện `{ _id, status: expectedStatus }`. Trạng thái, ngày thanh toán hoặc thông tin hủy và phần lịch sử mới được ghi trong cùng document Order; người xác nhận thanh toán nằm trong lịch sử bước completed. Nếu không còn khớp, trả `409`, frontend tải lại và không tự chuyển bước tiếp. Không cần thêm collection khóa hay transaction nhiều document.

### 4.4. API quản lý menu

| Method | API | Mục đích |
|---|---|---|
| GET | `/api/categories` | Danh sách danh mục, gồm cả mục bị ẩn |
| POST | `/api/categories` | Tạo danh mục |
| PATCH | `/api/categories/:id` | Sửa hoặc ẩn danh mục |
| GET | `/api/products` | Danh sách món quản trị |
| POST | `/api/products` | Tạo món |
| PATCH | `/api/products/:id` | Sửa món, cập nhật còn/hết, ngừng kinh doanh |

Các API này dành cho quản lý.

Với món đã xuất hiện trong đơn, ưu tiên ngừng sử dụng bằng `isActive` thay vì xóa dữ liệu.

### 4.5. API bàn và QR

| Method | API | Quyền |
|---|---|---|
| GET | `/api/tables` | Nhân viên, quản lý từ giai đoạn 6 |
| POST | `/api/tables` | Quản lý |
| PATCH | `/api/tables/:id` | Quản lý |
| GET | `/api/tables/:id/qr` | Quản lý |

Từ giai đoạn 6, staff được GET danh sách bàn, không nhận `qrToken`; admin giữ quyền quản lý và xem QR. Danh sách trả thêm `occupancy` (`empty`/`occupied`) và `activeOrderCount`, được tổng hợp từ Order mỗi lần gọi API, không lưu trong Table. Danh mục/món và mọi thao tác sửa bàn vẫn chỉ admin.

Admin tiếp tục được bật/tắt nhận đơn mới như giai đoạn 4. `isActive=false` không hủy đơn đã có: bàn tắt vẫn có thể đang sử dụng, nhân viên vẫn xử lý/thu tiền từng đơn cũ. Thay cho đề xuất kiểm tra cấm tắt bàn khi còn đơn, phiên bản này tách rõ “nhận đơn mới” và “còn đơn đang xử lý”, giữ cấu trúc đơn giản. Nút làm mới đọc lại tình trạng hiện tại.

### 4.6. Quản lý tài khoản — chưa triển khai API

Các endpoint `/api/users`, `/api/users/:id`, `/api/users/:id/reset-password`, `/api/auth/change-password` từng nằm trong kế hoạch nhưng **chưa có** trong route thực tế. Không dùng chúng trong demo. Tài khoản hiện chỉ tạo bằng CLI `create:user`; chưa có UI/API thay mật khẩu hoặc khóa tài khoản. Kiểm tra danh sách router tại [app.js](server/src/app.js), [authRoutes.js](server/src/routes/authRoutes.js) và lệnh tại [server/package.json](server/package.json).

### 4.7. API dashboard

| Method | API | Mục đích |
|---|---|---|
| GET | `/api/dashboard/summary` | Doanh thu, số đơn, số bàn sử dụng |
| GET | `/api/dashboard/revenue` | Doanh thu theo giờ (today) hoặc theo ngày |
| GET | `/api/dashboard/products` | Số lượng bán và doanh thu theo món |
| GET | `/api/dashboard/recent-orders` | Hoạt động đơn hàng gần đây |

Đã triển khai giai đoạn 8. Toàn bộ router yêu cầu JWT và role admin; staff nhận 403, chưa đăng nhập 401. Backend dùng aggregation, không chuyển toàn bộ Order về frontend. API có Cache-Control no-store và giới hạn query 10 giây.

| Chỉ số | Field / điều kiện |
|---|---|
| revenue, completedOrders, averageOrderValue | completed và paidAt kiểu Date trong kỳ; cộng totalAmount đã lưu; trung bình bằng revenue / completedOrders hoặc 0 |
| totalOrders | createdAt trong kỳ, mọi status |
| cancelledOrders | createdAt trong kỳ và hiện status cancelled |
| Top món, doanh thu món | completed và paidAt kiểu Date trong kỳ; snapshot items.quantity, items.lineTotal |
| activeOrders, activeTables, emptyTables | Hiện tại, mọi ngày; pending/confirmed/preparing/served; tính mỗi bàn một lần |
| recent-orders | createdAt trong kỳ; sort createdAt desc, _id desc; limit mặc định 10, tối đa 50 |
| dataWarnings.completedWithoutPaidAt | completed thiếu/sai kiểu paidAt, toàn database |

CancelledOrders là “đơn tạo trong kỳ và hiện đã hủy”, không phải số thao tác hủy theo cancelledAt. Ngày cũ có thể tăng cancelledOrders về sau; luôn ≤ totalOrders. Nếu cần hoạt động hủy theo ngày phải thêm chỉ số khác sau này.

Món group theo productId, không theo tên; cộng cả nhiều dòng cùng ID trong một đơn. Tên hiển thị lấy snapshot mới nhất trong các đơn completed của kỳ: paidAt desc, createdAt desc, _id desc. Sau đó sort quantitySold desc, revenue desc, productName asc, _id asc để ổn định. Không lấy giá/tên từ Product hiện tại, không `$lookup Product`; khoảng cũ hiển thị tên snapshot cũ. Top 10 chỉ là phần doanh thu nếu bán hơn 10 món.

Thời gian theo **Asia/Ho_Chi_Minh**, từ ngày VN đổi sang UTC để query nửa mở `[from 00:00 VN, ngày sau to 00:00 VN)`. `$dateToString` luôn truyền timezone này. Query `period=today|7d|30d|month`, month tùy chọn YYYY-MM khi period=month; hoặc from/to YYYY-MM-DD. 7d là hôm nay + 6 ngày trước. Tối đa 366 ngày, from=to hợp lệ, năm hỗ trợ 2000–2100. Query sai trả 400, không tự sửa ngày. Today có 24 mốc giờ, kỳ khác mốc ngày; backend điền 0.

Preset tính trên backend từ now do controller truyền; test dùng now cố định, không dựa vào đồng hồ máy khách hoặc giả timer toàn cục. Mỗi phản hồi có range cho frontend hiển thị kỳ/kiểm tra includesToday. Đơn tạo 23:50 hôm trước, thanh toán 00:10 hôm sau có số đơn thuộc hôm trước nhưng doanh thu/completedOrders thuộc hôm sau.

Trước triển khai chạy `npm --prefix server run check:data` chỉ đọc collection gốc: kiểm tra completed thiếu/sai paidAt, lineTotal khác unitPrice × quantity, totalAmount khác tổng lineTotal, thiếu productId. Có lỗi phải báo và dừng chờ quyết định, không tự backfill hoặc lấy ngày khác thay paidAt. Kết quả ban đầu restaurant_qr.orders: 0 đơn, 0 lỗi bốn nhóm. Summary vẫn cảnh báo completedWithoutPaidAt nếu sau này có dữ liệu sai; giao diện hiện cảnh báo khi >0.

Chi tiết API, explain/index, test và đầy đủ bộ tính tay A–E: [GIAI_DOAN_8.md](GIAI_DOAN_8.md).

## 5. Các màn hình React hiện có

### 5.1. Khu vực khách hàng

| Màn hình | Đường dẫn | Nội dung |
|---|---|---|
| Nhập tên khách | `/menu/:qrToken` — bước trước khi mở menu | Xác định bàn, nhập tên hiển thị; không phải biểu mẫu đăng nhập |
| Menu tại bàn | `/menu/:qrToken` | Tên bàn, danh mục, danh sách món |
| Giỏ hàng | `/menu/:qrToken/cart` | Sửa số lượng, xóa món, ghi chú, tổng tiền |
| Theo dõi đơn | `/orders/:orderId` | Chi tiết đơn, trạng thái, các mốc cập nhật; lý do và thời gian nếu đơn bị hủy |
| QR không hợp lệ | Hiển thị theo kết quả kiểm tra | Giải thích bàn không tồn tại hoặc ngừng phục vụ |

Giai đoạn 5, **hộp chi tiết món** có chọn số lượng thêm và ghi chú trước khi thêm giỏ. Một món có một dòng trong giỏ, thêm lại sẽ cộng số lượng (tối đa 99) và áp dụng ghi chú đang nhập cho dòng đó.

Trang khách `/menu/:qrToken` nằm ngoài `AuthProvider`, dùng Axios riêng không đọc/gửi JWT. Bàn không tồn tại trả lỗi `404`; bàn tắt trả `403` với thông báo không phục vụ. Hệ thống kiểm tra bàn khi mở QR, sau khi nhập tên và khi nhấn làm mới menu.

Giai đoạn 5 lưu tên cùng giỏ trong `localStorage` theo từng `qrToken`, đồng thời đọc lại tên sessionStorage của giai đoạn 4 nếu chưa có giỏ mới. Mở QR khác không mang tên của bàn trước sang. Khách có thể đổi tên khi chưa có lần gửi chờ kết quả. Tên chỉ được gửi và ghi vào MongoDB khi tạo order; đổi tên sau đó không sửa tên trên đơn cũ.

Giao diện khách nên ưu tiên điện thoại vì khách mở bằng QR.

### 5.2. Khu vực đăng nhập và nhân viên

| Màn hình | Đường dẫn | Nội dung |
|---|---|---|
| Đăng nhập nội bộ | `/login` | Chỉ admin/staff: tên đăng nhập, mật khẩu |
| Trang xác nhận đăng nhập | `/staff` hoặc `/admin` | Giai đoạn 3: thông tin tài khoản, kiểm tra quyền, đăng xuất; chưa phải dashboard |
| Danh sách đơn | `/staff/orders` | Đơn đang xử lý mới nhất trước, bộ lọc/phân trang; realtime gọi lại đúng API và thông báo đơn mới; giữ nút làm mới |
| Chi tiết đơn | `/staff/orders/:id` | Món, ghi chú, lịch sử, chuyển trạng thái, xác nhận thanh toán từng đơn; hủy với lý do khi đang pending/confirmed |
| Tình trạng bàn | `/staff/tables` | Bàn trống/đang sử dụng và đơn tại bàn |

### 5.3. Khu vực quản lý

| Màn hình | Đường dẫn |
|---|---|
| Dashboard | `/admin/dashboard` |
| Quản lý món | `/admin/products` |
| Quản lý danh mục | `/admin/categories` |
| Quản lý bàn và QR | `/admin/tables` |
| Quản lý đơn | `/admin/orders` |
| Chi tiết đơn | `/admin/orders/:id` |

Thêm và sửa dữ liệu dùng chung biểu mẫu. Giai đoạn 6, admin/staff dùng cùng `OrdersPage` và `OrderDetailPage`, chỉ khác đường dẫn quay lại. `OrderSummary` dùng cho cả khách và nội bộ; tên nhân viên chỉ hiển thị ở nội bộ. `/admin/tables` có thêm tình trạng và liên kết đến đơn đang xử lý. Giai đoạn 8 đã có `/admin/dashboard`: preset/tháng, summary, chart cột, Top món, recent orders, cảnh báo/lỗi/thử lại; kiểm tra 375px không tràn ngang. `/admin/users` chưa có trong [AppRoutes.jsx](client/src/routes/AppRoutes.jsx); không thuộc phạm vi đã đóng băng. Các kiểm tra 375px là kết quả lịch sử giai đoạn 8, không phải lần chạy trình duyệt mới ở 9C.

### 5.4. Dữ liệu lưu ở frontend

- Giỏ hàng đã dùng React Context và lưu `localStorage` theo qrToken để giữ qua tải lại; xem `CartProvider` tại [CartContext.jsx](client/src/contexts/CartContext.jsx) và `writeCart` tại [guestStorage.js](client/src/utils/guestStorage.js).
- Giỏ hàng phải gắn với bàn, tránh mang món của bàn cũ sang bàn mới.
- Thông tin quyền được dùng để hiển thị giao diện; backend vẫn kiểm tra lại.
- Menu, giá, đơn và trạng thái chính thức lấy từ backend.
- Trong localStorage theo qrToken, `orders` giữ danh sách id/token riêng với `items` và `note`. Cả hai nằm trong cùng một bản ghi để lưu token và xóa phần giỏ bằng một lần ghi, tránh mất mã nếu trình duyệt hết dung lượng.

`localStorage` là nơi trình duyệt lưu dữ liệu qua các lần tải trang; dữ liệu ở đó có thể bị người dùng sửa nên không được coi là đáng tin cậy.

## 6. Socket.IO hoạt động ở đâu?

Giai đoạn 7 đã triển khai Socket.IO để **báo dữ liệu vừa thay đổi**, không xử lý nghiệp vụ qua socket. Express và Socket.IO dùng chung một HTTP server, cùng cổng backend. MongoDB là nguồn chính thức, frontend gọi API sau thông báo để đọc dữ liệu mới.

### 6.1. Khi khách tạo đơn

1. React gửi `POST /api/public/orders`.
2. Backend kiểm tra và lưu đơn.
3. **Sau khi lưu thành công**, backend phát sự kiện `order:created`.
4. Phát thêm `table:updated` cho nội bộ để tải lại số đơn đang xử lý của bàn.
5. Màn hình nhân viên/quản lý hiện thông báo tên bàn/mã đơn và GET lại danh sách với đúng bộ lọc, trang hiện tại.

Không thông báo đơn mới trước khi lưu thành công vì nhân viên có thể nhìn thấy một đơn chưa tồn tại. Trả lại đơn của requestId cũ không phát order:created hoặc table:updated, kể cả các request đến đồng thời. Module thông báo bọc try/catch, lỗi emit không làm API ghi thành công báo lỗi; khi io chưa khởi tạo thì hàm không làm gì để các test API cũ giữ nguyên.

### 6.2. Khi nhân viên đổi trạng thái

1. Nhân viên gọi API cập nhật trạng thái.
2. Backend kiểm tra quyền và bước chuyển.
3. Backend lưu trạng thái cùng lịch sử.
4. Backend phát sự kiện `order:updated` cho room staff và order tương ứng.
5. Khách và các màn hình nội bộ gọi lại API để đọc trạng thái mới.
6. Khi completed, backend gửi thêm `table:updated`; frontend không tự kết luận bàn đã trống.

Hủy thành công phát `order:cancelled` và `table:updated`, không phát trùng order:updated cho cùng lần hủy. Khách đọc trạng thái cancelled và thông tin hủy qua API có X-Order-Token. Lỗi 400/409 hoặc ghi DB thất bại không phát sự kiện thành công. Realtime không thay điều kiện cập nhật theo expectedStatus.

| Event | Room nhận | Payload |
|---|---|---|
| `order:created` | staff | orderId, orderCode, tableId, tableName |
| `order:updated` | staff và order:<id> | orderId, status, updatedAt |
| `order:cancelled` | staff và order:<id> | orderId, status, updatedAt, cancelReason |
| `table:updated` | staff | tableId |

Payload khách không có thông tin nhân viên, món, tiền, JWT, hash hay trackingToken. Bốn event thông báo dùng tên nhất quán như bảng, không có order:status-updated song song.

### 6.3. Chia nhóm người nhận bằng room

**Room** là một nhóm kết nối trong Socket.IO.

| Room | Người được tham gia |
|---|---|
| `staff` | Nhân viên và quản lý đã xác thực |
| `user:<userId>` | Các socket của đúng tài khoản nội bộ, phục vụ ngắt khi khóa/logout |
| `order:<orderId>` | Khách có mã truy cập hợp lệ của đơn |

Staff gửi JWT qua handshake auth, không dùng query string. Middleware kiểm tra JWT và đọc User còn hoạt động/role staff hoặc admin, rồi chính server join staff/user room. Client không có event xin join staff. Không token thì kết nối khách; token sai/hết hạn thì từ chối. Event `session:ready` chỉ trả ACK xác nhận mode và room đã gán, không cấp quyền mới.

Khách tải đơn thành công bằng API trước, rồi gửi `order:join` với orderId/trackingToken. Server dùng cơ chế băm/so sánh token hiện có; đúng mới join và trả ACK. ID sai/không tồn tại/token sai hoặc thiếu cùng một thông báo lỗi. Không log token hoặc gửi token sang client khác.

Server kiểm tra tài khoản online mỗi 5 giây và trước khi phát thông báo: bị khóa/xóa/mất role thì ngắt user room bằng disconnectSockets; JWT hết hạn cũng bị ngắt. API logout ngắt các socket hiện có của tài khoản. Chưa có danh sách thu hồi JWT hoặc giao diện quản lý tài khoản; logout offline chỉ đóng được socket/xóa phiên tại tab đó cho tới khi server nhận được yêu cầu. CORS theo CLIENT_ORIGIN và kiểm tra Origin cả khi mở WebSocket.

### 6.4. Kết hợp API và Socket.IO

| Công việc | Cơ chế |
|---|---|
| Tải menu, đọc danh sách, tạo đơn, đổi trạng thái | API |
| Báo đơn mới và thông báo thay đổi | Socket.IO |
| Lưu dữ liệu chính thức | MongoDB |

Mỗi lần connect, kể cả reconnect, frontend phải **join lại room → chờ ACK → gọi API refetch**. Staff được middleware join rồi chờ session:ready ACK; khách gửi lại order:join rồi chờ ACK. Không giả định room cũ hoặc các event đã nhận là đầy đủ. Lần tải API ban đầu vẫn hoạt động độc lập khi socket chưa sẵn sàng; lỗi socket không khóa thao tác API.

Frontend chỉ có một socket singleton mỗi tab; provider nội bộ hoặc trang đơn khách sở hữu kết nối theo khu vực hiện tại. Listener luôn cleanup bằng off(event, đúng handler). Hook gom thông báo trong khoảng 300ms; khách tải lại thêm khi tab visible. Thông báo nội bộ tối đa 5 đơn gần nhất, nhớ 100 ID để tránh lặp trong phiên. Chưa có âm thanh hoặc push notification.

Không dùng connectionStateRecovery để thay refetch. Phiên bản này chạy **một instance Node**; nhiều instance cần adapter ngoài phạm vi, không cài Redis. Nếu bỏ lỡ emit sau khi DB đã ghi, dữ liệu vẫn khôi phục từ API khi reconnect/làm mới, chưa có queue phát lại.

Đây là điểm quan trọng: realtime làm giao diện cập nhật nhanh, còn dữ liệu trong MongoDB mới là căn cứ chính thức.

### 6.5. Realtime dashboard — giai đoạn 8

Dùng lại socket singleton và bốn event hiện có, không thêm payload doanh thu hoặc room thống kê. Khi range chứa hôm nay: gom thông báo trong 1,5 giây rồi tải lại bốn API dashboard. Range không chứa hôm nay bỏ qua event; vẫn có nút Làm mới. Tab ẩn chờ hiện lại mới tải; mỗi reconnect sau ACK refetch để bù dữ liệu bỏ lỡ. API vẫn dùng khi socket ngắt. AbortController hủy request khi đổi bộ lọc; chỉ kết quả chưa bị hủy được cập nhật, không để phản hồi chậm ghi đè kỳ mới. Listener cleanup đúng handler.

## 7. Lộ trình đã thực hiện và công việc chưa có

Bảng 1–8 mô tả lộ trình phát triển; tiêu chí không tự chứng minh đã thử điện thoại thật hay đã deploy. Chứng cứ kiểm thử mới nhất và phần 9A/9B chưa tìm thấy được ghi tại [GIAI_DOAN_9.md](GIAI_DOAN_9.md).

| Giai đoạn | Công việc | Tiêu chí hoàn thành |
|---|---|---|
| **1. Chốt thiết kế** | Phạm vi, trạng thái, MongoDB, API, phác thảo giao diện | Giải thích được luồng gọi món và thanh toán |
| **2. Tạo nền tảng** | Khởi tạo React/Express, Tailwind, Router, Axios, kết nối MongoDB | Frontend gọi được API; backend đọc/ghi được dữ liệu |
| **3. Đăng nhập nội bộ** | User chỉ admin/staff, lệnh tạo tài khoản ban đầu, đăng nhập, JWT, đăng xuất, bảo vệ route/API | Khách không có User; staff không gọi được API chỉ dành cho admin; chưa làm CRUD nhân viên |
| **4. Menu, bàn và QR** | Quản lý danh mục, món, bàn; tạo QR; menu khách | Quét QR thật trên điện thoại và mở đúng bàn |
| **5. Gọi món bằng API** | Giỏ hàng, ghi chú, tạo đơn, xem đơn | Đơn được lưu đúng bàn, món, giá và số lượng |
| **6. Vận hành đơn và bàn** | Xác nhận, chuẩn bị, phục vụ, thanh toán riêng, hủy đơn và lịch sử | Chỉ hủy pending/confirmed; completed là đã phục vụ và thanh toán; bàn loại trừ đơn hủy/hoàn thành |
| **7. Realtime** | Thông báo đơn mới, cập nhật trạng thái và bàn, xử lý kết nối lại | Hai trình duyệt thấy cập nhật; mất mạng rồi kết nối lại vẫn đúng |
| **8. Dashboard** | Doanh thu, số đơn, món bán chạy, doanh thu món | Số liệu khớp dữ liệu mẫu đã tính bằng tay |
| **Kế hoạch 8b cũ — chưa triển khai** | UI/API nhân viên, đổi/reset mật khẩu | Ngoài phạm vi code hiện có; chỉ xem là hướng phát triển khi mở lại phạm vi |
| **9C. Tài liệu bảo vệ** | Đọc source, viết Q&A/sơ đồ/demo, chạy lại test và build | Có tài liệu đối chiếu code; chưa xác minh 9A/9B, deploy hay điện thoại thật vì không có bằng chứng trong workspace |

Nên làm luồng API ổn định trước khi thêm Socket.IO. Khi đó, nếu realtime lỗi thì dễ xác định lỗi nằm ở kết nối thông báo hay nghiệp vụ đơn hàng.

Khi thử QR trên điện thoại, địa chỉ trong QR phải truy cập được từ điện thoại, ví dụ địa chỉ mạng nội bộ của máy chạy ứng dụng hoặc tên miền đã triển khai; `localhost` trên điện thoại không trỏ đến máy tính.

## 8. Những phần quan trọng để bảo vệ khóa luận

### 8.1. Bài toán thực tế và phạm vi giải quyết

Bạn cần trình bày được hệ thống giúp:

- Khách chủ động xem menu và gửi yêu cầu.
- Nhân viên nhận đơn tập trung và xem rõ ghi chú.
- Khách biết tiến độ xử lý.
- Quản lý theo dõi hoạt động và doanh thu.

Không nên khẳng định hệ thống chắc chắn giảm một tỷ lệ thời gian cụ thể nếu chưa đo kiểm.

### 8.2. Thiết kế dữ liệu và giá lịch sử

Câu hỏi thường gặp:

> Vì sao trong đơn đã có mã món mà vẫn lưu tên và giá?

Vì thông tin món có thể thay đổi, còn giao dịch đã phát sinh phải được giữ nguyên.

Bạn cũng cần giải thích vì sao nhúng danh sách món trong đơn nhưng tách bàn, danh mục và tài khoản thành collection riêng.

### 8.3. Xác thực và phân quyền

Cần phân biệt:

- **Xác thực:** người này là ai?
- **Phân quyền:** người này được làm gì?

Nhân viên/quản lý dùng JWT. Khách không có tài khoản và không đăng nhập; tên khách chỉ là `customerName` trong đơn. Quyền theo dõi đơn dùng mã truy cập riêng, không dựa trên tên. Backend kiểm tra quyền, kể cả khi người dùng tự gọi API ngoài giao diện.

### 8.4. Tính đúng đắn của đơn hàng

Các tình huống cần xử lý và kiểm thử:

- Số lượng âm, bằng 0 hoặc không phải số nguyên.
- Món vừa hết hàng nhưng vẫn nằm trong giỏ.
- Bàn đã ngừng nhận đơn.
- Người dùng sửa giá hoặc tổng tiền trong yêu cầu.
- Nhấn gửi nhiều lần hoặc gửi lại sau mất mạng.
- Hai nhân viên cùng cập nhật một đơn.
- Hủy từ `pending`/`confirmed` thành công; hủy từ các trạng thái khác bị từ chối.
- Không cho hủy nếu thiếu lý do; ghi đúng thời gian và tài khoản thực hiện.
- Hủy đơn cuối cùng đang xử lý làm bàn trống; hủy một đơn nhưng còn đơn đang xử lý thì bàn vẫn sử dụng.
- Đơn hủy không làm tăng doanh thu; hoàn thành một đơn không hoàn thành các đơn khác cùng bàn.

Giai đoạn 5 đã dùng `requestId` và unique index trong MongoDB để nhận diện cùng lần gửi, kể cả khi mất phản hồi hoặc nhiều request đến đồng thời. Chỉ khóa nút gửi ở frontend chưa ngăn được mọi trường hợp tạo trùng.

Đối với hai nhân viên, backend cần cập nhật có điều kiện theo trạng thái hiện tại. Yêu cầu dựa trên trạng thái cũ phải bị từ chối và giao diện tải lại dữ liệu.

### 8.5. Realtime và khả năng phục hồi

Bạn nên giải thích được:

- Ai phát sự kiện, ai nhận sự kiện?
- Vì sao dùng room?
- Vì sao phải xác thực trước khi tham gia room?
- Mất mạng có làm mất đơn đã lưu không?
- Vì sao phải tải lại dữ liệu khi kết nối lại?

Đây là phần thể hiện rõ sự phối hợp giữa React, Express, MongoDB và Socket.IO.

### 8.6. Công thức thống kê

Trong phạm vi chưa có giảm giá, thuế hoặc hoàn tiền:

- **Doanh thu:** tổng totalAmount đã lưu của đơn completed có paidAt kiểu Date trong khoảng thanh toán Việt Nam.
- **Món bán chạy:** tổng số lượng từng món trong các đơn hoàn thành.
- **Doanh thu theo món:** tổng lineTotal snapshot, không tính lại từ giá Product hiện tại.
- **Bàn đang sử dụng:** số bàn có ít nhất một đơn đang xử lý.

Đơn hủy không được cộng vào doanh thu hoặc số lượng món đã bán. Chỉ các trạng thái `pending`, `confirmed`, `preparing`, `served` giữ bàn đang sử dụng.

Phải giải thích được vì sao đơn chờ xác nhận chưa phải doanh thu và vì sao đổi giá món hôm nay không làm thay đổi thống kê hôm qua.

### 8.7. Kịch bản demo

Một kịch bản gọn nhưng thể hiện đầy đủ hệ thống:

1. Quản lý tạo danh mục, món và bàn.
2. Hiển thị QR của bàn.
3. Khách quét QR, nhập tên, đặt hai món và nhập ghi chú.
4. Nhân viên nhận thông báo tức thời.
5. Nhân viên cập nhật trạng thái; điện thoại khách thay đổi theo.
6. Khách gọi thêm một đơn ở cùng bàn.
7. Hoàn thành một đơn, chứng minh bàn vẫn đang sử dụng.
8. Hoàn thành đơn còn lại, bàn chuyển về trống và doanh thu cập nhật.
9. Tạo một đơn khác và hủy khi đang chờ xác nhận; trình bày lý do, thời gian, người hủy và chứng minh doanh thu không tăng, bàn trở về trống.

## Các quyết định đã chốt trước khi viết code

- **Có hủy đơn:** `cancelled`, chỉ từ `pending` hoặc `confirmed`; lưu lý do, thời gian và người thực hiện nếu là nhân viên/quản lý; không tính doanh thu hoặc giữ bàn đang sử dụng.
- **Chưa thanh toán gộp:** mỗi đơn được xử lý và hoàn thành riêng.
- **Ý nghĩa `completed`:** đơn đã được phục vụ và nhân viên đã xác nhận thanh toán.

Giai đoạn 2–4 đã có nền tảng, đăng nhập nội bộ, danh mục, món, bàn, QR và menu khách. Giai đoạn 5 đã có giỏ, Order model, chống gửi trùng và xem đơn bằng mã riêng. Giai đoạn 6 đã có vận hành đơn, thanh toán riêng, lịch sử và tình trạng bàn. Giai đoạn 7 thêm thông báo Socket.IO, xác thực room và phục hồi bằng API sau reconnect. Giai đoạn 8 thêm dashboard theo paidAt/createdAt, snapshot và múi giờ Việt Nam: **211/211 backend test** (157 cũ giữ nguyên + 54 dashboard), build và Chrome dashboard đạt. Bộ A–E ra revenue 300.000đ, totalOrders 4, completedOrders 2, activeOrders 2, activeTables 1. Chưa có thanh toán online hoặc gộp hóa đơn.

Nền tảng đã được tạo và kiểm tra với frontend `http://localhost:5174`, backend `http://localhost:3000`, MongoDB cục bộ qua Docker. Xem [README.md](README.md) để biết cấu trúc thư mục, lệnh chạy, cấu hình môi trường và kết quả kiểm tra.

Chi tiết giai đoạn 4, API, kết quả kiểm thử và cách demo: [GIAI_DOAN_4.md](GIAI_DOAN_4.md).

Chi tiết triển khai và kiểm tra giai đoạn 5: [GIAI_DOAN_5.md](GIAI_DOAN_5.md).

Chi tiết triển khai, API, kiểm thử và demo giai đoạn 6: [GIAI_DOAN_6.md](GIAI_DOAN_6.md).

Chi tiết room/event, bảo mật, reconnect, kiểm thử và demo realtime: [GIAI_DOAN_7.md](GIAI_DOAN_7.md).

Chi tiết thống kê, data integrity, explain/index, bộ tính tay và demo dashboard: [GIAI_DOAN_8.md](GIAI_DOAN_8.md).


## Đối chiếu kỹ thuật với code cuối — lượt 9C

Bảng này là địa chỉ đọc code cho các giải thích ở những phần trên; không chỉ dựa vào kế hoạch ban đầu.

| Phần | File/hàm thực tế |
|---|---|
| Quyền và tên khách (1.2–1.5) | [User.js](server/src/models/User.js), `requireAuth`/`requireRoles` ở [authMiddleware.js](server/src/middlewares/authMiddleware.js), `validateOrder` ở [orderValidation.js](server/src/utils/orderValidation.js) |
| Trạng thái, hủy, thanh toán (1.6) | `orderTransitions` ở [orderStatus.js](server/src/utils/orderStatus.js), `changeOrderStatus` ở [orderWorkflowService.js](server/src/services/orderWorkflowService.js) |
| Bàn (1.7, 3.4) | `listTables`/`getTableQr` ở [tableController.js](server/src/controllers/tableController.js), [Table.js](server/src/models/Table.js) |
| Kiến trúc và thư viện (2) | `createApp` ở [app.js](server/src/app.js), `startServer` ở [server.js](server/src/server.js), [server/package.json](server/package.json), [client/package.json](client/package.json) |
| Schema và index (3) | [User.js](server/src/models/User.js), [Category.js](server/src/models/Category.js), [Product.js](server/src/models/Product.js), [Table.js](server/src/models/Table.js), [Order.js](server/src/models/Order.js) |
| API khách, giá, snapshot, chống trùng (4.1) | [publicMenuRoutes.js](server/src/routes/publicMenuRoutes.js), `createGuestOrder`/`creationResult` ở [orderService.js](server/src/services/orderService.js), `getPublicOrder` ở [publicOrderController.js](server/src/controllers/publicOrderController.js) |
| Login/logout và JWT (4.2) | [authRoutes.js](server/src/routes/authRoutes.js), `login`/`logout` ở [authController.js](server/src/controllers/authController.js), [token.js](server/src/utils/token.js) |
| API xử lý đơn/menu/bàn (4.3–4.5) | [orderRoutes.js](server/src/routes/orderRoutes.js), [catalogRoutes.js](server/src/routes/catalogRoutes.js), `orderListQuery`/`orderChangeBody` ở [internalOrderValidation.js](server/src/utils/internalOrderValidation.js) |
| Thống kê và múi giờ (4.7, 8.6) | [dashboardRoutes.js](server/src/routes/dashboardRoutes.js), `dashboardSummary`/`dashboardProducts`/`dashboardRevenue`/`dashboardRecentOrders` ở [dashboardService.js](server/src/services/dashboardService.js), `dashboardRange` ở [dashboardRange.js](server/src/utils/dashboardRange.js) |
| Màn hình, storage và giỏ (5) | [AppRoutes.jsx](client/src/routes/AppRoutes.jsx), [AuthContext.jsx](client/src/contexts/AuthContext.jsx), [CartContext.jsx](client/src/contexts/CartContext.jsx), [guestStorage.js](client/src/utils/guestStorage.js) |
| Room, token và thông báo (6) | `initializeRealtime` ở [realtimeServer.js](server/src/sockets/realtimeServer.js), [notifications.js](server/src/sockets/notifications.js), `matchesTrackingToken` ở [orderToken.js](server/src/utils/orderToken.js) |
| Reconnect và debounce (6.4–6.5) | [useSocketSession.js](client/src/realtime/useSocketSession.js), [useRealtimeRefresh.js](client/src/realtime/useRealtimeRefresh.js), [useDashboard.js](client/src/hooks/useDashboard.js) |

Bổ sung để diễn giải chính xác: bộ lọc dashboard trên UI có preset và tháng; API còn hỗ trợ from/to, nhưng chưa có form tùy chọn from/to trên UI. Số bàn trống/đang dùng bao gồm danh sách bàn hiện có, cả bàn đã tắt nếu vẫn có đơn chưa xong; không được đồng nhất “trống” với “đang mở phục vụ”. Doanh thu là tiền được staff xác nhận, chưa đối chiếu ngân hàng. Căn cứ: [DashboardPage.jsx](client/src/pages/admin/DashboardPage.jsx), `dashboardSummary` ở [dashboardService.js](server/src/services/dashboardService.js).

Lượt 9C chạy lại: 211/211 test backend đạt, build frontend thành công. Check:data có bốn nhóm lỗi bằng 0 nhưng DB đang có 0 order; không coi đó là dữ liệu demo đã sẵn sàng. Explain trên DB này dùng IXSCAN cho doanh thu và số đơn, chưa có kết luận tốc độ với tải lớn. Số liệu build, thời điểm, giới hạn kiểm chứng và demo được ghi đầy đủ tại [GIAI_DOAN_9.md](GIAI_DOAN_9.md) và [BAO_VE_KHOA_LUAN.md](BAO_VE_KHOA_LUAN.md).
