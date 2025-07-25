import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import multer from 'multer';
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import morgan from 'morgan';
import winston from 'winston';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn file users_extra.json
const USERS_EXTRA_PATH = path.join(__dirname, 'users_extra.json');

// Hàm load dữ liệu extra
function loadUsersExtra() {
  try {
    return JSON.parse(readFileSync(USERS_EXTRA_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function loadUsers() {
  try {
    return JSON.parse(readFileSync('users.json', 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  writeFileSync('users.json', JSON.stringify(users, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Thông tin Google Sheets
const SHEET_ID = '1bZ67uc2R9rpYkYE6BhcqjjDbZGE7wOzuhS3RB9eEgCU';
const SHEET_NAME = 'users';

// Đường dẫn credentials.json (cùng thư mục với index.js)
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Xác thực Google API bằng service account credentials
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8')),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

// Đăng ký
app.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username phải >= 3 ký tự'),
  body('password').isLength({ min: 6 }).withMessage('Password phải >= 6 ký tự'),
  body('email').optional().isEmail().withMessage('Email không hợp lệ')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { username, password, email, role } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Thiếu thông tin' });
  let users = loadUsers();
  if (users.find(u => u.username === username)) {
    return res.status(409).json({ message: 'Username đã tồn tại' });
  }
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);
  users.push({ username, password: hashedPassword, email, role: role || 'user' });
  saveUsers(users);
  // Ghi vào Google Sheet
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:B`,
      valueInputOption: 'RAW',
      requestBody: { values: [[username, password]] },
    });
  } catch (err) {
    // Nếu lỗi Google Sheet, vẫn trả về thành công nhưng log lỗi
    logger.error('Google Sheets Error:', err);
  }
  res.json({ message: 'Đăng ký thành công!' });
});

// Đăng nhập
app.post('/login', [
  body('username').notEmpty().withMessage('Thiếu username'),
  body('password').notEmpty().withMessage('Thiếu password')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Thiếu thông tin' });
    let users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
    
    // Tạo token
    const token = jwt.sign({ username: user.username, role: user.role || 'user' }, SECRET_KEY, { expiresIn: '1d' });
    
    // Lấy thông tin chi tiết từ Google Sheets
    let userInfo = {
      username: user.username,
      email: user.email || '',
      role: user.role || 'user'
    };
    
    try {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A:G`,
      });
      const rows = result.data.values || [];
      const row = rows.find(r => r[0] === username);
      if (row) {
        userInfo = {
          ...userInfo,
          email: row[2] || user.email || '',
          phone: row[3] || '',
          dob: row[4] || '',
          fullName: row[5] || '',
          region: row[6] || ''
        };
      }
    } catch (sheetError) {
      logger.error('Google Sheets Error:', sheetError);
    }
    
    // Kiểm tra avatar
    const avatarPath = path.join(AVATAR_DIR, `${username}.png`);
    let avatarUrl = '';
    if (existsSync(avatarPath)) {
      avatarUrl = `http://${HOST}:${PORT}/avatars/${username}.png`;
    }
    
    // Lấy dữ liệu extra
    const usersExtra = loadUsersExtra();
    const extra = usersExtra[username] || {};
    
    // Lấy notifications
    let notifications = [];
    try {
      notifications = loadNotifications().filter(n => n.to === username);
    } catch {}
    
    // Trả về thông tin user đầy đủ
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      user: {
        id: username,
        username: userInfo.username,
        email: userInfo.email,
        phone: userInfo.phone || '',
        fullName: userInfo.fullName || '',
        region: userInfo.region || '',
        role: userInfo.role,
        avatar: avatarUrl,
        rating: extra.rating || 0,
        point: extra.point || 0,
        posts: extra.posts || [],
        transactions: extra.transactions || [],
        notifications: notifications
      },
      token: token
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

// Reset mật khẩu (cho phép đặt mật khẩu mới)
app.post('/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ message: 'Missing username or new password' });
  }
  try {
    // Lấy toàn bộ dữ liệu
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:B`,
    });
    const rows = result.data.values || [];
    const idx = rows.findIndex(row => row[0] === username);
    if (idx === -1) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }
    // Cập nhật lại dòng mật khẩu
    rows[idx][1] = newPassword;
    // Ghi lại toàn bộ sheet (ghi đè)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:B${rows.length}`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
    return res.json({ message: 'Đặt lại mật khẩu thành công!' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ message: 'Lỗi reset mật khẩu', error: err.message });
  }
});

const AVATAR_DIR = path.join(__dirname, 'avatars');
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

// API upload avatar
app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file || !req.body.username) {
    return res.status(400).json({ message: 'Thiếu file hoặc username' });
  }
  const username = req.body.username;
  const destPath = path.join(AVATAR_DIR, `${username}.png`);
  try {
    // Chuyển file sang PNG nếu không phải PNG
    await sharp(req.file.path).png().toFile(destPath);
    // Xóa file gốc nếu khác tên
    if (req.file.path !== destPath) {
      import('fs').then(fs => fs.unlinkSync(req.file.path));
    }
    const url = `/avatars/${username}.png`;
    res.json({ message: 'Upload thành công', url });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xử lý ảnh', error: err.message });
  }
});

// API lấy profile
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
    // Kiểm tra file avatar
    const avatarPath = path.join(AVATAR_DIR, `${username}.png`);
    let avatarUrl = '';
    if (existsSync(avatarPath)) {
      avatarUrl = `http://${HOST}:${PORT}/avatars/${username}.png`;
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

// API cập nhật profile
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
    // Cập nhật các trường
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

// Phục vụ file tĩnh avatar
app.use('/avatars', express.static(AVATAR_DIR));

const PARTNER_REQUESTS_PATH = path.join(__dirname, 'partner_requests.json');
function loadPartnerRequests() {
  try {
    return JSON.parse(readFileSync(PARTNER_REQUESTS_PATH, 'utf8'));
  } catch {
    return [];
  }
}
function savePartnerRequests(requests) {
  writeFileSync(PARTNER_REQUESTS_PATH, JSON.stringify(requests, null, 2), 'utf8');
}

// Gửi yêu cầu kết nối
app.post('/partner-request', [
  body('from').notEmpty(),
  body('to').notEmpty()
], authMiddleware, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ message: 'Thiếu thông tin' });
  let requests = loadPartnerRequests();
  // Không gửi trùng
  if (requests.some(r => r.from === from && r.to === to && r.status === 'pending')) {
    return res.json({ message: 'Đã gửi yêu cầu trước đó' });
  }
  requests.push({ from, to, status: 'pending', createdAt: Date.now() });
  savePartnerRequests(requests);
  res.json({ message: 'Đã gửi yêu cầu kết nối' });
});

