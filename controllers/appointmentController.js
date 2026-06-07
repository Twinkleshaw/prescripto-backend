import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import mongoose from "mongoose";
import { Parser } from "json2csv";
import PatientProfile from "../models/PatientProfile.js";

export const getAppointments = async (req, res) => {
  try {
    const { doctorId, date, search } = req.query;

    // 📄 Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const limit = Math.min(20, parseInt(req.query.limit) || 10);

    const skip = (page - 1) * limit;

    // 🔥 Used for stats/cards
    let baseFilter = {};

    // 🔥 Used only for table
    let tableFilter = {};

    if (req.user.role === "doctor") {
      baseFilter.doctorId = new mongoose.Types.ObjectId(req.user.id);
    } else {
      if (doctorId && mongoose.Types.ObjectId.isValid(doctorId)) {
        baseFilter.doctorId = new mongoose.Types.ObjectId(doctorId);
      }
    }

    if (date) {
      baseFilter.date = date;
    }

    tableFilter = { ...baseFilter };

    // 🔍 Search ONLY affects table
    if (search) {
      tableFilter.patientName = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const totalAppointments = await Appointment.countDocuments(baseFilter);

    const totalDoctors = await Doctor.countDocuments();

    const totalPatients = await PatientProfile.countDocuments();

    const statusCounts = await Appointment.aggregate([
      {
        $match: baseFilter,
      },

      {
        $group: {
          _id: "$status",

          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const totalCompleted =
      statusCounts.find((s) => s._id === "completed")?.count || 0;

    const totalPending =
      statusCounts.find((s) => s._id === "booked")?.count || 0;

    const totalCancelled =
      statusCounts.find((s) => s._id === "cancelled")?.count || 0;

    const paymentStats = await Appointment.aggregate([
      {
        $match: baseFilter,
      },
      {
        $group: {
          _id: null,

          totalBilling: {
            $sum: "$amount",
          },

          totalCollected: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0],
            },
          },

          totalPendingAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "pending"] }, "$amount", 0],
            },
          },

          totalOfflineCollected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$paymentType", "pay_at_clinic"] },
                    { $eq: ["$paymentStatus", "paid"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalBilling = paymentStats[0]?.totalBilling || 0;

    const totalCollected = paymentStats[0]?.totalCollected || 0;

    const totalPendingAmount = paymentStats[0]?.totalPendingAmount || 0;

    const totalOfflineCollected = paymentStats[0]?.totalOfflineCollected || 0;

    const appointments = await Appointment.find(tableFilter)
      .populate("doctorId", "name speciality")
      .populate("patientId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.json({
      success: true,

      page,
      limit,

      totalAppointments,
      totalDoctors,
      totalPatients,

      totalCompleted,
      totalPending,
      totalCancelled,

      totalBilling,
      totalCollected,
      totalPendingAmount,
      totalOfflineCollected,

      totalPages: Math.ceil(totalAppointments / limit),

      appointments,
    });
  } catch (error) {
    console.error("GET APPOINTMENTS ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
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
          latestAppointmentId: {
            $first: "$_id",
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
          _id: {
            $concat: [
              "$patientName",
              "-",
              { $toString: "$patientAge" },
              "-",
              { $toString: "$bookedBy" },
            ],
          },
          appointmentId: "$latestAppointmentId",

          invoiceId: {
            $concat: [
              "#INV-",
              {
                $toUpper: {
                  $substrCP: [{ $toString: "$latestAppointmentId" }, 18, 6],
                },
              },
            ],
          },

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
    const { date } = req.query;

    let filter = {
      bookedBy: req.user.id,
    };

    if (date) {
      filter.date = date;
    }

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "-password")
      .populate("patientId", "name age")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
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

export const exportAppointmentsCSV = async (req, res) => {
  try {
    let filter = {};

    // 🔒 Doctor restriction
    if (req.user.role === "doctor") {
      filter.doctorId = req.user.id;
    }

    // 📦 Fetch appointments
    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name speciality")
      .populate("bookedBy", "name phone email")
      .sort({ createdAt: -1 });

    // 📄 CSV formatted data
    const csvData = appointments.map((appt) => ({
      Appointment_ID: appt._id,

      Patient_Name: appt.patientName,

      Patient_Age: appt.patientAge,

      Doctor_Name: appt.doctorId?.name || "",

      Doctor_Speciality: appt.doctorId?.speciality || "",

      Appointment_Date: appt.date,

      Appointment_Time: appt.time,

      Token_Number: appt.tokenNumber,

      Payment_Type: appt.paymentType,

      Payment_Status: appt.paymentStatus,

      Amount: appt.amount,

      Status: appt.status,

      Booked_By_Name: appt.bookedBy?.name || "",

      Booked_By_Phone: appt.bookedBy?.phone || "",

      Booked_By_Email: appt.bookedBy?.email || "",

      Created_At: appt.createdAt,
    }));

    // 📄 Convert to CSV
    const json2csv = new Parser();

    const csv = json2csv.parse(csvData);

    // 📥 Download response
    res.header("Content-Type", "text/csv");

    res.attachment(`appointments-${Date.now()}.csv`);

    return res.send(csv);
  } catch (error) {
    console.error("EXPORT CSV ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to export CSV",
    });
  }
};
