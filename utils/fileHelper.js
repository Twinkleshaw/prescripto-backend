export const getFileUrl = (req, folder, filename) => {
  const baseUrl =
    process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/${folder}/${filename}`;
};

export const getFilePath = (folder, filename) => {
  return `${folder}/${filename}`;
  // saves: "uploads/profile/1779951885690-file.png"
};