// Apply vào post - Gửi yêu cầu kết nối với thông tin post
app.post('/partner-requests', [
  body('from').notEmpty(),
  body('to').notEmpty(),
  body('postId').notEmpty(),
  body('message').optional()
], authMiddleware, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { from, to, postId, message } = req.body;
  if (!from || !to || !postId) return res.status(400).json({ message: 'Thiếu thông tin' });
  
  let requests = loadPartnerRequests();
  // Không gửi trùng
  if (requests.some(r => r.from === from && r.to === to && r.status === 'pending')) {
    return res.json({ message: 'Đã gửi yêu cầu trước đó' });
  }
  
  // Tạo request với thông tin post
  const request = {
    from,
    to,
    postId,
    message: message || '',
    status: 'pending',
    createdAt: Date.now()
  };
  
  requests.push(request);
  savePartnerRequests(requests);
  
  // Tạo notification cho người nhận
  let notifs = loadNotifications();
  notifs.push({
    to: to,
    type: 'partner-request',
    from: from,
    postId: postId,
    message: message || '',
    createdAt: Date.now()
  });
  saveNotifications(notifs);
  
  res.json({ 
    message: 'Đã gửi yêu cầu kết nối',
    request: request
  });
});

// Lấy danh sách yêu cầu kết nối gửi đến user (cho notification)
app.get('/partner-requests', async (req, res) => {
  const { username, status } = req.query;
  if (!username) return res.status(400).json({ message: 'Thiếu username' });
  
  let requests = loadPartnerRequests();
  
  // Lọc theo status nếu có
  if (status) {
    requests = requests.filter(r => r.status === status);
  }
  
  // Lấy các yêu cầu gửi đến user
  let userRequests = requests.filter(r => r.to === username);
  
  // Lấy avatar và thông tin post cho từng yêu cầu
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:E`,
  });
  const rows = result.data.values || [];
  
  // Load posts để lấy thông tin post
  const posts = loadPosts();
  
  userRequests = userRequests.map(r => {
    const row = rows.find(row => row[0] === r.from);
    let avatar = '';
    if (row) {
      const avatarPath = path.join(AVATAR_DIR, `${r.from}.png`);
      if (existsSync(avatarPath)) {
        avatar = `http://${HOST}:${PORT}/avatars/${r.from}.png`;
      }
    }
    
    // Lấy thông tin post nếu có postId
    let postInfo = null;
    if (r.postId) {
      postInfo = posts.find(p => p.id === r.postId);
    }
    
    return { 
      ...r, 
      avatar,
      post: postInfo
    };
  });
  
  res.json({ 
    requests: userRequests,
    total: userRequests.length,
    pending: userRequests.filter(r => r.status === 'pending').length
  });
});

