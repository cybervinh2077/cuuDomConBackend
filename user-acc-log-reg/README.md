# User Account Login/Register with Google Sheets

## Cài đặt

1. Cài dependencies:
   ```bash
   npm install
   ```
2. Tạo Google Sheet, lấy SHEET_ID và đặt tên sheet (ví dụ: users).
3. Tạo Google Cloud Project, bật Google Sheets API, tạo Service Account, tải file credentials JSON.
4. Chia sẻ Google Sheet cho email Service Account.
5. Thêm code xác thực Google API vào `index.js` (xem hướng dẫn trong file).

## Chạy server
```bash
npm start
```

## API
- `POST /register`  `{ username, password }`
- `POST /login`     `{ username, password }`

## Ghi chú
- Mặc định code chỉ demo, chưa ghi/đọc Google Sheet thật. Xem TODO trong code để hoàn thiện. 