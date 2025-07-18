import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import multer from 'multer';
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn các file và thư mục dữ liệu
const AVATAR_DIR = path.join(__dirname, 'avatars');
const DATA_DIR = path.join(__dirname, 'data');
const PARTNER_REQUESTS_PATH = path.join(DATA_DIR, 'partner_requests.json');
const CREDENTIALS_PATH = path.join(DATA_DIR, 'credentials.json');
const USERS_EXTRA_PATH = path.join(DATA_DIR, 'users_extra.json');
const NOTIFICATIONS_PATH = path.join(DATA_DIR, 'notifications.json');

if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const username = req.body.username;
    const ext = file.originalname.split('.').pop();
    cb(null, `${username}.${ext}`);
  }
});
const upload = multer({ storage });

function loadUsersExtra() {
  try { return JSON.parse(readFileSync(USERS_EXTRA_PATH, 'utf8')); } catch { return {}; }
}
function loadPartnerRequests() {
  try { return JSON.parse(readFileSync(PARTNER_REQUESTS_PATH, 'utf8')); } catch { return []; }
}
function savePartnerRequests(requests) {
  writeFileSync(PARTNER_REQUESTS_PATH, JSON.stringify(requests, null, 2), 'utf8');
}
function loadNotifications() {
  try { return JSON.parse(readFileSync(NOTIFICATIONS_PATH, 'utf8')); } catch { return []; }
}
function saveNotifications(notifs) {
  writeFileSync(NOTIFICATIONS_PATH, JSON.stringify(notifs, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/avatars', express.static(AVATAR_DIR));

// Google Sheets
const SHEET_ID = '1bZ67uc2R9rpYkYE6BhcqjjDbZGE7wOzuhS3RB9eEgCU';
const SHEET_NAME = 'users';
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8')),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Đăng ký tài khoản
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' });
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:B`,
      valueInputOption: 'RAW',
      requestBody: { values: [[username, password]] },
    });
    return res.json({ message: 'Đăng ký thành công!' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi ghi vào Google Sheet', error: err.message });
  }
});
// Đăng nhập tài khoản
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' });
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:B`,
    });
    const rows = result.data.values || [];
    const found = rows.find(row => row[0] === username && row[1] === password);
    if (found) return res.json({ message: 'Đăng nhập thành công!' });
    else return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi đọc Google Sheet', error: err.message });
  }
});
// Reset mật khẩu
app.post('/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) return res.status(400).json({ message: 'Missing username or new password' });
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:B`,
    });
    const rows = result.data.values || [];
    const idx = rows.findIndex(row => row[0] === username);
    if (idx === -1) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    rows[idx][1] = newPassword;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:B${rows.length}`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
    return res.json({ message: 'Đặt lại mật khẩu thành công!' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi reset mật khẩu', error: err.message });
  }
});
// Upload avatar
app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file || !req.body.username) return res.status(400).json({ message: 'Thiếu file hoặc username' });
  const username = req.body.username;
  const destPath = path.join(AVATAR_DIR, `${username}.png`);
  try {
    await sharp(req.file.path).png().toFile(destPath);
    if (req.file.path !== destPath) {
      import('fs').then(fs => fs.unlinkSync(req.file.path));
    }
    const url = `/avatars/${username}.png`;
    res.json({ message: 'Upload thành công', url });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xử lý ảnh', error: err.message });
  }
});
// Lấy profile
app.get('/get-profile', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Missing username' });
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:E`,
    });
    const rows = result.data.values || [];
    const row = rows.find(r => r[0] === username);
    if (!row) return res.json({ profile: { username } });
    const avatarPath = path.join(AVATAR_DIR, `${username}.png`);
    let avatarUrl = '';
    if (existsSync(avatarPath)) {
      avatarUrl = `/avatars/${username}.png`;
    }
    res.json({ profile: {
      username: row[0],
      email: row[2] || '',
      phone: row[3] || '',
      dob: row[4] || '',
      avatar: avatarUrl
    }});
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy profile', error: err.message });
  }
});
// Cập nhật profile
app.post('/update-profile', async (req, res) => {
  const { username, email, phone, dob, fullName, region } = req.body;
  if (!username) return res.status(400).json({ message: 'Missing username' });
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:G`,
    });
    const rows = result.data.values || [];
    const idx = rows.findIndex(r => r[0] === username);
    if (idx === -1) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    rows[idx][2] = email || '';
    rows[idx][3] = phone || '';
    rows[idx][4] = dob || '';
    rows[idx][5] = fullName || '';
    rows[idx][6] = region || '';
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:G${rows.length}`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
    res.json({ message: 'Cập nhật thành công!' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật profile', error: err.message });
  }
});
// Partner request
app.post('/partner-request', (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ message: 'Thiếu thông tin' });
  let requests = loadPartnerRequests();
  if (requests.some(r => r.from === from && r.to === to && r.status === 'pending')) {
    return res.json({ message: 'Đã gửi yêu cầu trước đó' });
  }
  requests.push({ from, to, status: 'pending', createdAt: Date.now() });
  savePartnerRequests(requests);
  res.json({ message: 'Đã gửi yêu cầu kết nối' });
});
app.get('/partner-requests', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Thiếu username' });
  let requests = loadPartnerRequests();
  let pending = requests.filter(r => r.to === username && r.status === 'pending');
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:E`,
  });
  const rows = result.data.values || [];
  pending = pending.map(r => {
    const row = rows.find(row => row[0] === r.from);
    let avatar = '';
    if (row) {
      const avatarPath = path.join(AVATAR_DIR, `${r.from}.png`);
      if (existsSync(avatarPath)) {
        avatar = `/avatars/${r.from}.png`;
      }
    }
    return { ...r, avatar };
  });
  res.json({ requests: pending });
});
app.post('/partner-request/respond', (req, res) => {
  const { from, to, accept } = req.body;
  if (!from || !to || typeof accept !== 'boolean') return res.status(400).json({ message: 'Thiếu thông tin' });
  let requests = loadPartnerRequests();
  const idx = requests.findIndex(r => r.from === from && r.to === to && r.status === 'pending');
  if (idx === -1) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' });
  requests[idx].status = accept ? 'accepted' : 'rejected';
  savePartnerRequests(requests);
  let notifs = loadNotifications();
  notifs.push({
    to: from,
    type: 'partner-response',
    from: to,
    accept,
    createdAt: Date.now()
  });
  saveNotifications(notifs);
  res.json({ message: accept ? 'Đã đồng ý kết nối' : 'Đã từ chối kết nối' });
});
app.get('/partners', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Thiếu username' });
  let requests = loadPartnerRequests();
  let partners = requests.filter(r =>
    (r.from === username || r.to === username) && r.status === 'accepted'
  );
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:E`,
  });
  const rows = result.data.values || [];
  const partnerList = partners.map(r => {
    const partnerUsername = r.from === username ? r.to : r.from;
    const row = rows.find(row => row[0] === partnerUsername);
    let avatar = '';
    if (row) {
      const avatarPath = path.join(AVATAR_DIR, `${partnerUsername}.png`);
      if (existsSync(avatarPath)) {
        avatar = `/avatars/${partnerUsername}.png`;
      }
    }
    return { username: partnerUsername, avatar };
  });
  res.json({ partners: partnerList });
});
app.post('/remove-partner', (req, res) => {
  const { username, partner } = req.body;
  if (!username || !partner) return res.status(400).json({ message: 'Thiếu thông tin' });
  let requests = loadPartnerRequests();
  requests = requests.filter(r => !(
    ((r.from === username && r.to === partner) || (r.from === partner && r.to === username)) && r.status === 'accepted'
  ));
  savePartnerRequests(requests);
  res.json({ message: 'Đã xóa kết nối' });
});
// Lấy notification cá nhân
app.get('/notifications', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Thiếu username' });
  let notifs = loadNotifications();
  notifs = notifs.filter(n => n.to === username);
  res.json({ notifications: notifs });
});
// Trả về user object đầy đủ
app.get('/user', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Missing username' });
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:G`,
    });
    const rows = result.data.values || [];
    const row = rows.find(r => r[0] === username);
    const avatarPath = path.join(AVATAR_DIR, `${username}.png`);
    let avatarUrl = '';
    if (existsSync(avatarPath)) {
      avatarUrl = `/avatars/${username}.png`;
    }
    let notifications = [];
    try {
      notifications = loadNotifications().filter(n => n.to === username);
    } catch {}
    const usersExtra = loadUsersExtra();
    const extra = usersExtra[username] || {};
    res.json({
      user: {
        id: username,
        Avatar: avatarUrl,
        fullName: row && row[5] ? row[5] : '',
        email: row && row[2] ? row[2] : '',
        username: row ? row[0] : username,
        password: '',
        phone: row && row[3] ? row[3] : '',
        region: row && row[6] ? row[6] : '',
        rating: extra.rating || 0,
        point: extra.point || 0,
        posts: extra.posts || [],
        transactions: extra.transactions || [],
        notifications: notifications || []
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy user', error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('User Service is running');
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
}); 