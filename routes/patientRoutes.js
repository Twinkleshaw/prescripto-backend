import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { getAllDoctors, getDoctorById } from "../controllers/doctorController.js";
import { bookAppointment } from "../controllers/patientController.js";

const router = express.Router();

router.get(
  "/doctors-list",
  authenticate,
  getAllDoctors
);

router.get("/doctors/:id", getDoctorById);

router.post("/create-booking",authenticate, bookAppointment);


export default router;