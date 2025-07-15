import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_IMG_DIR = path.join(__dirname, 'chat_images');
const DATA_DIR = path.join(__dirname, 'data');
const MESSAGES_PATH = path.join(DATA_DIR, 'messages.json');

if (!existsSync(CHAT_IMG_DIR)) mkdirSync(CHAT_IMG_DIR);

const chatImgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CHAT_IMG_DIR),
  filename: (req, file, cb) => {
    const username = req.body.from || 'unknown';
    const ext = file.originalname.split('.').pop();
    cb(null, `${username}_${Date.now()}.${ext}`);
  }
});
const uploadChatImg = multer({ storage: chatImgStorage });

function loadMessages() {
  try { return JSON.parse(readFileSync(MESSAGES_PATH, 'utf8')); } catch { return []; }
}
function saveMessages(msgs) {
  writeFileSync(MESSAGES_PATH, JSON.stringify(msgs, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/chat_images', express.static(CHAT_IMG_DIR));

// API lấy lịch sử tin nhắn giữa 2 user
app.get('/messages', (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) return res.status(400).json({ message: 'Thiếu thông tin' });
  let msgs = loadMessages();
  msgs = msgs.filter(m =>
    (m.from === user1 && m.to === user2) || (m.from === user2 && m.to === user1)
  );
  res.json({ messages: msgs });
});
// API gửi tin nhắn
app.post('/messages', (req, res) => {
  const { from, to, text, image } = req.body;
  if (!from || !to || (!text && !image)) return res.status(400).json({ message: 'Thiếu thông tin' });
  let msgs = loadMessages();
  const msg = { from, to, text, image, createdAt: Date.now() };
  msgs.push(msg);
  saveMessages(msgs);
  // Phát tin nhắn mới tới cả người nhận và người gửi nếu đang online
  if (userSockets[to]) {
    io.to(userSockets[to]).emit('new_message', msg);
  }
  if (userSockets[from]) {
    io.to(userSockets[from]).emit('new_message', msg);
  }
  res.json({ message: 'Đã gửi', msg });
});
// API upload ảnh chat
app.post('/upload-chat-image', uploadChatImg.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Thiếu file ảnh' });
  const url = `/chat_images/${req.file.filename}`;
  res.json({ message: 'Upload thành công', url });
});

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
const userSockets = {};

io.on('connection', (socket) => {
  socket.on('register', (username) => {
    userSockets[username] = socket.id;
  });
  socket.on('disconnect', () => {
    for (const [user, id] of Object.entries(userSockets)) {
      if (id === socket.id) delete userSockets[user];
    }
  });
});

app.get('/', (req, res) => {
  res.send('Chat Service is running');
});

const PORT = process.env.PORT || 4003;
server.listen(PORT, () => {
  console.log(`Chat Service running on port ${PORT}`);
}); 