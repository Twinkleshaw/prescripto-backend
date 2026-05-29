import mongoose from "mongoose";

const patientProfileSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient", // your current user model
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    age: Number,

    phone: String,
  },
  { timestamps: true },
);

export default mongoose.model("PatientProfile", patientProfileSchema);
