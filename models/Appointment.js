import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    // WHO booked it (the logged-in user — you)
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    patientName: String,
    patientAge: Number,

    date: String, // "2026-03-25"

    time: String, // "10:20"

    tokenNumber: Number, // 1,2,3...

    paymentType: {
      type: String,
      enum: ["online", "pay_at_clinic"],
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["booked", "cancelled", "completed"],
      default: "booked",
    },
    cancelledByRole: {
      type: String,
      enum: ["doctor", "patient", "admin"],
    },
    cancelledById: {
      type: mongoose.Schema.Types.ObjectId,
    },
    transactionId: {
      type: String,
      default: null,
    },

    paymentProvider: {
      type: String,
      enum: ["phonepe"],
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    paymentResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

appointmentSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 900, // 15 minutes
    partialFilterExpression: {
      paymentStatus: "pending",
      paymentType: "online",
    },
  },
);

export default mongoose.model("Appointment", appointmentSchema);
