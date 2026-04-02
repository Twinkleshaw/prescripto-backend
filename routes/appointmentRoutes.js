import express from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import { cancelAppointment, getAppointments, getMyAppointments } from "../controllers/appointmentController.js";


const router = express.Router();

router.get("/patient-appointments", authenticate, getMyAppointments);

router.get(
    "/appointments-list",
    authenticate,
    authorizeRoles("doctor", "admin"),
    getAppointments
);

router.patch("/appointments/:id/cancel", authenticate, cancelAppointment);

export default router;