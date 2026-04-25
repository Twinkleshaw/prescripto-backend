import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "uploads/misc";

    if (file.fieldname === "profileImage") {
      folder = "uploads/profile";
    } else if (file.fieldname === "document") {
      folder = "uploads/documents";
    }
    // ✅ create ANY folder dynamically
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    cb(null, folder);
  },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + Math.random() + path.extname(file.originalname);
        cb(null, uniqueName);
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
});