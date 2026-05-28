import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import { getFileUrl } from "../utils/fileHelper.js";

export const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;

    const { name, phone } = req.body;

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    // ✅ update normal fields
    admin.name = name || admin.name;

    admin.phone = phone || admin.phone;

    // ✅ image upload handling
    if (req.file) {
      admin.profileImage = getFileUrl(
        req,
        "uploads/profile",
        req.file.filename,
      );
    }

    await admin.save();

    return res.json({
      success: true,

      message: "Profile updated successfully",

      admin: {
        _id: admin._id,

        name: admin.name,

        email: admin.email,

        phone: admin.phone,

        profileImage: admin.profileImage,
      },
    });
  } catch (error) {
    console.error("UPDATE ADMIN PROFILE ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

export const changeAdminPassword = async (req, res) => {
  try {
    const adminId = req.user.id;

    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Old password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    admin.password = hashedPassword;

    await admin.save();

    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};
