import express from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  deleteDoctor,
  getAllDoctors,
  updateDoctor,
} from "../controllers/doctorController.js";
import { getAllPatients } from "../controllers/patientController.js";

const router = express.Router();

router.get("/doctors", authenticate, authorizeRoles("admin"), getAllDoctors);

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

export default router;
