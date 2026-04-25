export const getFileUrl = (req, folder, filename) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    return `${baseUrl}/${folder}/${filename}`;
};