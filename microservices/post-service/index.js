import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POST_IMG_DIR = path.join(__dirname, 'post_images');
const DATA_DIR = path.join(__dirname, 'data');
const POSTS_PATH = path.join(DATA_DIR, 'posts.json');

if (!existsSync(POST_IMG_DIR)) mkdirSync(POST_IMG_DIR);

const postImgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, POST_IMG_DIR),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`);
  }
});
const uploadPostImg = multer({ storage: postImgStorage });

function loadPosts() {
  try { return JSON.parse(readFileSync(POSTS_PATH, 'utf8')); } catch { return []; }
}
function savePosts(posts) {
  writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/post_images', express.static(POST_IMG_DIR));

// API tạo bài đăng mới
app.post('/posts', (req, res) => {
  const post = req.body;
  if (!post || !post.title || !post.author) {
    return res.status(400).json({ message: 'Thiếu thông tin bài đăng' });
  }
  post.id = post.id || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  post.createdAt = post.createdAt || Date.now();
  const posts = loadPosts();
  posts.unshift(post);
  savePosts(posts);
  res.json({ message: 'Đã tạo bài đăng', post });
});
// API lấy danh sách bài đăng
app.get('/posts', (req, res) => {
  const posts = loadPosts();
  res.json({ posts });
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
// API upload ảnh bài đăng
app.post('/upload-post-image', uploadPostImg.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Thiếu file ảnh' });
  res.json({ message: 'Upload thành công', filename: req.file.filename });
});

app.get('/', (req, res) => {
  res.send('Post Service is running');
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`Post Service running on port ${PORT}`);
}); 