// Lấy danh sách yêu cầu đã gửi (để user xem trạng thái)
app.get('/partner-requests/sent', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Thiếu username' });
  
  let requests = loadPartnerRequests();
  let sentRequests = requests.filter(r => r.from === username);
  
  // Lấy avatar cho từng người nhận
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:E`,
  });
  const rows = result.data.values || [];
  
  // Load posts để lấy thông tin post
  const posts = loadPosts();
  
  sentRequests = sentRequests.map(r => {
    const row = rows.find(row => row[0] === r.to);
    let avatar = '';
    if (row) {
      const avatarPath = path.join(AVATAR_DIR, `${r.to}.png`);
      if (existsSync(avatarPath)) {
        avatar = `http://${HOST}:${PORT}/avatars/${r.to}.png`;
      }
    }
    
    // Lấy thông tin post nếu có postId
    let postInfo = null;
    if (r.postId) {
      postInfo = posts.find(p => p.id === r.postId);
    }
    
    return { 
      ...r, 
      avatar,
      post: postInfo
    };
  });
  
  res.json({ 
    requests: sentRequests,
    total: sentRequests.length
  });
});

// Đồng ý hoặc từ chối kết nối
app.post('/partner-request/respond', (req, res) => {
  const { from, to, accept } = req.body;
  if (!from || !to || typeof accept !== 'boolean') return res.status(400).json({ message: 'Thiếu thông tin' });
  let requests = loadPartnerRequests();
  const idx = requests.findIndex(r => r.from === from && r.to === to && r.status === 'pending');
  if (idx === -1) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' });
  requests[idx].status = accept ? 'accepted' : 'rejected';
  savePartnerRequests(requests);
  // Gửi notification cho người gửi
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

// API lấy danh sách kết nối đã accepted
app.get('/partners', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Thiếu username' });
  let requests = loadPartnerRequests();
  // Lấy các kết nối đã accepted (gửi hoặc nhận)
  let partners = requests.filter(r =>
    (r.from === username || r.to === username) && r.status === 'accepted'
  );
  // Lấy thông tin partner
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
        avatar = `http://${HOST}:${PORT}/avatars/${partnerUsername}.png`;
      }
    }
    return {
      username: partnerUsername,
      avatar
    };
  });
  res.json({ partners: partnerList });
});

// API xóa kết nối
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

const NOTIFICATIONS_PATH = path.join(__dirname, 'notifications.json');
function loadNotifications() {
  try {
    return JSON.parse(readFileSync(NOTIFICATIONS_PATH, 'utf8'));
  } catch {
    return [];
  }
}
function saveNotifications(notifs) {
  writeFileSync(NOTIFICATIONS_PATH, JSON.stringify(notifs, null, 2), 'utf8');
}

// Lấy danh sách notification của user
app.get('/notifications', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Thiếu username' });
  let notifs = loadNotifications();
  notifs = notifs.filter(n => n.to === username);
  res.json({ notifications: notifs });
});

// API trả về thông tin user đầy đủ theo schema mẫu
app.get('/user', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Missing username' });
  try {
    // Lấy thông tin cơ bản từ Google Sheets (A-G)
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:G`,
    });
    const rows = result.data.values || [];
    const row = rows.find(r => r[0] === username);
    // Kiểm tra file avatar
    const avatarPath = path.join(AVATAR_DIR, `${username}.png`);
    let avatarUrl = '';
    if (existsSync(avatarPath)) {
      avatarUrl = `http://${HOST}:${PORT}/avatars/${username}.png`;
    }
    // Lấy notifications
    let notifications = [];
    try {
      notifications = loadNotifications().filter(n => n.to === username);
    } catch {}
    // Lấy dữ liệu extra từ file users_extra.json
    const usersExtra = loadUsersExtra();
    const extra = usersExtra[username] || {};
    // Trả về user object theo schema mẫu
    res.json({
      user: {
        id: username, // dùng username làm id (nếu có UUID thì thay)
        Avatar: avatarUrl,
        fullName: row && row[5] ? row[5] : '', // cột F (index 5)
        email: row && row[2] ? row[2] : '',
        username: row ? row[0] : username,
        password: '', // không trả về password
        phone: row && row[3] ? row[3] : '',
        region: row && row[6] ? row[6] : '', // cột G (index 6)
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

const MESSAGES_PATH = path.join(__dirname, 'messages.json');
function loadMessages() {
  try {
    return JSON.parse(readFileSync(MESSAGES_PATH, 'utf8'));
  } catch {
    return [];
  }
}
function saveMessages(msgs) {
  writeFileSync(MESSAGES_PATH, JSON.stringify(msgs, null, 2), 'utf8');
}

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

// Tạo thư mục lưu ảnh chat nếu chưa có
const CHAT_IMG_DIR = path.join(__dirname, 'chat_images');
if (!existsSync(CHAT_IMG_DIR)) mkdirSync(CHAT_IMG_DIR);

const chatImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CHAT_IMG_DIR);
  },
  filename: (req, file, cb) => {
    const username = req.body.from || 'unknown';
    const ext = file.originalname.split('.').pop();
    cb(null, `${username}_${Date.now()}.${ext}`);
  }
});
const uploadChatImg = multer({ storage: chatImgStorage });

