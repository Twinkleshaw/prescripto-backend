import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import { getFilePath } from "../utils/fileHelper.js";
import Appointment from "../models/Appointment.js";
import { Parser } from "json2csv";

export const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { name, phone } = req.body;

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // ✅ update normal fields
    if (name) admin.name = name;
    if (phone) admin.phone = phone;

    // ✅ image upload — store relative path only, NOT full URL
    if (req.file) {
      admin.profileImage = `uploads/profile/${req.file.filename}`;
    }

    await admin.save();
    console.log(admin.profileImage);
    return res.json({
      success: true,
      message: "Profile updated successfully",
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        profileImage: admin.profileImage,
        updatedAt: admin.updatedAt,
      },
    });
    console.log(admin.profileImage);
  } catch (error) {
    console.error("UPDATE ADMIN PROFILE ERROR:", error);
    return res.status(500).json({ message: "Server error" });
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

export const getPayments = async (req, res) => {
  try {
    const { paymentStatus, paymentType, search } = req.query;

    const filter = {};

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentType) {
      filter.paymentType = paymentType;
    }

    if (search) {
      filter.patientName = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const [paymentStats, doctorPayments, payments] = await Promise.all([
      // Overall Stats
      Appointment.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: null,

            totalBilling: {
              $sum: "$amount",
            },

            totalCollected: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", "paid"],
                  },
                  "$amount",
                  0,
                ],
              },
            },

            totalPendingAmount: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", "pending"],
                  },
                  "$amount",
                  0,
                ],
              },
            },

            onlineCollected: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ["$paymentStatus", "paid"],
                      },
                      {
                        $eq: ["$paymentType", "online"],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },

            offlineCollected: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ["$paymentStatus", "paid"],
                      },
                      {
                        $eq: ["$paymentType", "pay_at_clinic"],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
      ]),

      // Doctor-wise Collection
      Appointment.aggregate([
        {
          $lookup: {
            from: "doctors",
            localField: "doctorId",
            foreignField: "_id",
            as: "doctor",
          },
        },
        {
          $unwind: "$doctor",
        },
        {
          $group: {
            _id: "$doctorId",

            doctorName: {
              $first: "$doctor.name",
            },

            totalCollected: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", "paid"],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $sort: {
            totalCollected: -1,
          },
        },
      ]),

      // Transaction List
      Appointment.find(filter)
        .populate("doctorId", "name speciality")
        .sort({ createdAt: -1 }),
    ]);

    return res.json({
      success: true,

      totalBilling: paymentStats[0]?.totalBilling || 0,

      totalCollected: paymentStats[0]?.totalCollected || 0,

      totalPendingAmount: paymentStats[0]?.totalPendingAmount || 0,

      onlineCollected: paymentStats[0]?.onlineCollected || 0,

      offlineCollected: paymentStats[0]?.offlineCollected || 0,

      doctorPayments,

      payments,
    });
  } catch (error) {
    console.error("GET PAYMENTS ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

export const exportPaymentsCSV = async (req, res) => {
  try {
    const payments = await Appointment.find({})
      .populate("doctorId", "name speciality")
      .sort({ createdAt: -1 });

    const data = payments.map((payment) => ({
      Patient: payment.patientName,
      Doctor: payment.doctorId?.name || "-",
      Speciality: payment.doctorId?.speciality || "-",
      AppointmentDate: payment.date,
      PaymentType: payment.paymentType,
      PaymentStatus: payment.paymentStatus,
      Amount: payment.amount,
      AppointmentStatus: payment.status,
      CreatedAt: payment.createdAt,
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment(`payments-${Date.now()}.csv`);

    return res.send(csv);
  } catch (error) {
    console.error("EXPORT PAYMENTS ERROR:", error);

    return res.status(500).json({
      message: "Failed to export payments",
    });
  }
};
