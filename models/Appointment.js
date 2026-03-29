import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
{
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient"
  },

  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },

  patientName: String,
  patientAge: Number,

  date: String, // "2026-03-25"

  time: String, // "10:20"

  tokenNumber: Number, // 1,2,3...

  paymentType: {
    type: String,
    enum: ["online", "pay_at_clinic"]
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid"],
    default: "pending"
  },

  status: {
    type: String,
    enum: ["booked", "cancelled", "completed"],
    default: "booked"
  }

},
{ timestamps: true }
);

export default mongoose.model("Appointment", appointmentSchema);