// API upload ảnh chat
app.post('/upload-chat-image', uploadChatImg.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Thiếu file ảnh' });
  const url = `http://${HOST}:${PORT}/chat_images/${req.file.filename}`;
  res.json({ message: 'Upload thành công', url });
});

// Cho phép truy cập tĩnh thư mục chat_images
app.use('/chat_images', express.static(CHAT_IMG_DIR));

// Đường dẫn file posts.json
const POSTS_PATH = path.join(__dirname, 'posts.json');

function loadPosts() {
  try {
    return JSON.parse(readFileSync(POSTS_PATH, 'utf8'));
  } catch {
    return [];
  }
}
function savePosts(posts) {
  writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), 'utf8');
}

// API tạo bài đăng mới
app.post('/posts', (req, res) => {
  const post = req.body;
  if (!post || !post.title || !post.author) {
    return res.status(400).json({ message: 'Thiếu thông tin bài đăng' });
  }
  // Xử lý proofs: nếu là mảng tên file thì chuyển sang mảng object {file, link}
  if (Array.isArray(post.proofs)) {
    post.proofs = post.proofs.map(p => {
      if (typeof p === 'string') {
        return {
          file: `http://localhost:4000/post_images/${p}`,
          link: `https://github.com/example/${p}`
        };
      }
      return p;
    });
  }
  // Gán id, createdAt nếu chưa có
  post.id = post.id || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  post.createdAt = post.createdAt || Date.now();
  const posts = loadPosts();
  posts.unshift(post); // Thêm lên đầu
  savePosts(posts);
  res.json({ message: 'Đã tạo bài đăng', post });
});

// API lấy danh sách bài đăng
app.get('/posts', (req, res) => {
  const posts = loadPosts();
  // Đảm bảo proofs luôn là mảng object {file, link}
  const postsOut = posts.map(post => ({
    ...post,
    proofs: Array.isArray(post.proofs) ? post.proofs.map(p => {
      if (typeof p === 'string') {
        return {
          file: `http://localhost:4000/post_images/${p}`,
          link: `https://github.com/example/${p}`
        };
      }
      return p;
    }) : []
  }));
  res.json({ posts: postsOut });
});

// API lấy chi tiết bài đăng theo id
app.get('/posts/:id', (req, res) => {
  const { id } = req.params;
  const posts = loadPosts();
  const post = posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ message: 'Không tìm thấy bài đăng' });
  // Đảm bảo proofs luôn là mảng object {file, link}
  const postOut = {
    ...post,
    proofs: Array.isArray(post.proofs) ? post.proofs.map(p => {
      if (typeof p === 'string') {
        return {
          file: `http://localhost:4000/post_images/${p}`,
          link: `https://github.com/example/${p}`
        };
      }
      return p;
    }) : []
  };
  res.json({ post: postOut });
});

// API xóa bài đăng
app.delete('/posts/:id', (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'Thiếu id' });
  let posts = loadPosts();
  const before = posts.length;
  posts = posts.filter(p => p.id !== id);
  if (posts.length === before) return res.status(404).json({ message: 'Không tìm thấy bài đăng' });
  savePosts(posts);
  res.json({ message: 'Đã xóa bài đăng' });
});

// Tạo thư mục lưu ảnh bài đăng nếu chưa có
const POST_IMG_DIR = path.join(__dirname, 'post_images');
if (!existsSync(POST_IMG_DIR)) mkdirSync(POST_IMG_DIR);

const postImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, POST_IMG_DIR);
  },
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`);
  }
});
const uploadPostImg = multer({ storage: postImgStorage });

// API upload ảnh bài đăng
app.post('/upload-post-image', uploadPostImg.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Thiếu file ảnh' });
  res.json({ message: 'Upload thành công', filename: req.file.filename });
});

// Cho phép truy cập tĩnh thư mục post_images
app.use('/post_images', express.static(POST_IMG_DIR));

app.get('/', (req, res) => {
  res.send('<h2>API User Account Login/Register</h2><p>Sử dụng POST /register và POST /login với JSON body.<br>Ví dụ:<br><code>{ "username": "yourname", "password": "yourpass" }</code></p>');
});

// ==== CẤU HÌNH HOST VÀ PORT DỄ TÙY CHỈNH ====
const HOST = process.env.HOST || 'localhost'; // hoặc '192.168.2.65' hoặc '0.0.0.0'
const PORT = process.env.PORT || 4000;

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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

export default app; 