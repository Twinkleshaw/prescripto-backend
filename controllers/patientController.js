import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import { getFileUrl } from "../utils/fileHelper.js";

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

    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // 🧠 Get day name (Monday, Tuesday...)
    const dayName = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
    });

    const startTime = doctor.startTime;
    const endTime = doctor.endTime;
    const slotDuration = doctor.slotDuration;

    // 📊 Existing bookings
    const existing = await Appointment.find({ doctorId, date });

    const tokenNumber = existing.length + 1;

    // ⏰ Generate time
    const time = generateTimeFromToken(startTime, tokenNumber, slotDuration);

    // 🚫 Optional: check if exceeds endTime
    const [endH, endM] = endTime.split(":").map(Number);
    const endMinutes = endH * 60 + endM;

    const [tH, tM] = time.split(":").map(Number);
    const timeMinutes = tH * 60 + tM;

    if (timeMinutes >= endMinutes) {
      return res.status(400).json({
        message: "No slots available",
      });
    }

    const appointment = await Appointment.create({
      patientId: req.user.id,
      doctorId,
      date,
      time,
      tokenNumber,
      patientName,
      patientAge,
      patientPhone,
      paymentType,
      paymentStatus: "pending",
    });

    res.json({
      message: "Appointment booked",
      appointment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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
      updates.profileImage = getFileUrl(req, "uploads/profile", req.file.filename);
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
