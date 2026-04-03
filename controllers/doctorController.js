import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";

export const getAllDoctors = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);

    const { search = "", specialty = "", city = "" } = req.query;

    let query = {};

    // 🔍 Search by name OR specialty
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { specialty: { $regex: search, $options: "i" } },
      ];
    }

    // 🩺 Filter by specialty
    if (specialty) {
      query.specialty = { $regex: specialty, $options: "i" };
    }

    // 📍 Filter by city (nested field)
    if (city) {
      query["address.city"] = { $regex: city, $options: "i" };
    }

    // 👤 Public filtering (optional)
    if (!req.user || req.user.role === "patient") {
      query.isActive = true;
      query.availabilityStatus = true;
    }

    const doctors = await Doctor.find(query)
      .select("-password")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Doctor.countDocuments(query);

    res.json({
      total,
      page,
      limit,
      doctors,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateDoctor = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user.id;
    const role = req.user.role;

    let allowedFields = [];

    // 👨‍💼 Admin fields
    if (role === "admin") {
      allowedFields = [
        "specialty",
        "nameBengali",
        "specialtyBengali",
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
