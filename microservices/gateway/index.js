const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

const app = express();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Proxy cho user-service
app.use([
  '/register', '/login', '/reset-password', '/get-profile', '/update-profile', '/upload-avatar',
  '/partner-request', '/partner-requests', '/partner-request/respond', '/partners', '/remove-partner', '/user', '/avatars', '/notifications'
], authMiddleware,
  createProxyMiddleware({ target: 'http://user-service:4001', changeOrigin: true })
);

// Proxy cho post-service
app.use(['/posts', '/upload-post-image', '/post_images'],
  createProxyMiddleware({ target: 'http://post-service:4002', changeOrigin: true })
);

// Proxy cho chat-service
app.use(['/messages', '/upload-chat-image', '/chat_images', '/socket.io'],
  createProxyMiddleware({ target: 'http://chat-service:4003', changeOrigin: true, ws: true })
);

// Proxy cho notification-service (notification hệ thống)
app.use(['/notifications'],
  createProxyMiddleware({ target: 'http://notification-service:4004', changeOrigin: true })
);

app.get('/', (req, res) => {
  res.send('API Gateway is running');
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
}); 