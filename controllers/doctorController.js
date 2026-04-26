import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";

export const getAllDoctors = async (req, res) => {
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
