import express from "express";
import {
  checkPaymentStatus,
  initiatePayment,
  phonePeCallback,
  phonePeRedirect,
} from "../controllers/paymentController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/initiate", authenticate, initiatePayment);

router.post("/callback", phonePeCallback);
router.get("/redirect", phonePeRedirect);
// paymentRoutes.js — add temporarily
router.get("/check-status/:txnId", checkPaymentStatus);

export default router;
