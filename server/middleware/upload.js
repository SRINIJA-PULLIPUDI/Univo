const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadRoot = path.join(__dirname, "..", "uploads");
for (const sub of ["circulars", "resources", "proofs", "buzz", "forum", "avatars"]) {
  const dir = path.join(uploadRoot, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function storageFor(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(uploadRoot, subfolder)),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  });
}

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

module.exports = {
  uploadRollNumbers: multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  uploadCircular: multer({ storage: storageFor("circulars"), limits: { fileSize: MAX_SIZE } }),
  uploadResource: multer({ storage: storageFor("resources"), limits: { fileSize: MAX_SIZE } }),
  uploadProof: multer({ storage: storageFor("proofs"), limits: { fileSize: MAX_SIZE } }),
  uploadBuzzImage: multer({ storage: storageFor("buzz"), limits: { fileSize: MAX_SIZE } }),
  uploadForumImage: multer({ storage: storageFor("forum"), limits: { fileSize: MAX_SIZE } }),
  uploadAvatar: multer({ storage: storageFor("avatars"), limits: { fileSize: MAX_SIZE } }),
};
