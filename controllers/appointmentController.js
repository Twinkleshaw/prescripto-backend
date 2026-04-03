import Appointment from "../models/Appointment.js";

export const getAppointments = async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    let filter = {};

    // optional filters
    if (doctorId) filter.doctorId = doctorId;
    if (date) filter.date = date;

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name")
      .populate("patientId", "name")
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

export const getMyAppointments = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { date } = req.query;

    let filter = { patientId };

    if (date) {
      filter.date = date;
    }

    const appointments = await Appointment.find(filter)
      .populate("doctorId", "name")
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
    const appointmentId = req.params.id;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "cancelled") {
      return res.status(400).json({ message: "Already cancelled" });
    }

    if (appointment.status === "completed") {
      return res.status(400).json({
        message: "Completed appointment cannot be cancelled",
      });
    }

    // ✅ Cancel
    appointment.status = "cancelled";

    // 🔥 Track WHO cancelled
    appointment.cancelledBy = req.user?.id || null;
    appointment.cancelledByRole = req.user?.role || "admin";
    console.log(req?.user);

    await appointment.save();

    res.json({
      message: "Appointment cancelled",
      appointment,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const completeAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found",
      });
    }

    if (appointment.status === "completed") {
      return res.status(400).json({
        message: "Already completed",
      });
    }

    if (appointment.status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled appointment cannot be completed",
      });
    }

    // ✅ Mark complete
    appointment.status = "completed";

    await appointment.save();

    res.json({
      message: "Appointment marked as completed",
      appointment,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
