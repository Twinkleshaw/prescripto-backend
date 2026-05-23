import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import mongoose from "mongoose";

export const getAppointments = async (req, res) => {
  try {
    const { doctorId, date, search } = req.query;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    let filter = {};

    // 🔒 ROLE-BASED FILTER (FIRST & STRICT)
    if (req.user.role === "doctor") {
      // ✅ Always restrict to logged-in doctor
      filter.doctorId = new mongoose.Types.ObjectId(req.user.id);
    } else {
      // 👑 Admin can filter by doctor
      if (doctorId && mongoose.Types.ObjectId.isValid(doctorId)) {
        filter.doctorId = new mongoose.Types.ObjectId(doctorId);
      }
    }

    // 📅 Date filter
    if (date) {
      filter.date = date;
    }

    // 🔍 Patient name search
    if (search) {
      filter.patientName = { $regex: search.trim(), $options: "i" };
    }

    // 🔥 counts
    const totalAppointments = await Appointment.countDocuments(filter);
    const totalDoctors = await Doctor.countDocuments();
    const totalPatients = await Patient.countDocuments();

    // 🔥 payment stats
    const totalPaymentResult = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,

          totalPayment: {
            $sum: "$amount",
          },

          totalOfflinePayments: {
            $sum: {
              $cond: [{ $eq: ["$paymentType", "pay_at_clinic"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const totalPayment = totalPaymentResult[0]?.totalPayment || 0;

    const totalOfflinePayments =
      totalPaymentResult[0]?.totalOfflinePayments || 0;

    // 📦 data
    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name speciality")
      .populate("patientId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.json({
      success: true,
      totalAppointments,
      totalDoctors,
      totalPatients,
      totalPayment,
      totalOfflinePayments,
      appointments,
    });
  } catch (error) {
    console.error("GET APPOINTMENTS ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPatientsSummary = async (req, res) => {
  try {
    const { search } = req.query;

    // 📄 Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const limit = Math.min(20, parseInt(req.query.limit) || 10);

    const skip = (page - 1) * limit;

    // 🔍 Match filter
    let matchFilter = {};

    // 🔒 Doctor restriction
    if (req.user.role === "doctor") {
      matchFilter.doctorId = new mongoose.Types.ObjectId(req.user.id);
    }

    // 🔍 Search
    if (search) {
      matchFilter.patientName = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    // =========================
    // TOTAL UNIQUE PATIENTS
    // =========================

    const totalPatientsResult = await Appointment.aggregate([
      {
        $match: matchFilter,
      },

      {
        $group: {
          _id: {
            patientName: "$patientName",
            patientAge: "$patientAge",
            bookedBy: "$bookedBy",
          },
        },
      },

      {
        $count: "total",
      },
    ]);

    const totalPatients = totalPatientsResult[0]?.total || 0;

    // =========================
    // PAGINATED PATIENTS
    // =========================

    const patients = await Appointment.aggregate([
      // STEP 1 → Filter
      {
        $match: matchFilter,
      },

      // STEP 2 → Latest first
      {
        $sort: {
          createdAt: -1,
        },
      },

      // STEP 3 → Unique patients
      {
        $group: {
          _id: {
            patientName: "$patientName",
            patientAge: "$patientAge",
            bookedBy: "$bookedBy",
          },

          patientName: {
            $first: "$patientName",
          },

          patientAge: {
            $first: "$patientAge",
          },

          bookedBy: {
            $first: "$bookedBy",
          },
          doctorId: {
            $first: "$doctorId",
          },

          latestAppointmentDate: {
            $first: "$date",
          },

          latestAppointmentCreatedAt: {
            $first: "$createdAt",
          },

          totalAppointments: {
            $sum: 1,
          },

          latestStatus: {
            $first: "$status",
          },
        },
      },

      // STEP 4 → Sort recent patient first
      {
        $sort: {
          latestAppointmentCreatedAt: -1,
        },
      },

      // STEP 5 → Pagination
      {
        $skip: skip,
      },

      {
        $limit: limit,
      },

      // STEP 6 → Populate user
      {
        $lookup: {
          from: "patients", // ⚠️ change if needed
          localField: "bookedBy",
          foreignField: "_id",
          as: "user",
        },
      },

      {
        $lookup: {
          from: "doctors",
          localField: "doctorId",
          foreignField: "_id",
          as: "doctor",
        },
      },

      {
        $unwind: {
          path: "$doctor",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },

      // STEP 7 → Final response shape
      {
        $project: {
          _id: 0,

          patientName: 1,

          patientAge: 1,

          latestAppointmentDate: 1,

          latestAppointmentCreatedAt: 1,

          totalAppointments: 1,

          latestStatus: 1,

          bookedBy: 1,
          doctor: {
            _id: "$doctor._id",
            name: "$doctor.name",
            speciality: "$doctor.speciality",
            profileImage: "$doctor.profileImage",
          },

          user: {
            _id: "$user._id",
            name: "$user.name",
            phone: "$user.phone",
            email: "$user.email",
          },
        },
      },
    ]);

    return res.json({
      success: true,

      page,

      limit,

      totalPatients,

      totalPages: Math.ceil(totalPatients / limit),

      patients,
    });
  } catch (error) {
    console.error("GET PATIENT SUMMARY ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

export const getMyAppointments = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { date } = req.query;

    let filter = { patientId };

    if (date) {
      filter.date = date;
    }

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // 🔒 Ownership check
    const isAdmin = req.user.role === "admin";
    const isDoctor =
      req.user.role === "doctor" &&
      appointment.doctorId.toString() === req.user.id;
    const isPatient =
      req.user.role === "patient" &&
      appointment.patientId.toString() === req.user.id;

    if (!isAdmin && !isDoctor && !isPatient) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (appointment.status === "cancelled") {
      return res.status(400).json({ message: "Already cancelled" });
    }
    if (appointment.status === "completed") {
      return res
        .status(400)
        .json({ message: "Completed appointment cannot be cancelled" });
    }

    appointment.status = "cancelled";
    appointment.cancelledBy = req.user.id;
    appointment.cancelledByRole = req.user.role;
    await appointment.save();

    res.json({ message: "Appointment cancelled", appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const completeAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found",
      });
    }

    // Doctor can complete only own appointments
    if (
      req.user.role === "doctor" &&
      appointment.doctorId.toString() !== req.user.id
    ) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    // Already completed
    if (appointment.status === "completed") {
      return res.status(400).json({
        message: "Already completed",
      });
    }

    // Cancelled cannot complete
    if (appointment.status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled appointment cannot be completed",
      });
    }

    // =========================
    // COMPLETE APPOINTMENT
    // =========================

    appointment.status = "completed";

    // If patient pays at clinic,
    // mark payment as paid on completion
    if (
      appointment.paymentType === "pay_at_clinic" &&
      appointment.paymentStatus === "pending"
    ) {
      appointment.paymentStatus = "paid";
    }

    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment marked as completed",
      appointment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
