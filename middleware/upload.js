/**
 * middleware/upload.js
 * -----------------------------------------------------------------
 * Multer configuration for handling profile picture uploads.
 * Files are stored on disk under /uploads/profile with a unique,
 * collision-safe filename. Only image files are accepted, and a
 * 2MB size limit is enforced.
 * -----------------------------------------------------------------
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'profile');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${req.session.userId}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueSuffix);
  }
});

function fileFilter(req, file, cb) {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype);
  if (extOk && mimeOk) {
    return cb(null, true);
  }
  cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed.'));
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter
});

module.exports = upload;
