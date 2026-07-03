import multer from "multer";

// No more disk — buffer in memory, Cloudinary receives it
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
});
