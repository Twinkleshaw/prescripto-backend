import express from "express";
import {
  sendOTP,
  verifyOTP,
  loginEmail,
  createDoctor
} from "../controllers/authController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/login", loginEmail);
router.post(
  "/create-doctor",
  authenticate,
  authorizeRoles("admin"),
  createDoctor
);

export default router;