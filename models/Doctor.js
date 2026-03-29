import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    nameBengali: String,

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      required: false,
    },

    specialty: {
      type: String,
      required: false,
    },

    specialtyBengali: String,

    degree: {
      type: String,
      required: false,
    },

    experience: {
      type: String,
      required: false,
    },

    description: {
      type: String,
      required: false,
    },

    startTime: String, // "10:00"

    endTime: String, // "12:00"

    slotDuration: {
      type: Number,
      default: 10,
    },

// logic 
//     schedule: [
//   {
//     day: {
//       type: String,
//       required: true
//     },
//     startTime: {
//       type: String,
//       required: true
//     },
//     endTime: {
//       type: String,
//       required: true
//     },
//     slotDuration: {
//       type: Number,
//       default: 10
//     }
//   }
// ],

    fees: {
      type: Number,
      required: false,
    },

    address: {
      city: String,
      state: String,
      pinCode: String,
      street: String,
      landmark: String,
    },

    phone: {
      type: String,
      required: false,
      unique: true,
    },

    googleMapLink: String,

    availableDays: {
      type: [String],
      required: false,
    },

    availabilityStatus: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Doctor", doctorSchema);
