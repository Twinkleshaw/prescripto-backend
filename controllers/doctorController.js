import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import mongoose from "mongoose";
import { Parser } from "json2csv";

export const getDoctorDashboard = async (req, res) => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.user.id);

    const today = new Date().toISOString().split("T")[0];

    const [
      todayAppointments,
      totalPatients,
      onlinePayments,
      offlinePayments,
      todayEarnings,
      latestBookings,
    ] = await Promise.all([
      // Today's appointments
      Appointment.countDocuments({
        doctorId,
        date: today,
      }),

      // Unique patients
      Appointment.distinct("patientId", {
        doctorId,
      }),

      // Online earnings
      Appointment.aggregate([
        {
          $match: {
            doctorId,
            paymentType: "online",
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),

      // Offline earnings
      Appointment.aggregate([
        {
          $match: {
            doctorId,
            paymentType: "pay_at_clinic",
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),

      // Today's earnings
      Appointment.aggregate([
        {
          $match: {
            doctorId,
            date: today,
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),

      // Latest bookings
      Appointment.find({ doctorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("patientId", "name"),
    ]);

    res.json({
      success: true,

      todayAppointments,

      todayEarnings: todayEarnings[0]?.total || 0,

      totalPatients: totalPatients.length,

      earnings: {
        online: onlinePayments[0]?.total || 0,
        offline: offlinePayments[0]?.total || 0,
      },

      totalEarnings:
        (onlinePayments[0]?.total || 0) + (offlinePayments[0]?.total || 0),

      latestBookings,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

export const getAllSearchDoctors = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);

    const { speciality = "", city = "" } = req.query;

    const andConditions = [];

    // 🩺 Filter by speciality
    if (speciality.trim()) {
      andConditions.push({
        speciality: { $regex: speciality.trim(), $options: "i" },
      });
    }

    // 📍 Filter by city
    if (city.trim()) {
      andConditions.push({
        "address.city": { $regex: city.trim(), $options: "i" },
      });
    }

    // 👤 Public/patient access: only active + available doctors
    if (!req.user || req.user.role === "patient") {
      andConditions.push({ isActive: true, availabilityStatus: true });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const [doctors, total] = await Promise.all([
      Doctor.find(query)
        .select("name image speciality experience address.city")
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Doctor.countDocuments(query),
    ]);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      doctors,
    });
  } catch (error) {
    console.error("getAllDoctors error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllDoctors = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const skip = (page - 1) * limit;

    const [doctors, total, revenueResult] = await Promise.all([
      Doctor.aggregate([
        {
          $lookup: {
            from: "appointments",
            localField: "_id",
            foreignField: "doctorId",
            as: "appointments",
          },
        },

        {
          $addFields: {
            totalAppointments: {
              $size: "$appointments",
            },

            totalRevenue: {
              $sum: "$appointments.amount",
            },
          },
        },

        {
          $project: {
            appointments: 0,
            password: 0,
          },
        },

        {
          $sort: { createdAt: -1 },
        },

        {
          $skip: skip,
        },

        {
          $limit: limit,
        },
      ]),

      Doctor.countDocuments(),

      Appointment.aggregate([
        {
          $group: {
            _id: null,

            totalRevenue: {
              $sum: "$amount",
            },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    res.json({
      success: true,
      total,
      totalRevenue,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      doctors,
    });
  } catch (error) {
    console.error("getAllDoctors error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

export const updateDoctor = async (req, res) => {
  try {
    const role = req.user.role;

    // 🔒 Doctor can only update themselves
    const doctorId = role === "admin" ? req.params.id : req.user.id;

    if (role === "doctor" && req.params.id && req.params.id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    let allowedFields = [];

    // 👨‍💼 Admin fields
    if (role === "admin") {
      allowedFields = [
        "speciality",
        "nameBengali",
        "specialityBengali",
        "degree",
        "experience",
        "description",
        "fees",
        "availableDays",
        "availabilityStatus",
        "isActive",
        "address",
        "googleMapLink",
        "image",
        "startTime",
        "endTime",
        "slotDuration",
      ];
    }

    // 👨‍⚕️ Doctor fields
    if (role === "doctor") {
      allowedFields = [
        "address",
        "description",
        "fees",
        "availableDays",
        "googleMapLink",
        "availabilityStatus",
        "startTime",
        "endTime",
        "slotDuration",
      ];
    }

    // 🔒 Filter only allowed fields
    const updates = {};
    for (let key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(doctorId, updates, {
      new: true,
    }).select("-password");

    res.json({
      message: "Doctor updated successfully",
      doctor: updatedDoctor,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findById(id).select("-password");

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    // 👤 Patient should only see active + available doctors
    if (!doctor.isActive || !doctor.availabilityStatus) {
      return res.status(404).json({
        message: "Doctor not available",
      });
    }

    res.json({
      doctor,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
};

export const deleteDoctor = async (req, res) => {
  try {
    const doctorId = req.params.id;

    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    // 🔥 Optional: check if doctor has appointments
    const hasAppointments = await Appointment.findOne({ doctorId });

    if (hasAppointments) {
      return res.status(400).json({
        message: "Doctor has appointments, cannot delete",
      });
    }

    await Doctor.findByIdAndDelete(doctorId);

    res.json({
      message: "Doctor deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

export const exportDoctorsCSV = async (req, res) => {
  try {
    const doctors = await Doctor.aggregate([
      {
        $lookup: {
          from: "appointments",
          localField: "_id",
          foreignField: "doctorId",
          as: "appointments",
        },
      },

      {
        $addFields: {
          totalAppointments: {
            $size: "$appointments",
          },

          totalRevenue: {
            $sum: "$appointments.amount",
          },
        },
      },

      {
        $project: {
          password: 0,
          appointments: 0,
        },
      },
    ]);

    // fields for CSV
    const fields = [
      "name",
      "email",
      "phone",
      "speciality",
      "experience",
      "fees",
      "totalAppointments",
      "totalRevenue",
      "createdAt",
    ];

    const json2csv = new Parser({ fields });

    const csv = json2csv.parse(doctors);

    res.header("Content-Type", "text/csv");

    res.attachment("doctors-report.csv");

    return res.send(csv);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "CSV export failed",
    });
  }
};
