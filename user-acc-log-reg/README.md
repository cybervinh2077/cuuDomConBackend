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

---

# HƯỚNG DẪN KIỂM TRA API (GET/POST) VÀ XEM JSON

## 1. Xem JSON trên web (trình duyệt, Postman)

### A. Trình duyệt (GET)
- Truy cập các endpoint GET, ví dụ:
  - **Profile user:**  
    `http://localhost:4000/get-profile?username=yourname`
  - **Danh sách bài đăng:**  
    `http://localhost:4000/posts`
  - **Thông báo:**  
    `http://localhost:4000/notifications?username=yourname`
- Kết quả trả về là JSON, bạn sẽ thấy các trường như:
  ```json
  {
    "profile": {
      "username": "yourname",
      "email": "abc@gmail.com",
      "phone": "0123456789",
      "dob": "2000-01-01",
      "fullName": "Nguyen Van A",
      "region": "Hanoi",
      "avatar": "http://localhost:4000/avatars/yourname.png"
    }
  }
  ```

### B. Postman (GET/POST)
- **GET:**  
  - Chọn method GET, nhập URL như trên, nhấn Send.
- **POST:**  
  - Chọn method POST, nhập URL (ví dụ: `/register`, `/login`, `/partner-request`, `/messages`, `/posts`...)
  - Chọn Body > raw > JSON, nhập dữ liệu, ví dụ:
    ```json
    {
      "username": "yourname",
      "password": "yourpass",
      "email": "abc@gmail.com",
      "phone": "0123456789"
    }
    ```
  - Nhấn Send, xem kết quả JSON trả về với các trường tương ứng.

## 2. Xem JSON trên CMD (curl, PowerShell)

### A. curl (GET)
```cmd
curl "http://localhost:4000/get-profile?username=yourname"
curl "http://localhost:4000/posts"
curl "http://localhost:4000/notifications?username=yourname"
```
**Kết quả:**  
Bạn sẽ thấy JSON với các trường như username, email, phone, v.v.

### B. curl (POST)
```cmd
curl -X POST http://localhost:4000/register -H "Content-Type: application/json" -d "{\"username\":\"yourname\",\"password\":\"yourpass\",\"email\":\"abc@gmail.com\",\"phone\":\"0123456789\"}"
```
**Kết quả:**  
JSON trả về thông báo hoặc dữ liệu liên quan.

### C. PowerShell (GET)
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/get-profile?username=yourname" -Method GET
```

### D. PowerShell (POST)
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/register" -Method POST -ContentType "application/json" -Body '{"username":"yourname","password":"yourpass","email":"abc@gmail.com","phone":"0123456789"}'
```

## 3. Ví dụ thực tế cho từng trường

- **Lấy profile:**  
  `curl "http://localhost:4000/get-profile?username=yourname"`
- **Lấy bài đăng:**  
  `curl "http://localhost:4000/posts"`
- **Gửi bài đăng mới:**  
  ```cmd
  curl -X POST http://localhost:4000/posts -H "Content-Type: application/json" -d "{\"title\":\"Tuyển designer\",\"author\":{\"username\":\"yourname\"},\"skills\":[\"Design\"],\"price\":1000000,\"description\":\"Thiết kế logo\",\"proofs\":[\"logo1.png\"]}"
  ```
- **Gửi tin nhắn (chat):**  
  ```cmd
  curl -X POST http://localhost:4000/messages -H "Content-Type: application/json" -d "{\"from\":\"user1\",\"to\":\"user2\",\"text\":\"Hello!\"}"
  ```
- **Lấy lịch sử chat giữa 2 user:**  
  `curl "http://localhost:4000/messages?user1=user1&user2=user2"`
- **Gửi ảnh chat:**  
  ```cmd
  curl -X POST http://localhost:4000/upload-chat-image -F "image=@/duongdan/tenfile.jpg" -F "from=user1"
  ```
  (Sau đó lấy link ảnh trả về để gửi kèm trường `image` khi POST /messages)

