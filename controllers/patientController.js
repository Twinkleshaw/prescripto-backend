import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import { getFileUrl } from "../utils/fileHelper.js";
import PatientProfile from "../models/PatientProfile.js";

const generateTimeFromToken = (startTime, token, slotDuration) => {
  const [hours, minutes] = startTime.split(":").map(Number);

  const totalMinutes = hours * 60 + minutes + (token - 1) * slotDuration;

  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;

  return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
};

export const getAllPatients = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const search = req.query.search || "";

    // 🔒 Doctors only see patients they have appointments with
    if (req.user.role === "doctor") {
      const appointments = await Appointment.find({
        doctorId: req.user.id,
      }).distinct("patientId");

      const query = {
        _id: { $in: appointments },
        ...(search
          ? {
              $or: [
                { name: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
              ],
            }
          : {}),
      };

      const [patients, total] = await Promise.all([
        Patient.find(query)
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 }),
        Patient.countDocuments(query),
      ]);

      return res.json({ total, page, limit, patients });
    }

    // Admin sees all
    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [patients, total] = await Promise.all([
      Patient.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Patient.countDocuments(query),
    ]);

    res.json({ total, page, limit, patients });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const bookAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      date,
      patientName,
      patientAge,
      paymentType,
      patientPhone,
    } = req.body;

    if (!doctorId || !date || !patientName || !patientAge) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    let patientProfile = null;

    // Prefer phone if available
    if (patientPhone) {
      patientProfile = await PatientProfile.findOne({
        createdBy: req.user.id,
        phone: patientPhone,
      });
    }

    console.log(req.user.id);

    // Fallback to name search
    if (!patientProfile) {
      patientProfile = await PatientProfile.findOne({
        createdBy: req.user.id,
        name: patientName.trim(),
      });
    }

    // Create profile if not found
    if (!patientProfile) {
      patientProfile = await PatientProfile.create({
        createdBy: req.user.id,
        name: patientName,
        age: patientAge,
        phone: patientPhone,
      });
    }

    // =========================
    // TOKEN GENERATION
    // =========================

    const existing = await Appointment.find({
      doctorId,
      date,
    });

    const tokenNumber = existing.length + 1;

    const time = generateTimeFromToken(
      doctor.startTime,
      tokenNumber,
      doctor.slotDuration,
    );

    const [endH, endM] = doctor.endTime.split(":").map(Number);

    const endMinutes = endH * 60 + endM;

    const [tH, tM] = time.split(":").map(Number);

    const timeMinutes = tH * 60 + tM;

    if (timeMinutes >= endMinutes) {
      return res.status(400).json({
        message: "No slots available",
      });
    }

    // =========================
    // CREATE APPOINTMENT
    // =========================

    const appointment = await Appointment.create({
      bookedBy: req.user.id,

      patientId: patientProfile._id,

      doctorId,

      date,

      time,

      amount: doctor.fees,

      tokenNumber,

      patientName,

      patientAge,

      patientPhone,

      paymentType,

      paymentStatus: "pending",
    });

    return res.json({
      success: true,

      message: "Appointment booked",

      appointment,
    });
  } catch (error) {
    console.error("BOOK APPOINTMENT ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

export const updatePatientProfile = async (req, res) => {
  try {
    const patientId = req.user.id;

    if (req.body.phone) {
      return res.status(400).json({
        message: "Phone number cannot be updated",
      });
    }
    const updates = { ...req.body };

    if (req.file) {
      updates.profileImage = getFileUrl(
        req,
        "uploads/profile",
        req.file.filename,
      );
    }

    const patient = await Patient.findByIdAndUpdate(patientId, updates, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      patient,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.message ?? "Server error",
    });
  }
};

export const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select("-__v");

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // 🔒 Doctor can only view their own patients
    if (req.user.role === "doctor") {
      const hasAppointment = await Appointment.exists({
        doctorId: req.user.id,
        patientId: patient._id,
      });

      if (!hasAppointment) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    res.json({ success: true, patient });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid patient ID" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserByBookedBy = async (req, res) => {
  try {
    const { bookedBy } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(bookedBy)) {
      return res.status(400).json({
        message: "Invalid user id",
      });
    }

    // =========================
    // USER INFO
    // =========================

    const user = await Patient.findById(bookedBy).select(
      "name email phone profileImage",
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // =========================
    // TOTAL APPOINTMENTS
    // =========================

    const totalAppointments = await Appointment.countDocuments({
      bookedBy,
    });

    // =========================
    // FAMILY MEMBERS / PATIENTS
    // =========================

    const familyPatients = await Appointment.aggregate([
      {
        $match: {
          bookedBy: new mongoose.Types.ObjectId(bookedBy),
        },
      },

      {
        $group: {
          _id: {
            patientName: "$patientName",
            patientAge: "$patientAge",
          },

          totalVisits: {
            $sum: 1,
          },

          latestAppointment: {
            $max: "$createdAt",
          },
        },
      },

      {
        $project: {
          _id: 0,

          patientName: "$_id.patientName",

          patientAge: "$_id.patientAge",

          totalVisits: 1,

          latestAppointment: 1,
        },
      },

      {
        $sort: {
          latestAppointment: -1,
        },
      },
    ]);

    // =========================
    // RECENT APPOINTMENTS
    // =========================

    const recentAppointments = await Appointment.find({
      bookedBy,
    })
      .populate("doctorId", "name speciality")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      success: true,

      user,

      totalAppointments,

      totalFamilyMembers: familyPatients.length,

      familyPatients,

      recentAppointments,
    });
  } catch (error) {
    console.error("GET USER BY BOOKEDBY ERROR:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};
