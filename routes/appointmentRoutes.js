import express from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  cancelAppointment,
  completeAppointment,
  getAppointments,
  getMyAppointments,
} from "../controllers/appointmentController.js";

const router = express.Router();

router.get("/patient-appointments", authenticate, getMyAppointments);

router.get(
  "/appointments-list",
  authenticate,
  authorizeRoles("doctor", "admin"),
  getAppointments,
);

router.patch("/appointments/:id/cancel", authenticate, cancelAppointment);

router.patch(
  "/:id/complete",
  authenticate,
  authorizeRoles("doctor", "admin"),
  completeAppointment,
);

export default router;
