import express from "express";
import {
  getAppointmentPaymentStatus,
  initiatePayment,
  phonePeCallback,
  phonePeRedirect,
} from "../controllers/paymentController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/initiate", authenticate, initiatePayment);

router.post("/callback", phonePeCallback);
router.post("/webhook", phonePeCallback);
router.get("/redirect", phonePeRedirect);
router.get("/status/:appointmentId", authenticate, getAppointmentPaymentStatus);

export default router;
