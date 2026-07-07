// models/Counter.js
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.index({ doctorId: 1, date: 1 }, { unique: true });

export default mongoose.model("Counter", counterSchema);
