# User Account Login/Register with Google Sheets

## Giới thiệu
Đây là backend Node.js cho hệ thống đăng nhập/đăng ký tài khoản, lưu thông tin trên Google Sheets, hỗ trợ upload avatar, chat, bạn bè, thông báo, và quản lý bài đăng.

## Cài đặt
1. Cài Node.js (khuyên dùng Node 18+)
2. Cài dependencies:
   ```bash
   npm install
   ```
3. Tạo Google Sheet, lấy SHEET_ID và đặt tên sheet (ví dụ: users).
4. Tạo Google Cloud Project, bật Google Sheets API, tạo Service Account, tải file credentials JSON.
5. Chia sẻ Google Sheet cho email Service Account.
6. Đặt file `credentials.json` vào cùng thư mục với `index.js`.

## Cấu hình host và port
Bạn có thể tùy chỉnh host (IP hoặc localhost) và port server bằng 2 cách:

### 1. Sửa trực tiếp trong code (file `index.js` cuối file):
```js
const HOST = process.env.HOST || 'localhost'; // hoặc '192.168.x.x' hoặc '0.0.0.0'
const PORT = process.env.PORT || 4000;
```
- Đổi `'localhost'` thành IP bạn muốn (ví dụ: `'192.168.2.65'`)
- Đổi `4000` thành port bạn muốn

### 2. Dùng biến môi trường khi chạy server:
- Trên Linux/macOS:
  ```bash
  HOST=192.168.2.65 PORT=4000 node index.js
  ```
- Trên Windows PowerShell:
  ```powershell
  $env:HOST="192.168.2.65"; $env:PORT="4000"; node index.js
  ```

## Chạy server
```bash
npm start
# hoặc
node index.js
```

Server sẽ chạy tại: `http://<HOST>:<PORT>`

## API cơ bản
- `POST /register`  `{ username, password }` — Đăng ký tài khoản
- `POST /login`     `{ username, password }` — Đăng nhập
- `POST /upload-avatar` — Upload avatar (multipart/form-data)
- `GET /get-profile?username=...` — Lấy profile user
- `POST /update-profile` — Cập nhật profile
- `POST /friend-request` — Gửi yêu cầu kết bạn
- `GET /friend-requests?username=...` — Lấy danh sách yêu cầu kết bạn
- `POST /friend-request/respond` — Đồng ý/từ chối kết bạn
- `GET /friends?username=...` — Lấy danh sách bạn bè
- `POST /remove-friend` — Xóa bạn bè
- `GET /notifications?username=...` — Lấy thông báo
- `POST /messages` — Gửi tin nhắn
- `GET /messages?user1=...&user2=...` — Lấy lịch sử chat
- `POST /upload-chat-image` — Upload ảnh chat
- `POST /posts` — Tạo bài đăng
- `GET /posts` — Lấy danh sách bài đăng
- `DELETE /posts/:id` — Xóa bài đăng
- `POST /upload-post-image` — Upload ảnh bài đăng

## Ghi chú
- Ảnh avatar, chat, bài đăng được lưu trong các thư mục con (`avatars/`, `chat_images/`, `post_images/`).
- Các API trả về link ảnh dựa trên HOST và PORT bạn cấu hình.
- Để dùng trên nhiều máy, hãy đảm bảo HOST là IP trong mạng LAN hoặc 0.0.0.0.

## License
MIT 