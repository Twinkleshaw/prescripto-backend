import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";

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

    const query = search ? { phone: { $regex: search, $options: "i" } } : {};

    const patients = await Patient.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Patient.countDocuments(query);

    res.json({
      total,
      page,
      limit,
      patients,
    });
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
      paymentStatus:"pending",
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


