import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import mongoose from "mongoose";
import { Parser } from "json2csv";
import { uploadToCloudinary } from "../utils/cloudinary.js";

export const getDoctorDashboard = async (req, res) => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.user.id);

    const today = new Date().toISOString().split("T")[0];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const now = new Date();

    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setHours(23, 59, 59, 999);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    // =========================

    const [
      totalEarningsResult,

      onlinePaymentsResult,

      offlinePaymentsResult,

      weeklyAppointments,

      todayCompletedAppointments,

      pendingAppointments,

      newPatientsToday,

      latestBookings,

      weeklyAnalyticsRaw,
    ] = await Promise.all([
      Appointment.aggregate([
        {
          $match: {
            doctorId,
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]),
      Appointment.aggregate([
        {
          $match: {
            doctorId,
            paymentStatus: "paid",
            paymentType: "online",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]),
      Appointment.aggregate([
        {
          $match: {
            doctorId,
            paymentStatus: "paid",
            paymentType: "pay_at_clinic",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]),

      Appointment.countDocuments({
        doctorId,
        createdAt: {
          $gte: startOfWeek,
          $lte: endOfWeek,
        },
      }),

      Appointment.countDocuments({
        doctorId,
        date: today,
        status: "completed",
      }),

      Appointment.countDocuments({
        doctorId,
        status: "booked",
      }),

      Appointment.distinct("patientId", {
        doctorId,
        createdAt: {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      }),

      Appointment.find({ doctorId })
        .populate("patientId", "name age")
        .sort({ createdAt: -1 })
        .limit(5),

      Appointment.aggregate([
        {
          $match: {
            doctorId,
            createdAt: {
              $gte: startOfWeek,
              $lte: endOfWeek,
            },
          },
        },
        {
          $group: {
            _id: {
              $dayOfWeek: "$createdAt",
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    const analyticsMap = {
      1: "Sun",
      2: "Mon",
      3: "Tue",
      4: "Wed",
      5: "Thu",
      6: "Fri",
      7: "Sat",
    };

    const weeklyAnalytics = [
      { day: "Mon", count: 0 },
      { day: "Tue", count: 0 },
      { day: "Wed", count: 0 },
      { day: "Thu", count: 0 },
      { day: "Fri", count: 0 },
      { day: "Sat", count: 0 },
      { day: "Sun", count: 0 },
    ];

    weeklyAnalyticsRaw.forEach((item) => {
      const day = analyticsMap[item._id];

      const index = weeklyAnalytics.findIndex((d) => d.day === day);

      if (index !== -1) {
        weeklyAnalytics[index].count = item.count;
      }
    });

    return res.json({
      success: true,

      totalEarnings: totalEarningsResult[0]?.total || 0,
      onlinePayments: onlinePaymentsResult[0]?.total || 0,

      offlinePayments: offlinePaymentsResult[0]?.total || 0,

      weeklyAppointments,

      todayCompletedAppointments,

      pendingAppointments,

      newPatientsToday: newPatientsToday.length,

      latestBookings,

      weeklyAnalytics,
    });
  } catch (error) {
    console.error("DOCTOR DASHBOARD ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

export const getAllSearchDoctors = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);

    const { speciality = "", city = "", name = "" } = req.query;

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

    if (name.trim()) {
      andConditions.push({
        name: { $regex: name.trim(), $options: "i" },
      });
    }

    // 👤 Public/patient access: only active + available doctors
    if (!req.user || req.user.role === "patient") {
      andConditions.push({ isActive: true, availabilityStatus: true });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const [doctors, total] = await Promise.all([
      Doctor.find(query)
        .select("name image speciality experience address")
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
    const search = req.query.search?.trim() || "";

    const matchStage = search
      ? {
          name: {
            $regex: search,
            $options: "i",
          },
        }
      : {};

    const [doctors, totalDoctors, filteredTotal, activeDoctors, revenueResult] =
      await Promise.all([
        Doctor.aggregate([
          {
            $match: matchStage,
          },
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
            $sort: {
              createdAt: -1,
            },
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
        ]),

        // Total doctors (always)
        Doctor.countDocuments(),

        // Total matching search (for pagination)
        Doctor.countDocuments(matchStage),

        // Total active doctors (always)
        Doctor.countDocuments({
          isActive: true,
          availabilityStatus: true,
        }),

        // Overall revenue
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

    return res.json({
      success: true,

      doctors,

      // Summary Cards
      totalDoctors,
      activeDoctors,
      totalRevenue,

      // Pagination
      filteredTotal,
      page,
      limit,
      totalPages: Math.ceil(filteredTotal / limit),
    });
  } catch (error) {
    console.error("getAllDoctors error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const updateDoctor = async (req, res) => {
  try {
    const role = req.user.role;
    const doctorId = role === "admin" ? req.params.id : req.user.id;

    if (role === "doctor" && req.params.id && req.params.id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    let allowedFields = [];

    if (role === "admin") {
      allowedFields = [
        "speciality",
        "nameBengali",
        "specialityBengali",
        "degree",
        "experience",
        "description",
        "fees",
        "bankDetails",
        "availableDays",
        "availabilityStatus",
        "isActive",
        "address",
        "googleMapLink",
        "startTime",
        "endTime",
        "slotDuration",
      ];
    }

    if (role === "doctor") {
      allowedFields = [
        "address",
        "description",
        "fees",
        "availableDays",
        "bankDetails",
        "googleMapLink",
        "availabilityStatus",
        "startTime",
        "endTime",
        "slotDuration",
      ];
    }

    const updates = {};
    const body = req.body || {};

    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        "prescripto/doctors",
      );
      updates.image = result.secure_url;
    }

    if (body.address) {
      body.address = JSON.parse(body.address);
    }

    if (body.bankDetails) {
      body.bankDetails = JSON.parse(body.bankDetails);
    }

    if (body.availableDays) {
      body.availableDays = JSON.parse(body.availableDays);
    }

    // only update fields sent by user
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // nothing to update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No fields provided for update",
      });
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { $set: updates },
      { new: true, runValidators: true },
    ).select("-password");

    return res.status(200).json({
      message: "Doctor updated successfully",
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.error(error);
    console.error(error.response?.data);
    console.error(error.message);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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
