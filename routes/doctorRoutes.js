import express from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import { updateDoctor } from "../controllers/doctorController.js";
import { getAllPatients } from "../controllers/patientController.js";

const router = express.Router();

// Doctor updates own profile
router.put(
  "/update-profile",
  authenticate,
  authorizeRoles("doctor"),
  updateDoctor
);


router.get(
  "/patients-list",
  authenticate,
  authorizeRoles("doctor"),
  getAllPatients
);





export default router;