import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getAllDoctors,
  getDoctorById,
} from "../controllers/doctorController.js";
import {
  bookAppointment,
  getPatientById,
  updatePatientProfile,
} from "../controllers/patientController.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.get("/doctors-list", authenticate, getAllDoctors);

router.get("/doctors/:id", authenticate, getDoctorById);

router.post("/create-booking", authenticate, bookAppointment);
router.patch("/profile", authenticate, upload.single("profileImage"), updatePatientProfile);
router.get("/:id", authenticate, getPatientById);

export default router;