## 4. Lưu ý
- Thay `localhost:4000` bằng IP thực tế nếu chạy trên máy khác.
- Thay các giá trị trường cho phù hợp với dữ liệu bạn muốn kiểm tra.
- Kết quả trả về luôn là JSON, có thể copy vào [jsonformatter.org](https://jsonformatter.org/) để xem đẹp hơn.

---

# API CHI TIẾT

## 1. Đăng ký/Đăng nhập

### Đăng ký tài khoản
- **POST** `/register`
- Body:
  ```json
  { "username": "string", "password": "string" }
  ```
  - `username`: Tên tài khoản (bắt buộc, duy nhất)
  - `password`: Mật khẩu (bắt buộc)
- Response:
  ```json
  { "message": "Đăng ký thành công!" }
  ```

### Đăng nhập
- **POST** `/login`
- Body:
  ```json
  { "username": "string", "password": "string" }
  ```
  - `username`: Tên tài khoản
  - `password`: Mật khẩu
- Response:
  ```json
  { "message": "Đăng nhập thành công!" }
  ```

## 2. Quản lý hồ sơ

### Lấy profile user
- **GET** `/get-profile?username=...`
  - `username`: Tên tài khoản cần lấy thông tin
- Response:
  ```json
  { "profile": { "username": "...", "email": "...", "phone": "...", "dob": "...", "fullName": "...", "region": "...", "avatar": "..." } }
  ```
  - `email`: Email người dùng
  - `phone`: Số điện thoại
  - `dob`: Ngày sinh (YYYY-MM-DD)
  - `fullName`: Họ tên đầy đủ
  - `region`: Khu vực/sinh sống
  - `avatar`: Link ảnh đại diện

### Cập nhật profile
- **POST** `/update-profile`
- Body:
  ```json
  { "username": "string", "email": "string", "phone": "string", "dob": "string", "fullName": "string", "region": "string" }
  ```
  - `username`: Tên tài khoản
  - `email`: Email mới
  - `phone`: Số điện thoại mới
  - `dob`: Ngày sinh mới
  - `fullName`: Họ tên đầy đủ
  - `region`: Khu vực/sinh sống
- Response:
  ```json
  { "message": "Cập nhật thành công!" }
  ```

### Upload avatar
- **POST** `/upload-avatar`
- FormData:
  - `avatar`: File ảnh
  - `username`: Tên tài khoản
- Response:
  ```json
  { "message": "Upload thành công", "url": "..." }
  ```

## 3. Kết bạn & bạn bè

### Gửi yêu cầu kết bạn
- **POST** `/partner-request`
- Body:
  ```json
  { "from": "string", "to": "string" }
  ```
  - `from`: Username người gửi lời mời
  - `to`: Username người nhận lời mời
- Response:
  ```json
  { "message": "Đã gửi yêu cầu kết bạn" }
  ```

### Lấy danh sách yêu cầu kết bạn
- **GET** `/partner-requests?username=...`
  - `username`: Tên tài khoản cần xem lời mời
- Response:
  ```json
  { "requests": [ { "from": "...", "to": "...", "status": "pending", "createdAt": 123456789 } ] }
  ```
  - `status`: Trạng thái (`pending`, `accepted`, `rejected`)
  - `createdAt`: Thời gian gửi (timestamp)

### Đồng ý/từ chối kết bạn
- **POST** `/partner-request/respond`
- Body:
  ```json
  { "from": "string", "to": "string", "accept": true/false }
  ```
  - `from`: Username người gửi lời mời
  - `to`: Username người nhận lời mời
  - `accept`: true (đồng ý) hoặc false (từ chối)
- Response:
  ```json
  { "message": "Đã đồng ý kết bạn" }
  ```

### Lấy danh sách bạn bè
- **GET** `/partners?username=...`
  - `username`: Tên tài khoản cần xem danh sách bạn bè
- Response:
  ```json
  { "partners": [ ... ] }
  ```

### Xóa bạn bè
- **POST** `/remove-partner`
- Body:
  ```json
  { "username": "string", "partner": "string" }
  ```
  - `username`: Tên tài khoản
  - `partner`: Username bạn muốn xóa
- Response:
  ```json
  { "message": "Đã xóa bạn bè" }
  ```

## 4. Thông báo

### Lấy thông báo của user
- **GET** `/notifications?username=...`
  - `username`: Tên tài khoản cần xem thông báo
- Response:
  ```json
  { "notifications": [ { "to": "username", "type": "partner-response", "from": "username", "accept": true, "createdAt": 123456789 } ] }
  ```
  - `type`: Loại thông báo (ví dụ: `partner-response`)
  - `from`: Username người gửi thông báo
  - `accept`: true/false (nếu là phản hồi kết bạn)
  - `createdAt`: Thời gian

## 5. Tin nhắn (Chat)

### Gửi tin nhắn
- **POST** `/messages`
- Body:
  ```json
  { "from": "string", "to": "string", "text": "string", "image": "string (url)" }
  ```
  - `from`: Username người gửi
  - `to`: Username người nhận
  - `text`: Nội dung tin nhắn (có thể rỗng nếu gửi ảnh)
  - `image`: Link ảnh (nếu gửi ảnh, có thể rỗng nếu chỉ gửi text)
- Response:
  ```json
  { "message": "Đã gửi", "msg": { "from": "user1", "to": "user2", "text": "Hello!", "image": null, "createdAt": 123456789 } }
  ```

### Lấy lịch sử chat giữa 2 user
- **GET** `/messages?user1=...&user2=...`
  - `user1`, `user2`: 2 tài khoản cần lấy lịch sử chat
- Response:
  ```json
  { "messages": [ { "from": "user1", "to": "user2", "text": "Hello!", "image": null, "createdAt": 123456789 } ] }
  ```
  - `createdAt`: Thời gian gửi

### Upload ảnh chat
- **POST** `/upload-chat-image`
- FormData:
  - `image`: File ảnh
  - `from`: Username người gửi
- Response:
  ```json
  { "message": "Upload thành công", "url": "http://localhost:4000/chat_images/tenfile.jpg" }
  ```

## 6. Bài đăng

### Tạo bài đăng mới
- **POST** `/posts`
- Body:
  ```json
  { "title": "string", "author": { "username": "string" }, "skills": ["string"], "price": "number", "description": "string", "proofs": ["filename"], ... }
  ```
  - `title`: Tiêu đề bài đăng
  - `author`: Thông tin người đăng (object, bắt buộc có `username`)
  - `skills`: Kỹ năng liên quan (array)
  - `price`: Giá (nếu có)
  - `description`: Mô tả chi tiết
  - `proofs`: Danh sách file chứng minh (ảnh, file...)
- Response:
  ```json
  { "message": "Đã tạo bài đăng", "post": { ... } }
  ```

### Lấy danh sách bài đăng
- **GET** `/posts`
- Response:
  ```json
  { "posts": [ { "id": "...", "title": "...", "author": { ... }, "skills": [ ... ], "price": ..., "description": "...", "proofs": [ ... ], "createdAt": 123456789, ... } ] }
  ```
  - `id`: Mã bài đăng
  - `createdAt`: Thời gian tạo

### Xóa bài đăng
- **DELETE** `/posts/:id`
  - `id`: Mã bài đăng cần xóa (truyền trên URL)
- Response:
  ```json
  { "message": "Đã xóa bài đăng" }
  ```

### Upload ảnh bài đăng
- **POST** `/upload-post-image`
- FormData:
  - `image`: File ảnh
- Response:
  ```json
  { "message": "Upload thành công", "filename": "..." }
  ```

---

## Ghi chú
- Ảnh avatar, chat, bài đăng được lưu trong các thư mục con (`avatars/`, `chat_images/`, `post_images/`).
- Các API trả về link ảnh dựa trên HOST và PORT bạn cấu hình.
- Để dùng trên nhiều máy, hãy đảm bảo HOST là IP trong mạng LAN hoặc 0.0.0.0.

## License
MIT .

# Hướng dẫn chạy server backend Node.js trên Orange Pi và truy cập từ xa

## 1. Cài đặt Node.js trên Orange Pi

```sh
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Copy code lên Orange Pi
- Clone từ GitHub:
  ```sh
  git clone https://github.com/<your-username>/<your-repo>.git
  cd <your-repo>/user-acc-log-reg
  ```
- Hoặc copy trực tiếp thư mục `user-acc-log-reg` sang Orange Pi.

## 3. Cài dependencies và chạy server
```sh
cd user-acc-log-reg
npm install
node index.js
```
- Nếu muốn chạy nền:
  ```sh
  npm install -g pm2
  pm2 start index.js
  ```

## 4. Mở port trên Orange Pi
```sh
sudo ufw allow 4000
```

## 5. Lấy địa chỉ IP nội bộ của Orange Pi
```sh
hostname -I
```

## 6. Truy cập từ thiết bị khác trong cùng mạng LAN
- Truy cập: `http://<IP-OrangePi>:4000/`

## 7. Port Forwarding để truy cập từ ngoài mạng
- Đăng nhập vào router (thường là 192.168.1.1 hoặc 192.168.0.1)
- Tìm mục **Port Forwarding** (hoặc Virtual Server, NAT...)
- Thêm rule:
  - External Port: 4000
  - Internal IP: <IP-OrangePi>
  - Internal Port: 4000
  - Protocol: TCP
- Lưu cấu hình, lấy IP WAN tại [whatismyip.com](https://whatismyip.com)
- Truy cập từ ngoài mạng: `http://<WAN-IP>:4000/`

## 8. Test API
- Dùng Postman hoặc curl:
  - Đăng ký user:
    ```sh
    curl -X POST "http://<IP-OrangePi>:4000/register" -H "Content-Type: application/json" -d '{"username":"testuser","password":"123456"}'
    ```
  - Gửi yêu cầu kết nối:
    ```sh
    curl -X POST "http://<IP-OrangePi>:4000/partner-request" -H "Content-Type: application/json" -d '{"from":"user1","to":"user2"}'
    ```
  - Lấy danh sách kết nối:
    ```sh
    curl "http://<IP-OrangePi>:4000/partners?username=user1"
    ```

## 9. Lưu ý bảo mật
- Chỉ mở port khi cần thiết, nên dùng xác thực hoặc VPN nếu mở ra Internet.
- Nên dùng HTTPS nếu có thể.

## 10. Logging & Health Check
- Log ứng dụng được ghi vào file app.log và console (Winston, Morgan).
- Kiểm tra tình trạng service qua endpoint: `/health`

## 11. Testing
- Chạy unit test:
  ```sh
  npm test
  ```
- Test các API chính bằng Postman/curl như hướng dẫn ở trên.

## 12. CI/CD
- Đã tích hợp GitHub Actions tự động test và build khi push code.