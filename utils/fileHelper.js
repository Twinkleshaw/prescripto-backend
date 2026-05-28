export const getFileUrl = (req, folder, filename) => {
  const baseUrl =
    process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/${folder}/${filename}`;
};
