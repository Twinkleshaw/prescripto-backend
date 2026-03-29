import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
{
    name: String,

    email: String,

    phone: {
        type: String,
        required: true,
        unique: true
    },

    gender: {
        type: String,
        enum: ["Male", "Female", "Other"]
    },

    dateOfBirth: Date,

    address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String
    },

    profileImage: String,

    role: {
        type: String,
        default: "patient"
    },

    isActive: {
        type: Boolean,
        default: true
    }

},
{ timestamps: true }
);

export default mongoose.model("Patient", patientSchema);