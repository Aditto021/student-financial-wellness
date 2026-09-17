/**
 * middleware/upload.js
 * -----------------------------------------------------------------
 * Multer configuration for handling profile picture uploads.
 *
 * Files are kept in memory (never written to local disk) and the
 * controller encodes them straight into the database as a base64
 * data URI. This matters specifically because the app runs on hosts
 * with an ephemeral filesystem (e.g. Render) — anything written to
 * disk is wiped on every redeploy/restart, silently breaking any
 * previously uploaded picture. Storing the bytes in the database
 * keeps them exactly as durable as the rest of the app's data.
 *
 * Only image files are accepted, and a 2MB size limit is enforced.
 * -----------------------------------------------------------------
 */

const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

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
