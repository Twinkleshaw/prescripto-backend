import express from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  deleteDoctor,
  exportDoctorsCSV,
  getAllDoctors,
  updateDoctor,
} from "../controllers/doctorController.js";
import {
  getAllPatients,
  getUserByBookedBy,
} from "../controllers/patientController.js";
import { getPatientsSummary } from "../controllers/appointmentController.js";
import {
  changeAdminPassword,
  updateAdminProfile,
} from "../controllers/adminController.js";

const router = express.Router();

router.get("/doctors", authenticate, authorizeRoles("admin"), getAllDoctors);
router.get(
  "/export-csv",
  authenticate,
  authorizeRoles("admin"),
  exportDoctorsCSV,
);

router.get(
  "/getAdminPatients",
  authenticate,
  authorizeRoles("admin"),
  getPatientsSummary,
);

// Admin updates any doctor
router.put(
  "/update-doctor/:id",
  authenticate,
  authorizeRoles("admin"),
  updateDoctor,
);

router.get("/patients", authenticate, authorizeRoles("admin"), getAllPatients);

router.delete(
  "/doctor/:id",
  authenticate,
  authorizeRoles("admin"),
  deleteDoctor,
);

router.get(
  "/user/:bookedBy",
  authenticate,
  authorizeRoles("admin"),
  getUserByBookedBy,
);

router.put(
  "/profile",
  authenticate,
  authorizeRoles("admin"),
  updateAdminProfile,
);

router.put(
  "/change-password",
  authenticate,
  authorizeRoles("admin"),
  changeAdminPassword,
);

export default router;
