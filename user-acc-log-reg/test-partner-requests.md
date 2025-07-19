# Hướng dẫn Test API Partner Requests

## 1. POST /partner-requests (Apply vào post)

### Mục đích:
Gửi yêu cầu kết nối với thông tin post cụ thể.

### Cách test bằng Postman:

**Request:**
```
POST http://localhost:4000/partner-requests
Headers:
  Content-Type: application/json
  Authorization: Bearer <token>

Body:
{
  "from": "user1",
  "to": "user2", 
  "postId": "1710000000001_abcde1",
  "message": "Tôi quan tâm đến bài viết của bạn"
}
```

**Response thành công:**
```json
{
  "message": "Đã gửi yêu cầu kết nối",
  "request": {
    "from": "user1",
    "to": "user2",
    "postId": "1710000000001_abcde1", 
    "message": "Tôi quan tâm đến bài viết của bạn",
    "status": "pending",
    "createdAt": 1710000000001
  }
}
```

## 2. GET /partner-requests (Lấy data cho notification)

### Mục đích:
Lấy danh sách yêu cầu kết nối gửi đến user (cho notification).

### Cách test bằng Postman:

**Request:**
```
GET http://localhost:4000/partner-requests?username=user2&status=pending
```

**Response:**
```json
{
  "requests": [
    {
      "from": "user1",
      "to": "user2",
      "postId": "1710000000001_abcde1",
      "message": "Tôi quan tâm đến bài viết của bạn",
      "status": "pending",
      "createdAt": 1710000000001,
      "avatar": "http://localhost:4000/avatars/user1.png",
      "post": {
        "id": "1710000000001_abcde1",
        "title": "Thiết kế logo #1",
        "type": "OFFER",
        "skills": ["Design", "Logo"],
        "price": {"min": 105, "max": 155},
        "description": "Bài viết về chủ đề Thiết kế logo số 1",
        "proofs": [{"file": "http://localhost:4000/post_images/proof1.jpg", "link": "https://github.com/example/proof1.jpg"}],
        "author": {"username": "user1"},
        "createdAt": 1710000000001,
        "rating": 0,
        "reactions": "NONE"
      }
    }
  ],
  "total": 1,
  "pending": 1
}
```

## 3. GET /partner-requests/sent (Lấy yêu cầu đã gửi)

### Mục đích:
Lấy danh sách yêu cầu kết nối mà user đã gửi.

### Cách test bằng Postman:

**Request:**
```
GET http://localhost:4000/partner-requests/sent?username=user1
```

**Response:**
```json
{
  "requests": [
    {
      "from": "user1",
      "to": "user2", 
      "postId": "1710000000001_abcde1",
      "message": "Tôi quan tâm đến bài viết của bạn",
      "status": "pending",
      "createdAt": 1710000000001,
      "avatar": "http://localhost:4000/avatars/user2.png",
      "post": {
        "id": "1710000000001_abcde1",
        "title": "Thiết kế logo #1",
        "type": "OFFER",
        "skills": ["Design", "Logo"],
        "price": {"min": 105, "max": 155},
        "description": "Bài viết về chủ đề Thiết kế logo số 1",
        "proofs": [{"file": "http://localhost:4000/post_images/proof1.jpg", "link": "https://github.com/example/proof1.jpg"}],
        "author": {"username": "user1"},
        "createdAt": 1710000000001,
        "rating": 0,
        "reactions": "NONE"
      }
    }
  ],
  "total": 1
}
```

## 4. Test bằng cURL

### Apply vào post:
```bash
curl -X POST http://localhost:4000/partner-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "from": "user1",
    "to": "user2",
    "postId": "1710000000001_abcde1", 
    "message": "Tôi quan tâm đến bài viết của bạn"
  }'
```

### Lấy notifications:
```bash
curl -X GET "http://localhost:4000/partner-requests?username=user2&status=pending"
```

### Lấy yêu cầu đã gửi:
```bash
curl -X GET "http://localhost:4000/partner-requests/sent?username=user1"
```

## 5. Các trường hợp test

### Test thành công:
1. Gửi yêu cầu kết nối với postId hợp lệ
2. Lấy danh sách yêu cầu gửi đến
3. Lấy danh sách yêu cầu đã gửi

### Test lỗi:
1. Thiếu thông tin bắt buộc (from, to, postId)
2. Gửi yêu cầu trùng lặp
3. postId không tồn tại
4. Username không tồn tại

## 6. Lưu ý

- API POST `/partner-requests` sẽ tự động tạo notification cho người nhận
- API GET `/partner-requests` trả về thông tin đầy đủ bao gồm avatar và thông tin post
- Có thể lọc theo status (pending, accepted, rejected) trong GET request
- Tất cả API đều yêu cầu authentication (Bearer token) 