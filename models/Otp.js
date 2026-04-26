// models/Otp.js
import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Auto delete after expiry (TTL index)
otpSchema.index({ expiresAt: 5 }, { expireAfterSeconds: 0 });

export default mongoose.model("Otp", otpSchema);
