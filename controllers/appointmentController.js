import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";

export const getAppointments = async (req, res) => {
  try {
    const { doctorId, date, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};

    if (doctorId) filter.doctorId = doctorId;
    if (date) filter.date = date;

    if (req.user.role === "doctor") {
      filter.doctorId = req.user.id;
    }

    // ✅ SIMPLE + FAST SEARCH
    if (search) {
      filter.patientName = { $regex: search.trim(), $options: "i" };
    }

    const totalAppointments = await Appointment.countDocuments(filter);
    const totalDoctors = await Doctor.countDocuments();
    const totalPatients = await Patient.countDocuments();

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name")
      .populate("patientId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      totalAppointments,
      totalDoctors,
      totalPatients,
      appointments,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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
      return res.status(404).json({ message: "Appointment not found" });
    }

    // 🔒 Doctor can only complete their own appointments
    if (
      req.user.role === "doctor" &&
      appointment.doctorId.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (appointment.status === "completed") {
      return res.status(400).json({ message: "Already completed" });
    }
    if (appointment.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Cancelled appointment cannot be completed" });
    }

    appointment.status = "completed";
    await appointment.save();

    res.json({ message: "Appointment marked as completed", appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
