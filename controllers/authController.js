import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import Admin from "../models/Admin.js";

import { saveOTP, verifyOTP as verifyOTPStore } from "../utils/otpStore.js";

import twilio from "twilio";


export const sendOTP = async (req, res) => {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone is required" });
    }

    // format phone
    phone = phone.startsWith("+91") ? phone : `+91${phone}`;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    saveOTP(phone, otp);

    await client.messages.create({
      body: `Your Prescripto OTP is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    res.json({
      success: true,
      message: "OTP sent successfully",
      otp, // for testing purposes, remove in production
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.message || "Failed to send OTP",
    });
  }
};

export const verifyOTP = async (req, res) => {
  let { phone, otp } = req.body;

  phone = phone.startsWith("+91") ? phone : `+91${phone}`;

  const valid = verifyOTPStore(phone, otp);

  if (!valid) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  let patient = await Patient.findOne({ phone });

  if (!patient) {
    patient = await Patient.create({ phone });
  }

  const token = jwt.sign(
    { id: patient._id, role: "patient" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, patient });
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
      message: "User not found"
    });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(400).json({
      message: "Invalid password"
    });
  }

  const token = jwt.sign(
    { id: user._id, role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    role,
    user
  });

};

export const createDoctor = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    // 2. Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({
        message: "Doctor already exists"
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
      doctor: safeDoctor
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
};