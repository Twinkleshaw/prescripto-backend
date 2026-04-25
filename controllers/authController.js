import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import Admin from "../models/Admin.js";

import { saveOTP, verifyOTP as verifyOTPStore } from "../utils/otpStore.js";

export const sendOTP = async (req, res) => {
  const { phone } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  saveOTP(phone, otp);

  res.json({
    message: "OTP sent",
    otp,
  });
};

export const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const valid = verifyOTPStore(phone, otp);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        data: null,
      });
    }

    let patient = await Patient.findOne({ phone });

    if (!patient) {
      patient = await Patient.create({ phone });
    }

    const token = jwt.sign(
      { id: patient._id, role: "patient" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      success: true,
      message: "OTP verified successfully",
      data: {
        token,
        patient,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      data: null,
    });
  }
};

export const loginEmail = async (req, res) => {
  const { email, password } = req.body;

  let user = await Admin.findOne({ email });
  let role = "admin";

  if (!user) {
    user = await Doctor.findOne({ email });
    role = "doctor";
  }

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(400).json({
      message: "Invalid password",
    });
  }

  const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({
    token,
    role,
    user,
  });
};

export const createDoctor = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    // 2. Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({
        message: "Doctor already exists",
      });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create doctor
    const doctor = await Doctor.create({
      name,
      email,
      password: hashedPassword,
    });

    // 5. Remove password before sending response
    const { password: _, ...safeDoctor } = doctor._doc;

    res.status(201).json({
      message: "Doctor created successfully",
      doctor: safeDoctor,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
