import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const NOTIFICATIONS_PATH = path.join(DATA_DIR, 'notifications.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);

function loadNotifications() {
  try { return JSON.parse(readFileSync(NOTIFICATIONS_PATH, 'utf8')); } catch { return []; }
}
function saveNotifications(notifs) {
  writeFileSync(NOTIFICATIONS_PATH, JSON.stringify(notifs, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Lấy tất cả notification hệ thống
app.get('/notifications', (req, res) => {
  const notifs = loadNotifications();
  res.json({ notifications: notifs });
});
// Gửi notification hệ thống
app.post('/notifications', (req, res) => {
  const notif = req.body;
  if (!notif || !notif.type || !notif.content) {
    return res.status(400).json({ message: 'Thiếu thông tin notification' });
  }
  notif.id = notif.id || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  notif.createdAt = notif.createdAt || Date.now();
  const notifs = loadNotifications();
  notifs.push(notif);
  saveNotifications(notifs);
  res.json({ message: 'Đã gửi notification', notif });
});
// Xóa notification hệ thống
app.delete('/notifications/:id', (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'Thiếu id' });
  let notifs = loadNotifications();
  const before = notifs.length;
  notifs = notifs.filter(n => n.id !== id);
  if (notifs.length === before) return res.status(404).json({ message: 'Không tìm thấy notification' });
  saveNotifications(notifs);
  res.json({ message: 'Đã xóa notification' });
});

app.get('/', (req, res) => {
  res.send('Notification Service is running');
});

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
}); 